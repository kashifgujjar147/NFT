import mongoose,{Schema,model,InferSchemaType,Model} from 'mongoose';

const schema=new Schema({
  key:{type:String,unique:true,default:'global'},
  platformName:{type:String,default:'Nexus Member'},

  paymentDetails:{
    jazzCashNumber:String,
    jazzCashTitle:String,
    jazzCashActive:{type:Boolean,default:true},

    easypaisaNumber:String,
    easypaisaTitle:String,
    easypaisaActive:{type:Boolean,default:true},

    bep20Address:{type:String,default:''},
    bep20Network:{type:String,default:'BEP20 / BNB Smart Chain'},
    bep20Active:{type:Boolean,default:true},

    customMethods:{type:[{
      name:{type:String,trim:true,maxlength:50},
      number:{type:String,trim:true,maxlength:100},
      title:{type:String,trim:true,maxlength:150},
      active:{type:Boolean,default:true}
    }],default:[]},

    instructions:String
  },

  withdrawalsEnabled:{type:Boolean,default:true},
  withdrawalDisabledMessage:{type:String,default:'Withdrawals are temporarily unavailable.'},

  withdrawalFeePercent:{type:Number,default:10,min:0,max:100},
  minimumWithdrawal:{type:Number,default:0,min:0},
  maximumWithdrawal:{type:Number,default:100000000,min:0},
  withdrawalCooldownHours:{type:Number,default:24,min:0},

  capitalLockDays:{type:Number,default:45,min:0},

  capitalRecoveryDays:{type:Number,default:45,min:0},
  profitDurationDays:{type:Number,default:45,min:0},
  totalInvestmentDays:{type:Number,default:90,min:1},

  referralRates:{
    level1:{type:Number,default:.1,min:0,max:1},
    level2:{type:Number,default:.02,min:0,max:1},
    level3:{type:Number,default:.01,min:0,max:1}
  },

  whatsapp:{enabled:{type:Boolean,default:false},url:{type:String,default:''}},
  telegram:{enabled:{type:Boolean,default:false},url:{type:String,default:''}},
  theme:{type:Schema.Types.Mixed,default:{}}
},{timestamps:true,strict:true});

export type AdminSettingsDocument=InferSchemaType<typeof schema>;
export const AdminSettings=(mongoose.models.AdminSettings as Model<AdminSettingsDocument>)||model<AdminSettingsDocument>('AdminSettings',schema);
