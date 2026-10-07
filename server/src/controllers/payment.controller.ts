import mongoose from 'mongoose';
import {Request,Response} from 'express';
import bcrypt from 'bcryptjs';
import {User} from '../models/User.js';
import {PaymentChangeRequest} from '../models/PaymentChangeRequest.js';
import {ok} from '../utils/api.js';
import {AppError} from '../utils/errors.js';
import {audit} from '../services/audit.service.js';
import {decryptField,encryptField} from '../utils/secret-fields.js';
import {withTransaction} from '../services/ledger.service.js';

export async function paymentDetails(req:Request,res:Response){
  const u=await User.findById(req.auth!.userId).select('paymentDetails').lean();
  const custom=Array.isArray(u?.paymentDetails?.customMethods)?u.paymentDetails.customMethods.map((m:any)=>({
    name:String(m.name??''),
    number:m.number?mask(decryptField(m.number)):'',
    title:String(m.title??'')
  })):[];

  return ok(res,{
    jazzCash:u?.paymentDetails?.jazzCash?mask(decryptField(u.paymentDetails.jazzCash)):'',
    easypaisa:u?.paymentDetails?.easypaisa?mask(decryptField(u.paymentDetails.easypaisa)):'',
    customMethods:custom
  });
}

export async function requestPaymentChange(req:Request,res:Response){
  const u=await User.findById(req.auth!.userId);
  if(!u)throw new AppError(404,'Account not found');
  if(!(await bcrypt.compare(req.body.currentPassword,u.passwordHash)))throw new AppError(401,'Current password is incorrect');

  const customMethods=Array.isArray(req.body.customMethods)?req.body.customMethods.map((m:any)=>({
    name:String(m.name??'').trim(),
    number:encryptField(String(m.number??'')),
    title:String(m.title??'').trim()
  })).filter((m:any)=>m.name&&String(m.number??'')):[];

  const r=await withTransaction(async session=>{
    const pending=await PaymentChangeRequest.findOne({userId:u._id,status:'pending'}).session(session);
    if(pending)throw new AppError(409,'A payment detail change is already pending');

    const created=(await PaymentChangeRequest.create([{
      userId:u._id,
      jazzCash:encryptField(req.body.jazzCash??''),
      easypaisa:encryptField(req.body.easypaisa??''),
      customMethods
    }],{session}))[0];

    await audit({
      actorId:u._id,
      action:'payment.change_request',
      targetType:'PaymentChangeRequest',
      targetId:created._id.toString(),
      after:{status:created.status},
      ip:req.ip,
      userAgent:req.get('user-agent')??undefined
    },{session});

    return created;
  });

  return ok(res,{_id:r._id,status:r.status,reason:r.reason,createdAt:r.createdAt},'Payment detail change submitted for verification',201);
}

export async function myPaymentRequests(req:Request,res:Response){
  const rows=await PaymentChangeRequest.find({userId:req.auth!.userId}).select('_id status reason reviewedAt createdAt').sort({createdAt:-1}).limit(20).lean();
  return ok(res,rows);
}

export async function reviewPaymentChange(req:Request,res:Response){
  const paymentChangeId=req.params.id as string;
  if(!mongoose.isValidObjectId(paymentChangeId))throw new AppError(400,'Invalid payment change identifier');

  return withTransaction(async session=>{
    const r=await PaymentChangeRequest.findOne({_id:paymentChangeId,status:'pending'}).select({
      jazzCash:1,easypaisa:1,customMethods:1,status:1,userId:1,reason:1,reviewedBy:1,reviewedAt:1
    }).session(session);

    if(!r)throw new AppError(404,'Pending payment change not found');

    r.status=req.body.approve?'approved':'rejected';
    r.reason=req.body.reason??'';
    r.reviewedBy=new mongoose.Types.ObjectId(req.auth!.userId);
    r.reviewedAt=new Date();

    if(r.status==='approved'){
      const user=await User.findById(r.userId).session(session);
      if(!user)throw new AppError(404,'Member account not found');

      user.paymentDetails={
        jazzCash:r.jazzCash?encryptField(decryptField(r.jazzCash)):encryptField(''),
        easypaisa:r.easypaisa?encryptField(decryptField(r.easypaisa)):encryptField(''),
        customMethods:(Array.isArray(r.customMethods)?r.customMethods.map((m:any)=>({
          name:String(m.name??'').trim(),
          number:m.number?encryptField(decryptField(m.number)):encryptField(''),
          title:String(m.title??'').trim()
        })).filter((m:any)=>m.name&&m.number):[]) as any
      };

      await user.save({session});
    }

    await r.save({session});

    await audit({
      actorId:req.auth!.userId,
      action:r.status==='approved'?'payment.change_approve':'payment.change_reject',
      targetType:'PaymentChangeRequest',
      targetId:r._id.toString(),
      after:{status:r.status,reason:r.reason},
      ip:req.ip,
      userAgent:req.get('user-agent')??undefined
    },{session});

    return ok(res,{_id:r._id,status:r.status,reason:r.reason,reviewedAt:r.reviewedAt},'Payment change reviewed');
  });
}

function mask(value:string){
  if(value.length<=4)return '\u2022\u2022\u2022\u2022';
  return '\u2022\u2022\u2022\u2022'+value.slice(-4);
}

