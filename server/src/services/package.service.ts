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
   * Package daily-profit job.
   *
   * Every package gets one profit cycle per 24 hours.
   * The daily profit is:
   *
   * totalAmount * profitPercent / 100
   *
   * Principal is never credited here.
   *
   * A unique transaction reference is generated for every
   * cycle so the same cycle cannot be credited twice.
   */
  const due=await PackagePurchase.find({
    status:'active',
    nextProfitAt:{$lte:now}
  }).limit(500);

  let credited=0;
  let matured=0;

  for(const item of due){

    const result=await withTransaction(async session=>{

      const purchase=await PackagePurchase.findOne({
        _id:item._id,
        status:'active',
        nextProfitAt:{$lte:now}
      }).session(session);

      if(!purchase){
        return {
          credited:0,
          matured:false
        };
      }

      const activatedAt=
        purchase.activatedAt ??
        purchase.purchasedAt ??
        purchase.createdAt;

      if(!activatedAt){
        return {
          credited:0,
          matured:false
        };
      }

      const cycleLength=86400000;

      const totalCycles=Math.max(
        1,
        Number(purchase.investmentDays??1)
      );

      const elapsedCycles=Math.floor(
        (
          now.getTime()-
          new Date(activatedAt).getTime()
        )/
        cycleLength
      );

      const dueCycles=Math.min(
        totalCycles,
        Math.max(0,elapsedCycles)
      );

      let cyclesCredited=Number(
        purchase.profitCyclesCredited??0
      );

      const dailyProfitAmount=money(
        Number(
          purchase.dailyProfitAmount ??
          (
            Number(purchase.totalAmount)*
            Number(purchase.profitPercent??0)/100
          )
        )
      );

      let creditedThisRun=0;

      const {ledgerEntry}=await import(
        './ledger.service.js'
      );

      const {Transaction}=await import(
        '../models/Transaction.js'
      );

      while(cyclesCredited<dueCycles){

        const cycleNumber=cyclesCredited+1;

        const reference=
          `PKG-DAILY-${purchase._id}-${cycleNumber}`;

        /*
         * Transaction.reference is unique.
         * This check makes the operation safe if the job
         * encounters a previously-created cycle.
         */
        const existing=await Transaction.findOne({
          reference
        }).session(session);

        if(!existing && dailyProfitAmount>0){

          await ledgerEntry({
            userId:purchase.userId,
            type:'profit',
            amount:dailyProfitAmount,
            direction:'credit',
            reference,
            description:
              `Package daily profit - cycle ${cycleNumber}`,
            relatedEntity:purchase._id,
            metadata:{
              packageId:purchase.packageId.toString(),
              packagePurchaseId:purchase._id.toString(),
              cycleNumber,
              dailyProfitPercent:purchase.profitPercent,
              dailyProfitAmount,
              activatedAt,
              cycleDueAt:new Date(
                new Date(activatedAt).getTime()+
                cycleNumber*cycleLength
              ),
              maturesAt:purchase.maturesAt
            }
          },{session});

          creditedThisRun++;
        }

        cyclesCredited=cycleNumber;
      }

      purchase.profitCyclesCredited=cyclesCredited;

      if(cyclesCredited>0){

        purchase.lastProfitAt=new Date(
          new Date(activatedAt).getTime()+
          cyclesCredited*cycleLength
        );

        purchase.nextProfitAt=new Date(
          new Date(activatedAt).getTime()+
          (cyclesCredited+1)*cycleLength
        );
      }

      let becameMatured=false;

      if(
        purchase.maturesAt &&
        now>=purchase.maturesAt &&
        cyclesCredited>=totalCycles
      ){

        purchase.status='matured';
        purchase.nextProfitAt=null;

        becameMatured=true;
      }

      await purchase.save({session});

      await audit({
        actorId:purchase.userId,
        action:
          creditedThisRun>0
            ? 'package.daily_profit'
            : becameMatured
              ? 'package.mature'
              : 'package.daily_profit.check',
        targetType:'PackagePurchase',
        targetId:purchase._id.toString(),
        after:{
          status:purchase.status,
          dailyProfitAmount,
          profitCyclesCredited:purchase.profitCyclesCredited,
          lastProfitAt:purchase.lastProfitAt,
          nextProfitAt:purchase.nextProfitAt,
          maturesAt:purchase.maturesAt
        },
        metadata:{
          creditedCycles:creditedThisRun
        }
      },{session});

      return {
        credited:creditedThisRun,
        matured:becameMatured
      };
    });

    credited+=result.credited;

    if(result.matured){
      matured++;
    }
  }

  return {
    credited,
    matured
  };
}

