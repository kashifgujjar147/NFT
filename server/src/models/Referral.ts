import mongoose,{Schema,model,Types,InferSchemaType,Model} from 'mongoose';
const schema=new Schema({userId:{type:Types.ObjectId,ref:'User',required:true,unique:true,index:true},uplinerId:{type:Types.ObjectId,ref:'User',required:false,index:true},level1Ids:[{type:Types.ObjectId,ref:'User'}],level2Ids:[{type:Types.ObjectId,ref:'User'}],level3Ids:[{type:Types.ObjectId,ref:'User'}]},{timestamps:true});
export type ReferralDocument=InferSchemaType<typeof schema>; export const Referral=(mongoose.models.Referral as Model<ReferralDocument>)||model<ReferralDocument>('Referral',schema);



