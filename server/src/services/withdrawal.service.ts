import {Withdrawal} from '../models/Withdrawal.js';
import {AdminSettings} from '../models/AdminSettings.js';
import {Wallet} from '../models/Wallet.js';
import {
  ledgerEntry,
  withTransaction,
  money,
  availableOf
} from './ledger.service.js';
import {AppError} from '../utils/errors.js';
import {AuditLog} from '../models/AuditLog.js';
import {PlatformLedger} from '../models/PlatformLedger.js';
import {generateReference} from './deposit.service.js';
import {User} from '../models/User.js';
import {decryptField} from '../utils/secret-fields.js';
import {calculateWithdrawal} from '../utils/financial-rules.js';
import {Transaction} from '../models/Transaction.js';

export async function createWithdrawal(userId:any,input:any){
  return withTransaction(async session=>{
    const existing=await Withdrawal.findOne({
      userId,
      idempotencyKey:input.idempotencyKey
    }).session(session);

    if(existing) return existing;

    const settings=await AdminSettings.findOne({
      key:'global'
    }).session(session);

    if(settings&&!settings.withdrawalsEnabled){
      throw new AppError(
        403,
        settings.withdrawalDisabledMessage
      );
    }

    const amount=money(Number(input.amount));

    const minimum=Math.max(10,Number(settings?.minimumWithdrawal??10));
    const maximum=settings?.maximumWithdrawal??100000000;

    if(amount<minimum){
      throw new AppError(
        422,
        `Minimum withdrawal is ${minimum}`
      );
    }

    if(amount>maximum){
      throw new AppError(
        422,
        `Maximum withdrawal is ${maximum}`
      );
    }

    const method=String(
      input.paymentMethod??''
    ).trim();

    const pd:any=settings?.paymentDetails??{};

    /*
     * BEP20 is member-entered.
     * Legacy methods still use the verified saved account.
     */
    let paymentAccount='';

    if(method==='BEP20'){
      if(pd.bep20Active===false){
        throw new AppError(
          403,
          'BEP20 withdrawals are currently unavailable'
        );
      }

      paymentAccount=String(
        input.paymentAccount??''
      ).trim();

      if(paymentAccount.length<10){
        throw new AppError(
          422,
          'A valid BEP20 withdrawal address is required'
        );
      }

      if(paymentAccount.length>120){
        throw new AppError(
          422,
          'BEP20 withdrawal address is too long'
        );
      }
    }else{
      const user=await User.findById(userId)
        .select('paymentDetails withdrawalCooldownUntil')
        .session(session);

      if(!user){
        throw new AppError(404,'Account not found');
      }

      let saved='';

      if(method==='JazzCash'){
        if(pd.jazzCashActive===false){
          throw new AppError(
            403,
            'JazzCash withdrawals are currently unavailable'
          );
        }

        saved=user.paymentDetails?.jazzCash??'';
      }else if(method==='Easypaisa'){
        if(pd.easypaisaActive===false){
          throw new AppError(
            403,
            'Easypaisa withdrawals are currently unavailable'
          );
        }

        saved=user.paymentDetails?.easypaisa??'';
      }else{
        const custom=Array.isArray(pd.customMethods)
          ?pd.customMethods.find(
            (m:any)=>String(m.name??'').trim()===method
          )
          :null;

        if(!custom||custom.active===false){
          throw new AppError(
            403,
            'This withdrawal method is currently unavailable'
          );
        }

        saved=(
          Array.isArray(user.paymentDetails?.customMethods)
            ?user.paymentDetails.customMethods.find(
              (m:any)=>String(m.name??'').trim()===method
            )?.number
            :''
        )??'';
      }

      paymentAccount=decryptField(saved);

      if(!paymentAccount){
        throw new AppError(
          422,
          'A verified payment account is required'
        );
      }
    }

    /*
     * Validate balance BEFORE changing cooldown.
     * This prevents failed withdrawal requests from consuming cooldown.
     */
    const wallet=await Wallet.findOne({
      userId
    }).session(session);

    if(!wallet||availableOf(wallet as any)<amount){
      throw new AppError(
        422,
        'Insufficient available profit balance'
      );
    }

    const feePct=settings?.withdrawalFeePercent??10;
    const calc=calculateWithdrawal(amount,feePct);

    const fee=money(calc.fee);
    const net=money(calc.net);

    const now=new Date();
    const cooldownHours=settings?.withdrawalCooldownHours??24;

    const user=await User.findOneAndUpdate(
      {
        _id:userId,
        $or:[
          {withdrawalCooldownUntil:null},
          {withdrawalCooldownUntil:{$lte:now}}
        ]
      },
      {
        $set:{
          withdrawalCooldownUntil:
            new Date(now.getTime()+cooldownHours*3600000)
        }
      },
      {
        new:true,
        session
      }
    );

    if(!user){
      throw new AppError(
        429,
        'Withdrawal cooldown is active'
      );
    }

    const w=(
      await Withdrawal.create([{
        userId,
        requestedAmount:amount,
        feeAmount:fee,
        netAmount:net,
        paymentMethod:method,
        paymentAccount,
        status:'pending',
        reference:generateReference('WD'),
        idempotencyKey:input.idempotencyKey,
        requestedAt:now
      }],{session})
    )[0];

    /*
     * IMPORTANT:
     * This only RESERVES the requested amount.
     * It does NOT remove the amount from the member's actual
     * balance yet.
     */
    await ledgerEntry({
      userId,
      type:'withdrawal',
      amount,
      direction:'debit',
      status:'pending',
      reference:'WD-RES-'+w._id,
      description:'Withdrawal amount reserved pending admin approval',
      relatedEntity:w._id
    },{session});

    return w;
  });
}

