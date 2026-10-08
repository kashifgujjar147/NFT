import mongoose,{Schema,model,Types} from 'mongoose'; const schema=new Schema({userId:{type:Types.ObjectId,ref:'User',required:true,index:true},amount:{type:Number,required:true,min:0},
 dailyProfitPercent:{type:Number,default:1,min:0,max:100},
 nextProfitAt:{type:Date,required:true,index:true},
 lastProfitAt:{type:Date,default:null},
 totalProfitAccrued:{type:Number,default:0,min:0},createdAt:{type:Date,default:Date.now},unlockAt:{type:Date,required:true,index:true},unlockedAt:{type:Date,default:null},status:{type:String,enum:['locked','unlocked'],default:'locked',index:true},sourceReference:{type:String,required:true,unique:true}},{timestamps:true}); export const CapitalLock=mongoose.models.CapitalLock||model('CapitalLock',schema);

