import crypto from 'node:crypto';
import {Deposit} from '../models/Deposit.js';
import {PackagePurchase} from '../models/PackagePurchase.js';
import {Transaction} from '../models/Transaction.js';
import {PackageModel} from '../models/Package.js';
import {ledgerEntry,withTransaction} from './ledger.service.js';
import {createCapital} from './capital.service.js';
import {AppError} from '../utils/errors.js';
import {AuditLog} from '../models/AuditLog.js';
import {AdminSettings} from '../models/AdminSettings.js';
import {createCommissions} from './referral.service.js';

function paymentMethodActive(settings:any,method:string){
  const pd:any=settings?.paymentDetails??{};
  const normalized=String(method??'').trim();

  if(normalized==='JazzCash') return pd.jazzCashActive!==false;
  if(normalized==='Easypaisa') return pd.easypaisaActive!==false;
  if(normalized==='BEP20') return pd.bep20Active!==false;

  const custom=Array.isArray(pd.customMethods)
    ? pd.customMethods.find((m:any)=>String(m.name??'').trim()===normalized)
    : null;

  return !!custom&&custom.active!==false;
}

export async function createDeposit(userId:any,input:any){
  const settings=await AdminSettings.findOne({key:'global'}).lean();

  if(!paymentMethodActive(settings,input.paymentMethod)){
    throw new AppError(
      403,
      `${input.paymentMethod} deposits are currently unavailable`
    );
  }

  const depositType=input.depositType==='package'?'package':'wallet';

  let packagePurchaseId=input.packagePurchaseId??null;

  if(depositType==='package'){
    if(!packagePurchaseId){
      throw new AppError(422,'Package purchase is required for a package deposit');
    }

    const purchaseDoc=await PackagePurchase.findOne({
      _id:packagePurchaseId,
      userId,
      status:'pending'
    }).lean();

    if(!purchaseDoc){
      throw new AppError(404,'Pending package purchase not found');
    }

    const purchase={totalAmount:Number((purchaseDoc as any).totalAmount)};

    if(Number(input.amount)!==purchase.totalAmount){
      throw new AppError(
        422,
        `Package deposit must be exactly ${purchase.totalAmount}`
      );
    }
  }

  if(depositType==='package'){
    const purchase=await PackagePurchase.findOne({
      _id:packagePurchaseId,
      userId,
      status:'pending'
    });

    if(!purchase){
      throw new AppError(404,'Pending package purchase not found');
    }

    const existing=await Deposit.findOne({
      userId,
      packagePurchaseId,
      status:'pending'
    });

    if(existing){
      existing.amount=Number(input.amount);
      existing.paymentMethod=String(input.paymentMethod).trim();
      existing.reference=String(input.reference).trim();
      existing.details=String(input.details??'').trim();

      if(input.receiptPath){
        existing.receiptPath=input.receiptPath;
      }

      await existing.save();
      return existing;
    }
  }

  const d=await Deposit.create({
    userId,
    amount:Number(input.amount),
    paymentMethod:String(input.paymentMethod).trim(),
    reference:String(input.reference).trim(),
    details:String(input.details??'').trim(),
    receiptPath:input.receiptPath??null,
    depositType,
    packagePurchaseId,
    status:'pending'
  });

  if(depositType==='package'){
    await PackagePurchase.updateOne(
      {_id:packagePurchaseId,userId,status:'pending'},
      {$set:{paymentDepositId:d._id}}
    );
  }

  return d;
}

