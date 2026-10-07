import {User} from '../models/User.js';
import {Commission} from '../models/Commission.js';
import {AdminSettings} from '../models/AdminSettings.js';
import {PackagePurchase} from '../models/PackagePurchase.js';
import {ledgerEntry} from './ledger.service.js';
import {audit} from './audit.service.js';
import {calculateCommission} from '../utils/financial-rules.js';
import mongoose from 'mongoose';

export async function getUpliners(userId:any){const out:any[]=[];let cur=await User.findById(userId).select('uplinerId').lean();for(let level=1;level<=3&&cur?.uplinerId;level++){const u=await User.findById(cur.uplinerId).select('_id username memberId fullName uplinerId').lean();if(!u)break;out.push({level,user:u});cur=u;}return out;}

export async function createCommissions(sourceUserId:any,businessAmount:number,sourceReference:string,session?:mongoose.ClientSession){
  const upliners=await getUpliners(sourceUserId);const settings=await AdminSettings.findOne({key:'global'}).session(session ?? null);
  const referralRates=settings?.referralRates;const rates=[referralRates?.level1??.1,referralRates?.level2??.02,referralRates?.level3??.01];const created=[];
  for(const item of upliners){
    const rate=rates[item.level-1];const amount=calculateCommission(businessAmount,rate);if(amount<=0)continue;
    const exists=await Commission.exists({beneficiaryId:item.user._id,sourceReference,level:item.level}).session(session ?? null);if(exists)continue;
    const c=(await Commission.create([{beneficiaryId:item.user._id,sourceUserId,level:item.level,businessAmount,rate,amount,sourceReference}],{session}))[0];
    const tx=await ledgerEntry({userId:item.user._id,type:'commission',amount,direction:'credit',reference:`COM-${c._id}`,description:`Level ${item.level} referral commission`,relatedEntity:c._id},{session:session!});
    c.transactionId=tx._id;await c.save({session});
    await audit({actorId:sourceUserId,action:'commission.create',targetType:'Commission',targetId:c._id.toString(),after:c.toObject(),metadata:{transactionId:tx.transactionId,beneficiaryId:item.user._id.toString()}},{session:session!});
    created.push(c);
  }
  return created;
}

async function enrich(users:any[],level:number){if(!users.length)return users;const ids=users.map(u=>u._id);const [business,commissions]=await Promise.all([PackagePurchase.aggregate([{$match:{userId:{$in:ids},status:'completed'}},{$group:{_id:'$userId',amount:{$sum:'$totalAmount'}}}]),Commission.aggregate([{$match:{beneficiaryId:{$in:ids},level}},{$group:{_id:'$beneficiaryId',amount:{$sum:'$amount'}}}])]);const bm=new Map(business.map(x=>[x._id.toString(),Number(x.amount)]));const cm=new Map(commissions.map(x=>[x._id.toString(),Number(x.amount)]));return users.map(u=>({...u,business:bm.get(u._id.toString())??0,commission:cm.get(u._id.toString())??0}));}
export async function teamStats(userId:any){const l1=await User.find({uplinerId:userId}).select('username memberId fullName').lean();const l2=await User.find({uplinerId:{$in:l1.map(x=>x._id)}}).select('username memberId fullName uplinerId').lean();const l3=await User.find({uplinerId:{$in:l2.map(x=>x._id)}}).select('username memberId fullName uplinerId').lean();const [level1,level2,level3]=await Promise.all([enrich(l1,1),enrich(l2,2),enrich(l3,3)]);const all=[...level1,...level2,...level3];return {level1,level2,level3,total:all.length,totalBusiness:all.reduce((s,u)=>s+u.business,0),totalCommission:all.reduce((s,u)=>s+u.commission,0),levelBusiness:{level1:level1.reduce((s,u)=>s+u.business,0),level2:level2.reduce((s,u)=>s+u.business,0),level3:level3.reduce((s,u)=>s+u.business,0)},levelCommission:{level1:level1.reduce((s,u)=>s+u.commission,0),level2:level2.reduce((s,u)=>s+u.commission,0),level3:level3.reduce((s,u)=>s+u.commission,0)}};}


