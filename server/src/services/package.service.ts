import mongoose from 'mongoose';
import {PackageModel} from '../models/Package.js';
import {PackagePurchase} from '../models/PackagePurchase.js';
import {Deposit} from '../models/Deposit.js';
import {AdminSettings} from '../models/AdminSettings.js';
import {withTransaction,money} from './ledger.service.js';
import {AppError} from '../utils/errors.js';
import {audit} from './audit.service.js';
import {generateReference} from './deposit.service.js';

export async function listPackages(){
  return PackageModel
    .find({active:true})
    .sort({createdAt:-1})
    .lean();
}

export async function purchasePackage(
  userId:any,
  packageId:string,
  quantity:number,
  idempotencyKey:string,
  paymentMethod='BEP20',
  paymentInput?:{
    amount:number;
    reference:string;
    details?:string;
    receiptPath?:string|null;
  }
){
  return withTransaction(async session=>{
    const existing=await PackagePurchase.findOne({
      userId,
      idempotencyKey
    }).session(session);

    if(existing){
      return existing;
    }

    if(!paymentInput){
      throw new AppError(
        422,
        'Payment proof is required before NFT purchase submission.'
      );
    }

    const p=await PackageModel.findOne({
      _id:packageId,
      active:true
    }).session(session);

    if(!p){
      throw new AppError(
        404,
        'Package not found'
      );
    }

    if(p.remainingQuantity<quantity){
      throw new AppError(
        409,
        'Insufficient package availability'
      );
    }

    const now=new Date();

    if(p.startDate&&now<p.startDate){
      throw new AppError(
        409,
        'Package sale has not started'
      );
    }

    if(p.endDate&&now>p.endDate){
      throw new AppError(
        409,
        'Package sale has ended'
      );
    }

    const settings=await AdminSettings.findOne({
      key:'global'
    }).session(session);

    const pd:any=settings?.paymentDetails??{};

    if(paymentMethod==='BEP20'&&pd.bep20Active===false){
      throw new AppError(
        403,
        'BEP20 package deposits are currently unavailable'
      );
    }

    const unit=money(
      p.salePrice??p.price
    );

    const total=money(
      unit*quantity
    );

    const submittedAmount=Number(paymentInput.amount);

    if(!Number.isFinite(submittedAmount)||submittedAmount!==total){
      throw new AppError(
        422,
        `Package payment amount must exactly match the NFT price: ${total}`
      );
    }

    const paymentReference=String(
      paymentInput.reference??''
    ).trim();

    if(paymentReference.length<3){
      throw new AppError(
        422,
        'Transaction reference is required'
      );
    }

    const receiptPath=paymentInput.receiptPath??null;

    if(!receiptPath){
      throw new AppError(
        422,
        'Payment receipt is required'
      );
    }

    const recoveryDays=Math.max(
      0,
      Number(
        p.capitalRecoveryDays??
        settings?.capitalRecoveryDays??
        45
      )
    );

    const profitDays=Math.max(
      0,
      Number(
        p.profitDurationDays??
        settings?.profitDurationDays??
        45
      )
    );

    const configuredTotal=Math.max(
      1,
      Number(
        p.investmentDays??
        settings?.totalInvestmentDays??
        (recoveryDays+profitDays)
      )
    );

    const investmentDays=Math.max(
      configuredTotal,
      recoveryDays+profitDays
    );

    const profitPercent=Number(
      p.profitPercent??0
    );

    const profitAmount=money(
      total*profitPercent/100
    );

    const payoutAmount=money(
      total+profitAmount
    );

    /*
     * Reserve inventory ONLY after the member has submitted
     * the exact payment amount + TX reference + receipt.
     *
     * Package remains pending until admin approves the deposit.
     */
    const updated=await PackageModel.findOneAndUpdate(
      {
        _id:p._id,
        active:true,
        remainingQuantity:{$gte:quantity}
      },
      {
        $inc:{
          remainingQuantity:-quantity
        }
      },
      {
        new:true,
        session
      }
    );

    if(!updated){
      throw new AppError(
        409,
        'Package sold out during payment submission'
      );
    }

    const purchaseReference=generateReference('PUR');

    const purchase=(
      await PackagePurchase.create([{
        userId,
        packageId:p._id,
        quantity,
        unitPrice:unit,
        totalAmount:total,
        reference:purchaseReference,
        idempotencyKey,

        status:'pending',

        purchasedAt:null,
        activatedAt:null,

        capitalRecoveryDays:recoveryDays,
        profitDurationDays:profitDays,
        investmentDays,

        capitalRecoveryAt:null,
        profitStartsAt:null,
        maturesAt:null,

        profitPercent,
        profitAmount,
        payoutAmount,

        paymentDepositId:null
      }],{session})
    )[0];

    const deposit=(
      await Deposit.create([{
        userId,
        amount:total,
        paymentMethod,
        reference:paymentReference,
        details:String(
          paymentInput.details??''
        ).trim(),
        receiptPath,
        depositType:'package',
        packagePurchaseId:purchase._id,
        status:'pending'
      }],{session})
    )[0];

    purchase.paymentDepositId=deposit._id;

    await purchase.save({session});

    return purchase;
  });
}
export async function matureDuePackages(){
  const now=new Date();

  /*
   * Capital recovery -> profit phase.
   */
  const recoveryDue=await PackagePurchase.find({
    status:'capital_recovery',
    profitStartsAt:{$lte:now}
  }).limit(500);

  let movedToProfit=0;

  for(const item of recoveryDue){
    const changed=await withTransaction(async session=>{
      const purchase=await PackagePurchase.findOne({
        _id:item._id,
        status:'capital_recovery',
        profitStartsAt:{$lte:now}
      }).session(session);

      if(!purchase){
        return false;
      }

      purchase.status='profit';
      await purchase.save({session});

      await audit({
        actorId:purchase.userId,
        action:'package.profit.start',
        targetType:'PackagePurchase',
        targetId:purchase._id.toString(),
        after:{
          status:'profit',
          profitStartsAt:purchase.profitStartsAt
        }
      },{session});

      return true;
    });

    if(changed){
      movedToProfit++;
    }
  }

  /*
   * Profit -> matured.
   *
   * The principal + configured profit is credited once.
   */
  const due=await PackagePurchase.find({
    status:'profit',
    maturesAt:{$lte:now}
  }).limit(500);

  let matured=0;

  for(const item of due){
    const changed=await withTransaction(async session=>{
      const purchase=await PackagePurchase.findOne({
        _id:item._id,
        status:'profit',
        maturesAt:{$lte:now}
      }).session(session);

      if(!purchase){
        return false;
      }

      purchase.status='matured';
      await purchase.save({session});

      const {ledgerEntry}=await import(
        './ledger.service.js'
      );

      const tx=await ledgerEntry({
        userId:purchase.userId,
        type:'profit',
        amount:purchase.payoutAmount,
        direction:'credit',
        reference:`PKG-MATURE-${purchase._id}`,
        description:'NFT package investment matured',
        relatedEntity:purchase._id,
        metadata:{
          packageId:purchase.packageId.toString(),
          principal:purchase.totalAmount,
          profitPercent:purchase.profitPercent,
          profitAmount:purchase.profitAmount,
          payoutAmount:purchase.payoutAmount,
          capitalRecoveryDays:purchase.capitalRecoveryDays,
          profitDurationDays:purchase.profitDurationDays,
          maturesAt:purchase.maturesAt
        }
      },{session});

      await audit({
        actorId:purchase.userId,
        action:'package.mature',
        targetType:'PackagePurchase',
        targetId:purchase._id.toString(),
        after:purchase.toObject(),
        metadata:{
          transactionId:tx.transactionId,
          payoutAmount:purchase.payoutAmount
        }
      },{session});

      return true;
    });

    if(changed){
      matured++;
    }
  }

  return {
    movedToProfit,
    matured
  };
}

