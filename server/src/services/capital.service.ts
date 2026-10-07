import {CapitalLock} from '../models/CapitalLock.js'; import {AdminSettings} from '../models/AdminSettings.js'; import {ledgerEntry,withTransaction} from './ledger.service.js'; import {AppError} from '../utils/errors.js'; import {audit} from './audit.service.js'; import {capitalUnlockAt} from '../utils/financial-rules.js';

export async function createCapital(userId:any,amount:number,sourceReference:string,actorId?:any){
  return withTransaction(async session=>{
    const exists=await CapitalLock.exists({sourceReference}).session(session);if(exists)throw new AppError(409,'Capital already created for this reference');
    const settings=await AdminSettings.findOne({key:'global'}).session(session);const days=settings?.capitalLockDays??30;const createdAt=new Date();const unlockAt=capitalUnlockAt(createdAt,days);
    const c=(await CapitalLock.create([{userId,amount,createdAt,unlockAt,sourceReference}],{session}))[0];
    const tx=await ledgerEntry({userId,type:'capital',amount,direction:'credit',reference:`CAP-${c._id}`,description:'Capital recorded and locked',relatedEntity:c._id,adminActorId:actorId},{session});
    if(actorId)await audit({actorId,action:'capital.create',targetType:'CapitalLock',targetId:c._id.toString(),after:c.toObject(),metadata:{transactionId:tx.transactionId}},{session});
    return c;
  });
}

export async function unlockDueCapital(){
  const now=new Date();const due=await CapitalLock.find({status:'locked',unlockAt:{$lte:now}}).limit(500);
  let unlocked=0;
  for(const c of due){
    const changed=await withTransaction(async session=>{
      const current=await CapitalLock.findOne({_id:c._id,status:'locked',unlockAt:{$lte:now}}).session(session);if(!current)return false;
      current.status='unlocked';current.unlockedAt=new Date();await current.save({session});
      const move=await ledgerEntry({userId:current.userId,type:'capital',amount:current.amount,direction:'debit',reference:`CAP-UNLOCK-MOVE-${current._id}`,description:'Move capital from locked to available',relatedEntity:current._id},{session});
      const available=await ledgerEntry({userId:current.userId,type:'capital_unlock',amount:current.amount,direction:'credit',reference:`CAP-UNLOCK-${current._id}`,description:'Capital lock period completed',relatedEntity:current._id},{session});
      const systemActor=current.userId;
      await audit({actorId:systemActor,action:'capital.unlock',targetType:'CapitalLock',targetId:current._id.toString(),after:current.toObject(),metadata:{moveTransactionId:move.transactionId,unlockTransactionId:available.transactionId}},{session});
      return true;
    });
    if(changed)unlocked++;
  }
  return unlocked;
}
