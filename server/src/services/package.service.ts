import mongoose from 'mongoose'; import {PackageModel} from '../models/Package.js'; import {PackagePurchase} from '../models/PackagePurchase.js'; import {ledgerEntry,withTransaction,money} from './ledger.service.js'; import {AppError} from '../utils/errors.js'; import {createCommissions} from './referral.service.js'; import {audit} from './audit.service.js';
export async function listPackages(){return PackageModel.find({active:true}).sort({createdAt:-1}).lean();}
export async function matureDuePackages(){
  const now=new Date();
  const due=await PackagePurchase.find({status:'completed',maturesAt:{$lte:now}}).limit(500);
  let matured=0;
  for(const item of due){
    const changed=await withTransaction(async session=>{
      const purchase=await PackagePurchase.findOne({_id:item._id,status:'completed',maturesAt:{$lte:now}}).session(session);
      if(!purchase)return false;
      purchase.status='matured';
      await purchase.save({session});
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
          maturesAt:purchase.maturesAt
        }
      },{session});
      await audit({
        actorId:purchase.userId,
        action:'package.mature',
        targetType:'PackagePurchase',
        targetId:purchase._id.toString(),
        after:purchase.toObject(),
        metadata:{transactionId:tx.transactionId,payoutAmount:purchase.payoutAmount}
      },{session});
      return true;
    });
    if(changed)matured++;
  }
  return matured;
}
export async function purchasePackage(userId:any,packageId:string,quantity:number,idempotencyKey:string){return withTransaction(async session=>{const existing=await PackagePurchase.findOne({userId,idempotencyKey}).session(session);if(existing)return existing;const p=await PackageModel.findOne({_id:packageId,active:true}).session(session);if(!p)throw new AppError(404,'Package not found');if(p.remainingQuantity<quantity)throw new AppError(409,'Insufficient package availability');const now=new Date();if(p.startDate&&now<p.startDate)throw new AppError(409,'Package sale has not started');if(p.endDate&&now>p.endDate)throw new AppError(409,'Package sale has ended');const unit=money(p.salePrice??p.price),total=money(unit*quantity),profitPercent=Number(p.profitPercent??0),profitAmount=money(total*profitPercent/100),payoutAmount=money(total+profitAmount),investmentDays=Math.max(1,Number(p.investmentDays??30)),maturesAt=new Date(now.getTime()+investmentDays*24*60*60*1000);const reference=`PUR-${new mongoose.Types.ObjectId()}`;const updated=await PackageModel.findOneAndUpdate({_id:p._id,active:true,remainingQuantity:{$gte:quantity}},{$inc:{remainingQuantity:-quantity}},{new:true,session});if(!updated)throw new AppError(409,'Package sold out during purchase');const purchase=(await PackagePurchase.create([{userId,packageId,quantity,unitPrice:unit,totalAmount:total,reference,idempotencyKey,maturesAt,profitPercent,profitAmount,payoutAmount}],{session}))[0];const tx=await ledgerEntry({userId,type:'package_purchase',amount:total,direction:'debit',reference:`PUR-${purchase._id}`,description:`Purchase of ${p.name}`,relatedEntity:purchase._id},{session});await createCommissions(userId,total,reference,session);await audit({actorId:userId,action:'package.purchase',targetType:'PackagePurchase',targetId:purchase._id.toString(),after:purchase.toObject(),metadata:{transactionId:tx.transactionId,packageId:p._id.toString(),remainingQuantity:updated.remainingQuantity}},{session});return purchase;});}


