import mongoose,{Schema,model,Types} from 'mongoose';

const schema=new Schema({
  userId:{type:Types.ObjectId,ref:'User',required:true,index:true},

  requestedAmount:{type:Number,required:true,min:0.01},
  feeAmount:{type:Number,required:true,min:0},
  netAmount:{type:Number,required:true,min:0},

  paymentMethod:{type:String,required:true},
  paymentAccount:{type:String,required:true},

  status:{
    type:String,
    enum:['pending','approved','rejected','paid'],
    default:'pending',
    index:true
  },

  reference:{type:String,required:true,unique:true,index:true},
  idempotencyKey:{type:String,required:true,unique:true,index:true},

  requestedAt:{type:Date,default:Date.now,index:true},
  processedAt:{type:Date,default:null},
  processedBy:{type:Types.ObjectId,ref:'User',default:null},

  adminNote:{type:String,default:''}
},{timestamps:true});

schema.index({userId:1,requestedAt:-1});

export const Withdrawal=mongoose.models.Withdrawal||model('Withdrawal',schema);
