import mongoose,{Schema,model,Types} from 'mongoose';
const schema=new Schema({transactionId:{type:String,required:true,unique:true,index:true},userId:{type:Types.ObjectId,ref:'User',required:true,index:true},type:{type:String,required:true,index:true},amount:{type:Number,required:true,min:0},direction:{type:String,enum:['credit','debit'],required:true},status:{type:String,enum:['pending','completed','rejected','reversed'],default:'completed',index:true},reference:{type:String,required:true,index:true,unique:true},description:{type:String,required:true},relatedEntity:{type:Types.ObjectId,default:null},adminActorId:{type:Types.ObjectId,ref:'User',default:null},metadata:{type:Schema.Types.Mixed,default:{}}},{timestamps:true});
schema.index({userId:1,createdAt:-1}); schema.index({type:1,status:1,createdAt:-1});
export const Transaction=mongoose.models.Transaction||model('Transaction',schema);

