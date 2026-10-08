import {ClientSession} from 'mongoose';
import {CapitalLock} from '../models/CapitalLock.js';
import {AdminSettings} from '../models/AdminSettings.js';
import {ledgerEntry,withTransaction,money} from './ledger.service.js';
import {AppError} from '../utils/errors.js';
import {audit} from './audit.service.js';

export async function createCapital(userId:any,amount:number,sourceReference:string,actorId?:any,existingSession?:ClientSession){
  const work=async(session:ClientSession)=>{
    const exists=await CapitalLock.exists({sourceReference}).session(session);
    if(exists)throw new AppError(409,'Capital already created for this reference');
    const settings=await AdminSettings.findOne({key:'global'}).session(session);
    const dailyProfitPercent=Number(settings?.dailyProfitPercent??1);
    const createdAt=new Date();
    const nextProfitAt=new Date(createdAt.getTime()+86400000);
    const c=(await CapitalLock.create([{userId,amount:money(amount),createdAt,unlockAt:new Date('2099-12-31T23:59:59.999Z'),dailyProfitPercent,nextProfitAt,status:'locked',sourceReference}],{session}))[0];
    await ledgerEntry({userId,type:'capital',amount:money(amount),direction:'credit',reference:`CAP-${c._id}`,description:'Approved deposit converted to permanently locked capital',relatedEntity:c._id,adminActorId:actorId},{session});
    if(actorId)await audit({actorId,action:'capital.create',targetType:'CapitalLock',targetId:c._id.toString(),after:c.toObject()},{session});
    return c;
  };
  return existingSession?work(existingSession):withTransaction(work);
}

export async function accrueDueCapitalProfits(){
  const now=new Date();
  const due=await CapitalLock.find({status:'locked',nextProfitAt:{$lte:now},dailyProfitPercent:{$gt:0}}).limit(500);
  for(const item of due){
    await withTransaction(async session=>{
      const c=await CapitalLock.findOne({_id:item._id,status:'locked',nextProfitAt:{$lte:now},dailyProfitPercent:{$gt:0}}).session(session);
      if(!c)return;
      const cycleAt=new Date(c.nextProfitAt);
      const profit=money(Number(c.amount)*Number(c.dailyProfitPercent)/100);
      if(profit>0)await ledgerEntry({userId:c.userId,type:'profit',amount:profit,direction:'credit',reference:`CAP-PROFIT-${c._id}-${cycleAt.getTime()}`,description:`Daily capital profit (${Number(c.dailyProfitPercent)}%)`,relatedEntity:c._id},{session});
      c.totalProfitAccrued=money(Number(c.totalProfitAccrued??0)+profit);
      c.lastProfitAt=cycleAt;
      c.nextProfitAt=new Date(cycleAt.getTime()+86400000);
      await c.save({session});
    });
  }
  return due.length;
}

export async function unlockDueCapital(){return 0;}