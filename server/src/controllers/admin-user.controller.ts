import {Request,Response} from 'express'; import bcrypt from 'bcryptjs'; import crypto from 'node:crypto'; import {User} from '../models/User.js'; import {ok} from '../utils/api.js'; import {audit} from '../services/audit.service.js'; import {createImpersonationToken,consumeImpersonationReturnToken} from '../services/auth.service.js'; import {AppError} from '../utils/errors.js';
export async function listAdmins(_req:Request,res:Response){return ok(res,await User.find({role:{$in:['admin','super_admin']}}).select('-passwordHash -passwordResetTokenHash -paymentDetails').lean());}
export async function createAdmin(req:Request,res:Response){if(req.auth?.role!=='super_admin')throw new AppError(403,'Only Super Admin can create administrators');if(await User.exists({$or:[{username:req.body.username.toLowerCase()},{mobile:req.body.mobile}]}))throw new AppError(409,'Username or mobile already exists');const u=await User.create({fullName:req.body.fullName,username:req.body.username,mobile:req.body.mobile,passwordHash:await bcrypt.hash(req.body.password,12),memberId:'ADM-'+crypto.randomBytes(5).toString('hex').toUpperCase(),referralCode:'ADMIN-'+crypto.randomBytes(4).toString('hex').toUpperCase(),role:req.body.role});await audit({actorId:req.auth!.userId,action:'admin.create',targetType:'User',targetId:u._id.toString(),after:{username:u.username,role:u.role}});return ok(res,{id:u._id,username:u.username,role:u.role},'Admin created',201);}
export async function changeAdminRole(req:Request,res:Response){if(req.auth?.role!=='super_admin')throw new AppError(403,'Only Super Admin can change administrator roles');const u=await User.findById(req.params.id);if(!u||!['admin','super_admin'].includes(u.role))throw new AppError(404,'Admin not found');u.role=req.body.role;await u.save();await audit({actorId:req.auth!.userId,action:'admin.role_change',targetType:'User',targetId:u._id.toString(),after:{role:u.role}});return ok(res,{id:u._id,role:u.role});}
export async function blockMember(req:Request,res:Response){
  const u=await User.findById(req.params.id);
  if(!u||u.role!=='member')throw new AppError(404,'Member not found');
  if(!u.isActive)return ok(res,{id:u._id,isActive:false},'Member is already blocked');
  const before={isActive:u.isActive,dismissedAt:u.dismissedAt};
  u.isActive=false;
  await u.save();
  await audit({
    actorId:req.auth!.userId,
    action:'member.block',
    targetType:'User',
    targetId:u._id.toString(),
    before,
    after:{isActive:u.isActive,dismissedAt:u.dismissedAt},
    ip:req.ip,
    userAgent:req.get('user-agent')??undefined
  });
  return ok(res,{id:u._id,isActive:u.isActive,dismissedAt:u.dismissedAt},'Member blocked');
}

export async function unblockMember(req:Request,res:Response){
  const u=await User.findById(req.params.id);
  if(!u||u.role!=='member')throw new AppError(404,'Member not found');
  if(u.isActive)return ok(res,{id:u._id,isActive:true},'Member is already active');
  const before={isActive:u.isActive,dismissedAt:u.dismissedAt};
  u.isActive=true;
  await u.save();
  await audit({
    actorId:req.auth!.userId,
    action:'member.unblock',
    targetType:'User',
    targetId:u._id.toString(),
    before,
    after:{isActive:u.isActive,dismissedAt:u.dismissedAt},
    ip:req.ip,
    userAgent:req.get('user-agent')??undefined
  });
  return ok(res,{id:u._id,isActive:u.isActive,dismissedAt:u.dismissedAt},'Member unblocked');
}

export async function dismissMember(req:Request,res:Response){
  const u=await User.findById(req.params.id);
  if(!u||u.role!=='member')throw new AppError(404,'Member not found');
  if(u.dismissedAt)return ok(res,{id:u._id,isActive:u.isActive,dismissedAt:u.dismissedAt},'Member is already dismissed');
  const before={isActive:u.isActive,dismissedAt:u.dismissedAt};
  u.dismissedAt=new Date();
  await u.save();
  await audit({
    actorId:req.auth!.userId,
    action:'member.dismiss',
    targetType:'User',
    targetId:u._id.toString(),
    before,
    after:{isActive:u.isActive,dismissedAt:u.dismissedAt},
    ip:req.ip,
    userAgent:req.get('user-agent')??undefined
  });
  return ok(res,{id:u._id,isActive:u.isActive,dismissedAt:u.dismissedAt},'Member dismissed');
}

export async function restoreMember(req:Request,res:Response){
  const u=await User.findById(req.params.id);
  if(!u||u.role!=='member')throw new AppError(404,'Member not found');
  if(!u.dismissedAt)return ok(res,{id:u._id,isActive:u.isActive,dismissedAt:null},'Member is already restored');
  const before={isActive:u.isActive,dismissedAt:u.dismissedAt};
  u.dismissedAt=null;
  await u.save();
  await audit({
    actorId:req.auth!.userId,
    action:'member.restore',
    targetType:'User',
    targetId:u._id.toString(),
    before,
    after:{isActive:u.isActive,dismissedAt:u.dismissedAt},
    ip:req.ip,
    userAgent:req.get('user-agent')??undefined
  });
  return ok(res,{id:u._id,isActive:u.isActive,dismissedAt:u.dismissedAt},'Member restored');
}


export async function impersonateMember(req:Request,res:Response){
  const result=await createImpersonationToken(req.auth!.userId,String(req.params.id));

  await audit({
    actorId:req.auth!.userId,
    action:'member.impersonation_start',
    targetType:'User',
    targetId:String(req.params.id),
    after:{
      impersonation:true,
      expiresAt:result.expiresAt
    },
    ip:req.ip,
    userAgent:req.get('user-agent')??undefined
  });

  return ok(res,result,'Impersonation started');
}

export async function returnFromImpersonation(req:Request,res:Response){
  const result=await consumeImpersonationReturnToken(String(req.body.returnToken??''));

  await audit({
    actorId:result.user.id,
    action:'member.impersonation_end',
    targetType:'User',
    targetId:result.user.id,
    after:{returnedToAdministrator:true},
    ip:req.ip,
    userAgent:req.get('user-agent')??undefined
  });

  return ok(res,result,'Returned to administrator session');
}
