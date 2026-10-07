import mongoose,{Schema,model,Types} from 'mongoose';
const schema=new Schema({userId:{type:Types.ObjectId,ref:'User',required:true,index:true},packageId:{type:Types.ObjectId,ref:'Package',required:true,index:true},quantity:{type:Number,required:true,min:1},unitPrice:{type:Number,required:true,min:0},totalAmount:{type:Number,required:true,min:0},reference:{type:String,required:true,unique:true,index:true},idempotencyKey:{type:String,required:true,unique:true,index:true},status:{type:String,enum:['completed','matured','refunded'],default:'completed'},purchasedAt:{type:Date,default:Date.now},maturesAt:{type:Date,default:null},profitPercent:{type:Number,default:0,min:0},profitAmount:{type:Number,default:0,min:0},payoutAmount:{type:Number,default:0,min:0}},{timestamps:true}); schema.index({userId:1,purchasedAt:-1}); export const PackagePurchase=mongoose.models.PackagePurchase||model('PackagePurchase',schema);



