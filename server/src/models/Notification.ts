import mongoose,{Schema,model,Types} from 'mongoose';
const n=new Schema({title:{type:String,required:true,trim:true,maxlength:150},message:{type:String,required:true,trim:true,maxlength:2000},type:{type:String,default:'info',maxlength:30},color:{type:String,default:'#D4AF37',match:/^#[0-9A-Fa-f]{6}$/},active:{type:Boolean,default:true},startAt:{type:Date,default:null},endAt:{type:Date,default:null},frequency:{type:String,enum:['once','repeat','always'],default:'once'},repeatIntervalHours:{type:Number,default:24,min:1,max:8760},dismissible:{type:Boolean,default:true}},{timestamps:true,strict:true});
n.index({active:1,startAt:1,endAt:1});
export const Notification=mongoose.models.Notification||model('Notification',n);
const r=new Schema({notificationId:{type:Types.ObjectId,ref:'Notification',required:true},userId:{type:Types.ObjectId,ref:'User',required:true},readAt:{type:Date,default:null},dismissedAt:{type:Date,default:null}},{timestamps:true});
r.index({notificationId:1,userId:1},{unique:true});
r.index({userId:1,updatedAt:-1});
export const NotificationRead=mongoose.models.NotificationRead||model('NotificationRead',r);

