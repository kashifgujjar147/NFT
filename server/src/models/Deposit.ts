import mongoose,{Schema,model,Types,InferSchemaType,Model} from 'mongoose';

const schema=new Schema({
  userId:{type:Types.ObjectId,ref:'User',required:true,index:true},
  amount:{type:Number,required:true,min:0.01},

  paymentMethod:{type:String,required:true,maxlength:50},

  reference:{type:String,required:true,index:true},
  details:{type:String,maxlength:1000,default:''},

  receiptPath:{type:String,default:null},

  depositType:{
    type:String,
    enum:['wallet','package'],
    default:'wallet',
    index:true
  },

  packagePurchaseId:{
    type:Types.ObjectId,
    ref:'PackagePurchase',
    default:null,
    index:true
  },

  submittedAt:{type:Date,default:Date.now},

  status:{
    type:String,
    enum:['pending','approved','rejected'],
    default:'pending',
    index:true
  },

  adminNote:{type:String,default:''},
  reviewedBy:{type:Types.ObjectId,ref:'User',default:null},
  reviewedAt:{type:Date,default:null}
},{timestamps:true});

schema.index({userId:1,createdAt:-1});
schema.index({reference:1},{unique:true});
schema.index({packagePurchaseId:1,status:1});

export type DepositDocument=InferSchemaType<typeof schema>;
export const Deposit=(mongoose.models.Deposit as Model<DepositDocument>)||model<DepositDocument>('Deposit',schema);
