import mongoose,{Schema,model,Types,InferSchemaType,Model} from 'mongoose';

const schema=new Schema({
  userId:{type:Types.ObjectId,ref:'User',required:true,index:true,unique:true},
  status:{type:String,enum:['open','closed'],default:'open',index:true},
  lastMessageAt:{type:Date,default:Date.now,index:true},
  unreadForAdmin:{type:Boolean,default:false,index:true},
  unreadForUser:{type:Boolean,default:false,index:true}
},{timestamps:true});

export type SupportConversationDocument=InferSchemaType<typeof schema>;
export const SupportConversation=(mongoose.models.SupportConversation as Model<SupportConversationDocument>)||model<SupportConversationDocument>('SupportConversation',schema);
