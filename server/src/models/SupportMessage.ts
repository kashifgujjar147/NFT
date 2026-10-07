import mongoose,{Schema,model,Types,InferSchemaType,Model} from 'mongoose';

const schema=new Schema({
  conversationId:{type:Types.ObjectId,ref:'SupportConversation',required:true,index:true},
  senderId:{type:Types.ObjectId,ref:'User',required:true,index:true},
  senderRole:{type:String,enum:['member','admin','super_admin'],required:true,index:true},
  body:{type:String,required:true,trim:true,maxlength:2000},
  readAt:{type:Date,default:null}
},{timestamps:true});

schema.index({conversationId:1,createdAt:1});

export type SupportMessageDocument=InferSchemaType<typeof schema>;
export const SupportMessage=(mongoose.models.SupportMessage as Model<SupportMessageDocument>)||model<SupportMessageDocument>('SupportMessage',schema);
