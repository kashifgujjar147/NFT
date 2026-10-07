import crypto from 'node:crypto';
import {Deposit} from '../models/Deposit.js';
import {PackagePurchase} from '../models/PackagePurchase.js';
import {PackageModel} from '../models/Package.js';
import {ledgerEntry,withTransaction} from './ledger.service.js';
import {AppError} from '../utils/errors.js';
import {AuditLog} from '../models/AuditLog.js';
import {AdminSettings} from '../models/AdminSettings.js';

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
     * Normal wallet deposit:
     * approval credits the member wallet.
     *
     * Package deposit:
     * payment was made externally, so we DO NOT credit wallet first
     * and then debit it. Approval directly activates the package.
     */
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
        Number(purchase.capitalRecoveryDays??45)
      );

      const profitDays=Math.max(
        0,
        Number(purchase.profitDurationDays??45)
      );

      const totalDays=Math.max(
        1,
        Number(purchase.investmentDays??(recoveryDays+profitDays))
      );

      purchase.status=recoveryDays>0?'capital_recovery':'profit';
      purchase.purchasedAt=now;
      purchase.activatedAt=now;
      purchase.capitalRecoveryDays=recoveryDays;
      purchase.profitDurationDays=profitDays;
      purchase.investmentDays=totalDays;

      purchase.capitalRecoveryAt=
        recoveryDays>0
          ? new Date(now.getTime()+recoveryDays*86400000)
          : now;

      purchase.profitStartsAt=purchase.capitalRecoveryAt;

      purchase.maturesAt=
        new Date(now.getTime()+totalDays*86400000);

      await purchase.save({session});

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
          capitalRecoveryAt:purchase.capitalRecoveryAt,
          profitStartsAt:purchase.profitStartsAt,
          maturesAt:purchase.maturesAt
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



