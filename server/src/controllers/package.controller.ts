import {purchasePackageFromWallet} from '../services/package.service.js';
import {Request,Response} from 'express';
import {audit} from '../services/audit.service.js'; import {ok} from '../utils/api.js'; import {PackageModel} from '../models/Package.js'; import {PackagePurchase} from '../models/PackagePurchase.js'; import {purchasePackage} from '../services/package.service.js'; import {AppError} from '../utils/errors.js';
export async function listPackagesController(_req:Request,res:Response){return ok(res,await import('../services/package.service.js').then(x=>x.listPackages()));}
export async function purchaseWalletController(req: Request, res: Response) {
  const userId = req.auth?.userId;
  if (!userId) throw new AppError(401, 'Authentication required');
  const {quantity, idempotencyKey} = req.body;
  const purchase = await purchasePackageFromWallet(userId, String(req.params.id), Number(quantity), String(idempotencyKey));
  return ok(res, purchase);
}
export async function purchasesController(req:Request,res:Response){
  const userId=req.auth!.userId;
  const purchases=await PackagePurchase.find({userId})
    .populate('packageId')
    .sort({createdAt:-1})
    .lean();

  const {Transaction}=await import('../models/Transaction.js');
  const {Types}=await import('mongoose');
  const userObjectId=new Types.ObjectId(String(userId));
  const purchaseIds=purchases.map((p:any)=>p._id);

  const profitRows=await Transaction.aggregate([
    {
      $match:{
        userId:userObjectId,
        type:'profit',
        direction:'credit',
        status:'completed',
        relatedEntity:{$in:purchaseIds}
      }
    },
    {
      $group:{
        _id:'$relatedEntity',
        earnedProfit:{$sum:'$amount'}
      }
    }
  ]);

  const profitByPurchase=new Map(
    profitRows.map((row:any)=>[
      String(row._id),
      Number(row.earnedProfit??0)
    ])
  );

  const result=purchases.map((p:any)=>({
    ...p,
    earnedProfit:Number(profitByPurchase.get(String(p._id))??0)
  }));

  return ok(res,result);
}
export async function purchaseController(req:Request,res:Response){
  const receiptPath=req.file?.filename??null;

  if(!receiptPath){
    throw new AppError(
      422,
      'Payment receipt is required'
    );
  }

  return ok(
    res,
    await purchasePackage(
      req.auth!.userId,
      String(req.params.id),
      Number(req.body.quantity??1),
      String(req.body.idempotencyKey),
      'BEP20',
      {
        amount:Number(req.body.amount),
        reference:String(
          req.body.reference??''
        ).trim(),
        details:String(
          req.body.details??''
        ).trim(),
        receiptPath
      }
    ),
    'NFT payment submitted for admin verification',
    201
  );
}
export async function adminPackages(_req:Request,res:Response){return ok(res,await PackageModel.find().sort({createdAt:-1}).lean());}
export async function adminCreatePackage(req:Request,res:Response){const p=await PackageModel.create({...req.body,remainingQuantity:req.body.quantity,investmentDays:req.body.investmentDays??90,capitalRecoveryDays:req.body.capitalRecoveryDays??45,profitDurationDays:req.body.profitDurationDays??45,profitPercent:req.body.profitPercent??0});await audit({actorId:req.auth!.userId,action:'package.create',targetType:'Package',targetId:p._id.toString(),after:p.toObject()});return ok(res,p,'Package created',201);}
export async function adminUpdatePackage(req:Request,res:Response){const before=await PackageModel.findById(String(req.params.id)).lean();if(!before)throw new AppError(404,'Package not found');if(req.body.quantity!=null && req.body.quantity<before.quantity-before.remainingQuantity)throw new AppError(422,'Quantity cannot be below units already sold');const p=await PackageModel.findByIdAndUpdate(String(req.params.id),{$set:req.body},{new:true,runValidators:true});if(!p)throw new AppError(404,'Package not found');if(req.body.quantity!=null && req.body.remainingQuantity==null){p.remainingQuantity=req.body.quantity-(before.quantity-before.remainingQuantity);await p.save();}await audit({actorId:req.auth!.userId,action:'package.update',targetType:'Package',targetId:p._id.toString(),before,after:p.toObject()});return ok(res,p,'Package updated');}
export async function adminPackageStatus(req:Request,res:Response){const active=req.body?.active;if(typeof active!=='boolean')throw new AppError(400,'active must be boolean');const before=await PackageModel.findById(String(req.params.id)).lean();if(!before)throw new AppError(404,'Package not found');const p=await PackageModel.findByIdAndUpdate(String(req.params.id),{$set:{active}},{new:true});await audit({actorId:req.auth!.userId,action:'package.status',targetType:'Package',targetId:p!._id.toString(),before,after:p!.toObject()});return ok(res,p,'Package status updated');}
export async function adminPackageInventory(req:Request,res:Response){const quantity=Number(req.body?.quantity);if(!Number.isInteger(quantity)||quantity<0)throw new AppError(400,'Quantity must be a non-negative integer');const p=await PackageModel.findById(String(req.params.id));if(!p)throw new AppError(404,'Package not found');const sold=p.quantity-p.remainingQuantity;if(quantity<sold)throw new AppError(422,'Quantity cannot be below units already sold');const before=p.toObject();p.quantity=quantity;p.remainingQuantity=quantity-sold;await p.save();await audit({actorId:req.auth!.userId,action:'package.inventory',targetType:'Package',targetId:p._id.toString(),before,after:p.toObject()});return ok(res,p,'Inventory updated');}




