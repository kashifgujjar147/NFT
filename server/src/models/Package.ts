import mongoose,{Schema,model,InferSchemaType,Model} from 'mongoose';

const schema=new Schema({
  name:{type:String,required:true,trim:true},
  images:[{type:String}],
  description:{type:String,default:''},

  price:{type:Number,required:true,min:0.01},
  salePrice:{type:Number,min:0.01,default:null},

  quantity:{type:Number,required:true,min:0},
  remainingQuantity:{type:Number,required:true,min:0},

  active:{type:Boolean,default:true,index:true},

  startDate:{type:Date,default:null},
  endDate:{type:Date,default:null},
  limitedTimeSale:{type:Boolean,default:false},

  investmentDays:{type:Number,default:90,min:1},
  capitalRecoveryDays:{type:Number,default:45,min:0},
  profitDurationDays:{type:Number,default:45,min:0},

  profitPercent:{type:Number,default:0,min:0}
},{timestamps:true});

schema.index({active:1,startDate:1,endDate:1});

export type PackageDocument=InferSchemaType<typeof schema>;
export const PackageModel=(mongoose.models.Package as Model<PackageDocument>)||model('Package',schema);
