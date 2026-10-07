import mongoose,{Schema,model,Types} from 'mongoose';

const schema=new Schema({
  adminId:{type:Types.ObjectId,ref:'User',required:true,index:true},
  memberId:{type:Types.ObjectId,ref:'User',required:true,index:true},
  tokenHash:{type:String,required:true,unique:true,index:true},
  expiresAt:{type:Date,required:true,index:true},
  consumedAt:{type:Date,default:null,index:true}
},{timestamps:true});

schema.index({expiresAt:1},{expireAfterSeconds:0});

export const ImpersonationSession=mongoose.models.ImpersonationSession||model('ImpersonationSession',schema);
