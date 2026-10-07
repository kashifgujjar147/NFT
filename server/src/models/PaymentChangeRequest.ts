import mongoose,{Schema,model,InferSchemaType,Model} from 'mongoose';

const schema=new Schema({
  userId:{type:Schema.Types.ObjectId,ref:'User',required:true,index:true},
  jazzCash:{type:String,default:'',select:false},
  easypaisa:{type:String,default:'',select:false},
  customMethods:{
    type:[{
      name:{type:String,trim:true,maxlength:50},
      number:{type:String,trim:true,maxlength:100},
      title:{type:String,trim:true,maxlength:150}
    }],
    default:[]
  },
  status:{type:String,enum:['pending','approved','rejected'],default:'pending',index:true},
  reason:{type:String,default:''},
  reviewedBy:{type:Schema.Types.ObjectId,ref:'User',default:null},
  reviewedAt:{type:Date,default:null}
},{timestamps:true,strict:true});

schema.index({userId:1,status:1,createdAt:-1});

export type PaymentChangeRequestDocument=InferSchemaType<typeof schema>;

export const PaymentChangeRequest=(mongoose.models.PaymentChangeRequest as Model<PaymentChangeRequestDocument>)||model<PaymentChangeRequestDocument>('PaymentChangeRequest',schema);
