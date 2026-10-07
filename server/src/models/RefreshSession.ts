import mongoose,{Schema,model,Types} from 'mongoose';
const schema=new Schema({userId:{type:Types.ObjectId,ref:'User',required:true,index:true},tokenHash:{type:String,required:true,unique:true,index:true},expiresAt:{type:Date,required:true,index:true},revokedAt:{type:Date,default:null,index:true},replacedBy:{type:Types.ObjectId,default:null}},{timestamps:true});
schema.index({expiresAt:1},{expireAfterSeconds:0});
export const RefreshSession=mongoose.models.RefreshSession||model('RefreshSession',schema);