export async function approveDeposit(
  id:string,
  adminId:any,
  note='',
  meta?:{ip?:string;userAgent?:string}
){
  return withTransaction(async session=>{
    const d=await Deposit.findOne({
      _id:id,
      status:'pending'
    }).session(session);

    if(!d){
      throw new AppError(404,'Pending deposit not found');
    }

    d.status='approved';
    d.reviewedBy=adminId;
    d.reviewedAt=new Date();
    d.adminNote=note;
    await d.save({session});

    /*
     * Referral commission sirf admin approval ke baad banega.
     * Commission isi MongoDB transaction ka hissa hoga.
     */
    let commissionBusinessAmount = 0;
    let commissionSourceReference = '';

    if(d.depositType==='package'){
      const purchase=await PackagePurchase.findOne({
        _id:d.packagePurchaseId,
        userId:d.userId,
        status:'pending'
      }).session(session);

      if(!purchase){
        throw new AppError(
          409,
          'Package purchase is no longer pending'
        );
      }

      const packageDoc=await PackageModel.findById(
        purchase.packageId
      ).session(session);

      if(!packageDoc){
        throw new AppError(404,'Package not found');
      }

      const now=new Date();

      const recoveryDays=Math.max(
        0,
        Number(purchase.capitalRecoveryDays??0)
      );

      const profitDays=Math.max(
        0,
        Number(purchase.profitDurationDays??0)
      );

      const totalDays=Math.max(
        1,
        Number(purchase.investmentDays??1)
      );

      const profitPercent=Math.max(
        0,
        Number(purchase.profitPercent??0)
      );

      const dailyProfitAmount=Number(
        (
          Number(purchase.totalAmount)*profitPercent/100
        ).toFixed(2)
      );

      /*
       * Package daily-profit system:
       *
       * The package becomes active immediately after
       * admin approves its external payment.
       *
       * Profit is NOT paid upfront.
       * The first profit becomes due exactly 24 hours
       * after activation.
       *
       * Principal remains separate and is never credited
       * into the available balance by this package job.
       */
      purchase.status='active';
      purchase.purchasedAt=now;
      purchase.activatedAt=now;

      purchase.capitalRecoveryDays=recoveryDays;
      purchase.profitDurationDays=profitDays;
      purchase.investmentDays=totalDays;

      purchase.capitalRecoveryAt=null;
      purchase.profitStartsAt=null;

      purchase.maturesAt=
        new Date(now.getTime()+totalDays*86400000);

      purchase.profitPercent=profitPercent;
      purchase.dailyProfitAmount=dailyProfitAmount;

      purchase.lastProfitAt=null;
      purchase.nextProfitAt=
        new Date(now.getTime()+86400000);

      purchase.profitCyclesCredited=0;

      purchase.profitAmount=0;
      purchase.payoutAmount=0;
      await purchase.save({session});

      const capitalReference = `PKG-CAPITAL-${purchase._id}`;
      const existingCapitalEntry = await Transaction.exists({reference:capitalReference}).session(session);
      if (!existingCapitalEntry) {
        await ledgerEntry({
          userId:d.userId,
          type:'capital',
          amount:Number(purchase.totalAmount),
          direction:'credit',
          reference:capitalReference,
          description:'Approved package purchase added to Capital Locked',
          relatedEntity:purchase._id,
          adminActorId:adminId
        },{session});
      }

      commissionBusinessAmount = Number(purchase.totalAmount);
      commissionSourceReference = `PACKAGE-${purchase._id}`;

      await AuditLog.create([{
        actorId:adminId,
        action:'package.activate',
        targetType:'PackagePurchase',
        targetId:purchase._id.toString(),
        after:{
          status:purchase.status,
          totalAmount:purchase.totalAmount,
          packageId:purchase.packageId.toString(),
          activatedAt:purchase.activatedAt,
          maturesAt:purchase.maturesAt,
          profitPercent:purchase.profitPercent,
          dailyProfitAmount:purchase.dailyProfitAmount,
          nextProfitAt:purchase.nextProfitAt,
          profitCyclesCredited:purchase.profitCyclesCredited
        },
        metadata:{
          depositId:d._id.toString(),
          note
        },
        ip:meta?.ip,
        userAgent:meta?.userAgent
      }],{session});
    }else{
      const tx=await ledgerEntry({
        userId:d.userId,
        type:'deposit',
        amount:d.amount,
        direction:'credit',
        reference:'DEP-'+d._id,
        description:'Approved BEP20/member deposit',
        relatedEntity:d._id,
        adminActorId:adminId
      },{session});

      commissionBusinessAmount = Number(d.amount);
      commissionSourceReference = `DEPOSIT-${d._id}`;

      await AuditLog.create([{
        actorId:adminId,
        action:'deposit.approve',
        targetType:'Deposit',
        targetId:d._id.toString(),
        after:{
          status:'approved',
          amount:d.amount
        },
        metadata:{
          transactionId:tx.transactionId
        },
        ip:meta?.ip,
        userAgent:meta?.userAgent
      }],{session});
    }

    if (commissionBusinessAmount > 0 && commissionSourceReference) {
      await createCommissions(
        d.userId,
        commissionBusinessAmount,
        commissionSourceReference,
        session
      );
    }

    return d;
  });
}

export async function rejectDeposit(
  id:string,
  adminId:any,
  note='',
  meta?:{ip?:string;userAgent?:string}
){
  return withTransaction(async session=>{
    const d=await Deposit.findOne({
      _id:id,
      status:'pending'
    }).session(session);

    if(!d){
      throw new AppError(404,'Pending deposit not found');
    }

    d.status='rejected';
    d.reviewedBy=adminId;
    d.reviewedAt=new Date();
    d.adminNote=note;
    await d.save({session});

    if(d.depositType==='package'&&d.packagePurchaseId){
      const purchase=await PackagePurchase.findOne({
        _id:d.packagePurchaseId,
        userId:d.userId,
        status:'pending'
      }).session(session);

      if(purchase){
        purchase.status='rejected';
        purchase.adminNote=note;
        await purchase.save({session});

        await PackageModel.updateOne(
          {_id:purchase.packageId},
          {$inc:{remainingQuantity:purchase.quantity}}
        ).session(session);
      }
    }

    await AuditLog.create([{
      actorId:adminId,
      action:'deposit.reject',
      targetType:'Deposit',
      targetId:d._id.toString(),
      after:{
        status:'rejected',
        note
      },
      ip:meta?.ip,
      userAgent:meta?.userAgent
    }],{session});

    return d;
  });
}

export function generateReference(prefix:string){
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}





