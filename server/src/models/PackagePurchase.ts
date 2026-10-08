import mongoose,{Schema,model,Types} from 'mongoose';

const schema=new Schema({
  userId:{type:Types.ObjectId,ref:'User',required:true,index:true},
  packageId:{type:Types.ObjectId,ref:'Package',required:true,index:true},

  quantity:{type:Number,required:true,min:1},
  unitPrice:{type:Number,required:true,min:0},
  totalAmount:{type:Number,required:true,min:0},

  reference:{type:String,required:true,unique:true,index:true},
  idempotencyKey:{type:String,required:true,unique:true,index:true},

  status:{
    type:String,
    enum:['pending','active','capital_recovery','profit','matured','rejected','refunded'],
    default:'pending',
    index:true
  },

  purchasedAt:{type:Date,default:null},
  activatedAt:{type:Date,default:null},

  capitalRecoveryDays:{type:Number,default:45,min:0},
  profitDurationDays:{type:Number,default:45,min:0},
  investmentDays:{type:Number,default:90,min:1},

  capitalRecoveryAt:{type:Date,default:null},
  profitStartsAt:{type:Date,default:null},
  maturesAt:{type:Date,default:null},

  profitPercent:{type:Number,default:0,min:0},

  // Daily package profit amount.
  // Example: $100 package at 2% = $2 every 24 hours.
  dailyProfitAmount:{type:Number,default:0,min:0},

  // Kept for compatibility with existing package data/UI.
  profitAmount:{type:Number,default:0,min:0},
  payoutAmount:{type:Number,default:0,min:0},

  // Daily 24-hour profit cycle tracking.
  lastProfitAt:{type:Date,default:null},
  nextProfitAt:{type:Date,default:null},
  profitCyclesCredited:{type:Number,default:0,min:0},

  paymentDepositId:{type:Types.ObjectId,ref:'Deposit',default:null},

  adminNote:{type:String,default:''}
},{timestamps:true});

schema.index({userId:1,purchasedAt:-1});
schema.index({status:1,capitalRecoveryAt:1});
schema.index({status:1,profitStartsAt:1});
schema.index({status:1,maturesAt:1});
schema.index({status:1,nextProfitAt:1});

export const PackagePurchase=mongoose.models.PackagePurchase||model('PackagePurchase',schema);

