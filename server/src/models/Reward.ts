import mongoose,{Schema,model,Types} from 'mongoose';
const schema=new Schema({userId:{type:Types.ObjectId,ref:'User',required:true,index:true},amount:{type:Number,required:true,min:0},type:{type:String,required:true},reason:{type:String,required:true},sourceReference:{type:String,required:true,unique:true,index:true},status:{type:String,enum:['pending','completed','reversed'],default:'completed'},createdBy:{type:Types.ObjectId,ref:'User',required:true}},{timestamps:true}); schema.index({userId:1,createdAt:-1}); export const Reward=mongoose.models.Reward||model('Reward',schema);

