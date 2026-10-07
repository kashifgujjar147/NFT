import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken'; import crypto from 'node:crypto'; import {User} from '../models/User.js'; import {Referral} from '../models/Referral.js'; import {env} from '../config/env.js'; import {AppError} from '../utils/errors.js';
import {consumeRefreshToken} from './session.service.js';
import {encryptField} from '../utils/secret-fields.js'; import type {LoginInput,RegisterInput} from '../../../shared/schemas/index.js';
export type AuthPayload={id:string;username:string;memberId:string;role:string;referralCode:string;uplinerId?:string|null};
const payload=(user:any):AuthPayload=>({id:user._id.toString(),username:user.username,memberId:user.memberId,role:user.role,referralCode:user.referralCode,uplinerId:user.uplinerId?.toString()??null});
const sign=(user:any)=>jwt.sign({sub:user._id.toString(),role:user.role},env.JWT_SECRET,{expiresIn:env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn']});
const refresh=(user:any)=>jwt.sign({sub:user._id.toString(),role:user.role,type:'refresh'},env.REFRESH_TOKEN_SECRET,{expiresIn:env.REFRESH_TOKEN_EXPIRES_IN as jwt.SignOptions['expiresIn']});
function code(prefix:string){return prefix+crypto.randomBytes(5).toString('hex').toUpperCase();}
export async function register(input:RegisterInput){const existing=await User.findOne({$or:[{username:input.username.toLowerCase()},{mobile:input.mobile}]});if(existing)throw new AppError(409,'Username or mobile already exists');let upliner=null;if(input.referralCode){upliner=await User.findOne({referralCode:input.referralCode.toUpperCase(),isActive:true});if(!upliner)throw new AppError(422,'Invalid referral code');}const passwordHash=await bcrypt.hash(input.password,12);let memberId=code('MB'),referralCode=code('REF');for(let i=0;i<10;i++){if(!(await User.exists({$or:[{memberId},{referralCode}]})))break;memberId=code('MB');referralCode=code('REF');}const user=await User.create({fullName:input.fullName,username:input.username,mobile:input.mobile,email:input.email,passwordHash,memberId,referralCode,uplinerId:upliner?._id??null,paymentDetails:{jazzCash:encryptField(input.paymentDetails?.jazzCash??''),easypaisa:encryptField(input.paymentDetails?.easypaisa??'')}});await Referral.create({userId:user._id,uplinerId:user.uplinerId});return {accessToken:sign(user),refreshToken:refresh(user),user:payload(user)};}
export async function login(input:LoginInput){const user=await User.findOne({username:input.username.toLowerCase()});if(!user||!user.isActive||!(await bcrypt.compare(input.password,user.passwordHash)))throw new AppError(401,'Invalid credentials');user.lastLoginAt=new Date();await user.save();return {accessToken:sign(user),refreshToken:refresh(user),user:payload(user)};}
export async function refreshAccess(token:string){let p:any;try{p=jwt.verify(token,env.REFRESH_TOKEN_SECRET);}catch{throw new AppError(401,'Invalid refresh token');}if(p.type!=='refresh')throw new AppError(401,'Invalid refresh token');const session=await consumeRefreshToken(token);if(!session)throw new AppError(401,'Refresh session is expired or revoked');const u=await User.findById(p.sub);if(!u||!u.isActive)throw new AppError(401,'Account unavailable');const newRefresh=refresh(u);return {accessToken:sign(u),refreshToken:newRefresh,user:payload(u)};}
export async function verifyAccess(token:string){try{const p=jwt.verify(token,env.JWT_SECRET) as {sub:string;role:string;impersonatedBy?:string};const user=await User.findById(p.sub).select('_id role isActive dismissedAt').lean();if(!user||!user.isActive||user.dismissedAt)throw new AppError(401,'Account unavailable');if(user.role!==p.role)throw new AppError(401,'Invalid account session');return p;}catch(e){if(e instanceof AppError)throw e;throw new AppError(401,'Invalid or expired token');}}




export async function createImpersonationToken(adminId:string,memberId:string){
  const admin=await User.findById(adminId).select('_id role isActive dismissedAt').lean();
  if(!admin||!['admin','super_admin'].includes(admin.role)||!admin.isActive||admin.dismissedAt)throw new AppError(403,'Administrator session unavailable');

  const member=await User.findById(memberId).select('_id username memberId role isActive dismissedAt').lean();
  if(!member||member.role!=='member')throw new AppError(404,'Member not found');
  if(!member.isActive||member.dismissedAt)throw new AppError(403,'Member account is unavailable');

  const expiresAt=new Date(Date.now()+15*60*1000);
  const returnToken=crypto.randomBytes(32).toString('hex');
  const tokenHash=crypto.createHash('sha256').update(returnToken).digest('hex');

  const {ImpersonationSession}=await import('../models/ImpersonationSession.js');

  await ImpersonationSession.create({
    adminId:admin._id,
    memberId:member._id,
    tokenHash,
    expiresAt
  });

  const accessToken=jwt.sign(
    {
      sub:member._id.toString(),
      role:'member',
      impersonatedBy:admin._id.toString(),
      impersonation:true
    },
    env.JWT_SECRET,
    {expiresIn:'15m'}
  );

  return {
    accessToken,
    returnToken,
    expiresAt,
    user:payload(member)
  };
}

export async function consumeImpersonationReturnToken(returnToken:string){
  if(!returnToken)throw new AppError(401,'Impersonation return token required');

  const {ImpersonationSession}=await import('../models/ImpersonationSession.js');
  const tokenHash=crypto.createHash('sha256').update(returnToken).digest('hex');

  const session=await ImpersonationSession.findOne({
    tokenHash,
    consumedAt:null,
    expiresAt:{$gt:new Date()}
  });

  if(!session)throw new AppError(401,'Impersonation return session is expired or invalid');

  session.consumedAt=new Date();
  await session.save();

  const admin=await User.findById(session.adminId).select('_id username memberId role referralCode uplinerId isActive dismissedAt').lean();
  if(!admin||!['admin','super_admin'].includes(admin.role)||!admin.isActive||admin.dismissedAt)throw new AppError(401,'Administrator account unavailable');

  return {
    accessToken:sign(admin),
    user:payload(admin)
  };
}
