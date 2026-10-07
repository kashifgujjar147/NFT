import {Request,Response} from 'express'; import {register,login,refreshAccess} from '../services/auth.service.js'; import {ok} from '../utils/api.js'; import {User} from '../models/User.js';
import {createRefreshSession,revokeRefreshToken} from '../services/session.service.js';
import jwt from 'jsonwebtoken'; import {AppError} from '../utils/errors.js';
const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/api/auth',maxAge:7*24*60*60*1000};
export async function registerController(req:Request,res:Response){const result=await register(req.body);res.cookie('refreshToken',result.refreshToken,cookieOptions);await createRefreshSession(result.user.id,result.refreshToken,new Date(((jwt.decode(result.refreshToken) as any).exp??0)*1000));return ok(res,{accessToken:result.accessToken,user:result.user},'Registration successful',201);}
export async function loginController(req:Request,res:Response){const result=await login(req.body);res.cookie('refreshToken',result.refreshToken,cookieOptions);await createRefreshSession(result.user.id,result.refreshToken,new Date(((jwt.decode(result.refreshToken) as any).exp??0)*1000));return ok(res,{accessToken:result.accessToken,user:result.user},'Login successful');}
export async function refreshController(req:Request,res:Response){const token=req.cookies.refreshToken;if(!token)throw new AppError(401,'Refresh session required');const result=await refreshAccess(token);res.cookie('refreshToken',result.refreshToken,cookieOptions);await createRefreshSession(result.user.id,result.refreshToken,new Date(((jwt.decode(result.refreshToken) as any).exp??0)*1000));return ok(res,{accessToken:result.accessToken,user:result.user},'Token refreshed');}
export async function logoutController(req:Request,res:Response){if(req.cookies.refreshToken)await revokeRefreshToken(req.cookies.refreshToken);res.clearCookie('refreshToken',cookieOptions);return ok(res,null,'Logged out');}
export async function meController(req:Request,res:Response){const u=await User.findById(req.auth!.userId).select('-passwordHash -passwordResetTokenHash');return ok(res,u);}

export async function returnFromImpersonation(req:Request,res:Response){
  const {consumeImpersonationReturnToken}=await import('../services/auth.service.js');
  const result=await consumeImpersonationReturnToken(String(req.body?.returnToken??''));

  await import('../services/audit.service.js').then(({audit})=>audit({
    actorId:result.user.id,
    action:'member.impersonation_end',
    targetType:'User',
    targetId:result.user.id,
    after:{returnedToAdministrator:true},
    ip:req.ip,
    userAgent:req.get('user-agent')??undefined
  }));

  return ok(res,result,'Returned to administrator session');
}
