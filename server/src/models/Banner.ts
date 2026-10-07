import mongoose,{Schema,model,InferSchemaType} from 'mongoose';
const schema=new Schema({
  title:{type:String,required:true,trim:true,maxlength:150},
  description:{type:String,default:'',maxlength:1000},
  imageUrl:{type:String,required:true,maxlength:500},
  destinationUrl:{type:String,default:'',maxlength:500},
  order:{type:Number,default:0,min:0},
  active:{type:Boolean,default:true},
  startAt:{type:Date,default:null},
  endAt:{type:Date,default:null},
  offerText:{type:String,default:'',maxlength:200},
  promoType:{type:String,enum:['general','nft','sale'],default:'general'},
},{timestamps:true,strict:true});
schema.index({active:1,order:1,startAt:1,endAt:1});
export const Banner=mongoose.models.Banner||model('Banner',schema);



