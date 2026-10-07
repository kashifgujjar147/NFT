import {Request,Response} from 'express';
import {ok} from '../utils/api.js';
import {SupportConversation} from '../models/SupportConversation.js';
import {SupportMessage} from '../models/SupportMessage.js';

export async function memberSupport(req:Request,res:Response){
  const userId=req.auth!.userId;
  let conversation=await SupportConversation.findOne({userId});

  if(!conversation){
    conversation=await SupportConversation.create({userId});
  }

  const messages=await SupportMessage.find({conversationId:conversation._id})
    .sort({createdAt:1})
    .lean();

  if(conversation.unreadForUser){
    await SupportConversation.updateOne(
      {_id:conversation._id},
      {$set:{unreadForUser:false}}
    );
  }

  return ok(res,{conversation:conversation.toObject(),messages});
}

export async function memberSupportMessage(req:Request,res:Response){
  const userId=req.auth!.userId;
  const body=String(req.body?.body??'').trim();

  if(!body)return ok(res,{message:null});

  let conversation=await SupportConversation.findOne({userId});

  if(!conversation){
    conversation=await SupportConversation.create({userId});
  }

  if(conversation.status==='closed'){
    conversation.status='open';
  }

  const message=await SupportMessage.create({
    conversationId:conversation._id,
    senderId:userId,
    senderRole:'member',
    body
  });

  conversation.lastMessageAt=new Date();
  conversation.unreadForAdmin=true;
  conversation.unreadForUser=false;
  await conversation.save();

  return ok(res,{message});
}

export async function adminSupportConversations(req:Request,res:Response){
  const conversations=await SupportConversation.find()
    .sort({unreadForAdmin:-1,lastMessageAt:-1})
    .populate('userId','fullName username memberId email mobile')
    .lean();

  return ok(res,{conversations});
}

export async function adminSupportMessages(req:Request,res:Response){
  const conversation=await SupportConversation.findById(req.params.id)
    .populate('userId','fullName username memberId email mobile')
    .lean();

  if(!conversation)return ok(res,{conversation:null,messages:[]});

  const messages=await SupportMessage.find({conversationId:conversation._id})
    .sort({createdAt:1})
    .lean();

  await SupportConversation.updateOne(
    {_id:conversation._id},
    {$set:{unreadForAdmin:false}}
  );

  return ok(res,{conversation,messages});
}

export async function adminSupportMessage(req:Request,res:Response){
  const body=String(req.body?.body??'').trim();

  if(!body)return ok(res,{message:null});

  const conversation=await SupportConversation.findById(req.params.id);

  if(!conversation)return ok(res,{message:null});

  const adminId=req.auth!.userId;

  const message=await SupportMessage.create({
    conversationId:conversation._id,
    senderId:adminId,
    senderRole:req.auth!.role,
    body
  });

  conversation.status='open';
  conversation.lastMessageAt=new Date();
  conversation.unreadForUser=true;
  conversation.unreadForAdmin=false;
  await conversation.save();

  return ok(res,{message});
}

export async function adminSupportClose(req:Request,res:Response){
  const conversation=await SupportConversation.findByIdAndUpdate(
    req.params.id,
    {status:'closed'},
    {new:true}
  ).lean();

  return ok(res,{conversation});
}