export async function processWithdrawal(
  id:string,
  adminId:any,
  approve:boolean,
  note='',
  meta?:{ip?:string;userAgent?:string}
){
  return withTransaction(async session=>{
    const w=await Withdrawal.findOne({
      _id:id,
      status:'pending'
    }).session(session);

    if(!w){
      throw new AppError(
        404,
        'Pending withdrawal not found'
      );
    }

    const reservation=await Transaction.findOne({
      reference:'WD-RES-'+w._id
    }).session(session);

    if(!reservation){
      throw new AppError(
        409,
        'Withdrawal reservation transaction not found'
      );
    }

    w.processedBy=adminId;
    w.processedAt=new Date();
    w.adminNote=note;

    if(!approve){
      /*
       * Reservation is released.
       * No second balance credit is required because the original
       * reservation never removed the member's actual balance.
       */
      reservation.status='reversed';
      reservation.adminActorId=adminId;
      await reservation.save({session});

      await ledgerEntry({
        userId:w.userId,
        type:'withdrawal',
        amount:w.requestedAmount,
        direction:'credit',
        reference:'WD-REV-'+w._id,
        description:'Rejected withdrawal reservation released',
        relatedEntity:w._id,
        adminActorId:adminId
      },{session});

      w.status='rejected';
      await w.save({session});
    }else{
      /*
       * APPROVAL:
       * Do NOT call debitAvailable().
       *
       * The amount was already reserved at request time.
       * Now remove the reservation and permanently deduct the
       * requested amount from the member wallet exactly once.
       */
      const wallet=await Wallet.findOne({
        userId:w.userId
      }).session(session);

      if(!wallet){
        throw new AppError(
          404,
          'Member wallet not found'
        );
      }

      if(wallet.withdrawalReserved<w.requestedAmount){
        throw new AppError(
          409,
          'Withdrawal reservation is invalid'
        );
      }

      /*
       * Convert reservation into final withdrawal.
       * We remove the reserved amount and deduct from the
       * actual balance fields in one transaction.
       */
      /*
       * Withdrawals are PROFIT-WALLET ONLY.
       * Locked capital, deposit, commission and rewards must never
       * be used to fund a withdrawal.
       */
      const fields=['profit','commission','rewards','capitalAvailable'];

      let remaining=money(w.requestedAmount);

      for(const field of fields){
        const current=Number(
          (wallet as any)[field]??0
        );

        const take=Math.min(
          current,
          remaining
        );

        (wallet as any)[field]=money(
          current-take
        );

        remaining=money(
          remaining-take
        );

        if(remaining<=0){
          break;
        }
      }

      if(remaining>0){
        throw new AppError(
          422,
          'Insufficient balance at withdrawal approval'
        );
      }

      wallet.withdrawalReserved=money(
        Math.max(
          0,
          wallet.withdrawalReserved-w.requestedAmount
        )
      );

      wallet.withdrawn=money(
        Number(wallet.withdrawn??0)+w.requestedAmount
      );

      wallet.version+=1;

      await wallet.save({session});

      reservation.status='completed';
      reservation.adminActorId=adminId;
      await reservation.save({session});

      if(w.feeAmount>0){
        await PlatformLedger.create([{
          transactionId:'PLAT-'+w._id,
          type:'withdrawal_fee',
          amount:w.feeAmount,
          reference:'WD-FEE-'+w._id,
          description:'Withdrawal fee',
          userId:w.userId,
          adminActorId:adminId
        }],{session});
      }

      w.status='approved';
      await w.save({session});
    }

    await AuditLog.create([{
      actorId:adminId,
      action:approve
        ?'withdrawal.approve'
        :'withdrawal.reject',
      targetType:'Withdrawal',
      targetId:w._id.toString(),
      after:{
        status:w.status,
        requestedAmount:w.requestedAmount,
        fee:w.feeAmount,
        net:w.netAmount,
        paymentMethod:w.paymentMethod,
        paymentAccount:w.paymentAccount
      },
      metadata:{
        note
      },
      ip:meta?.ip,
      userAgent:meta?.userAgent
    }],{session});

    return w;
  });
}


