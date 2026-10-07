import {Request,Response} from 'express';
import {ok} from '../utils/api.js';
import {Reward} from '../models/Reward.js';
import {User} from '../models/User.js';
import {AppError} from '../utils/errors.js';
import {ledgerEntry,withTransaction} from '../services/ledger.service.js';
import {createCapital} from '../services/capital.service.js';
import {audit} from '../services/audit.service.js';

export async function addReward(req:Request,res:Response){
  const member=await User.findOne({_id:req.body.userId,role:'member'}).select('_id').lean();if(!member)throw new AppError(404,'Member not found');
  const r=await withTransaction(async session=>{
    const reward=(await Reward.create([{...req.body,createdBy:req.auth!.userId}],{session}))[0];
    const tx=await ledgerEntry({userId:req.body.userId,type:'reward',amount:req.body.amount,direction:'credit',reference:`REWARD-${reward._id}`,description:req.body.reason,relatedEntity:reward._id,adminActorId:req.auth!.userId,metadata:{sourceReference:req.body.sourceReference}},{session});
    await audit({actorId:req.auth!.userId,action:'reward.create',targetType:'Reward',targetId:reward._id.toString(),after:reward.toObject(),metadata:{transactionId:tx.transactionId}},{session});
    return reward;
  });
  return ok(res,r,'Reward added',201);
}

export async function addProfit(req:Request,res:Response){
  const member=await User.findOne({_id:req.body.userId,role:'member'}).select('_id').lean();if(!member)throw new AppError(404,'Member not found');
  const result=await withTransaction(async session=>{
    const tx=await ledgerEntry({userId:req.body.userId,type:'profit',amount:req.body.amount,direction:'credit',reference:`PROFIT-${req.body.sourceReference}`,description:req.body.reason,adminActorId:req.auth!.userId,metadata:{sourceReference:req.body.sourceReference}},{session});
    await audit({actorId:req.auth!.userId,action:'profit.create',targetType:'Transaction',targetId:tx._id.toString(),after:tx.toObject()},{session});
    return tx;
  });
  return ok(res,result,'Profit credited',201);
}

export async function addCapital(req:Request,res:Response){
  const member=await User.findOne({_id:req.body.userId,role:'member'}).select('_id').lean();if(!member)throw new AppError(404,'Member not found');
  const c=await createCapital(req.body.userId,req.body.amount,req.body.sourceReference,req.auth!.userId);
  return ok(res,c,'Capital created',201);
}

export async function rewardsForMember(req:Request,res:Response){return ok(res,await Reward.find({userId:req.auth!.userId}).sort({createdAt:-1}).limit(100).lean());}
