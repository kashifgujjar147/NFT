import mongoose,{Schema,model,Types,InferSchemaType,Model} from 'mongoose';
const schema=new Schema({fullName:{type:String,required:true,trim:true},username:{type:String,required:true,unique:true,index:true,lowercase:true,trim:true},mobile:{type:String,required:true,unique:true,index:true,trim:true},email:{type:String,lowercase:true,trim:true,index:true,sparse:true},address:{type:String,trim:true,default:''},dismissedAt:{type:Date,default:null},passwordHash:{type:String,required:true},memberId:{type:String,required:true,unique:true,index:true},referralCode:{type:String,required:true,unique:true,index:true},uplinerId:{type:Types.ObjectId,ref:'User',default:null,index:true},role:{type:String,enum:['member','admin','super_admin'],default:'member',index:true},paymentDetails:{
  jazzCash:{type:String,default:''},
  easypaisa:{type:String,default:''},
  customMethods:{
    type:[{
      name:{type:String,trim:true,maxlength:50},
      number:{type:String,trim:true,maxlength:100},
      title:{type:String,trim:true,maxlength:150}
    }],
    default:[]
  }
},isActive:{type:Boolean,default:true},passwordResetTokenHash:{type:String,default:null},passwordResetExpiresAt:{type:Date,default:null},lastLoginAt:{type:Date,default:null},withdrawalCooldownUntil:{type:Date,default:null}},{timestamps:true});
export type UserDocument=InferSchemaType<typeof schema>; export const User=(mongoose.models.User as Model<UserDocument>)||model<UserDocument>('User',schema);
