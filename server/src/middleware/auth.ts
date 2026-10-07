import type {RequestHandler} from 'express'; import {verifyAccess} from '../services/auth.service.js'; import {fail} from '../utils/api.js';
declare global {namespace Express {interface Request {auth?:{userId:string;role:string}}}}
export const requireAuth:RequestHandler=async(req,res,next)=>{try{const h=req.headers.authorization;if(!h?.startsWith('Bearer '))return fail(res,'Authentication required',401);const p=await verifyAccess(h.slice(7));req.auth={userId:p.sub,role:p.role};next();}catch(e){return fail(res,e instanceof Error?e.message:'Unauthorized',401);}};
export const requireRoles=(...roles:string[]):RequestHandler=>(req,res,next)=>{if(!req.auth||!roles.includes(req.auth.role))return fail(res,'Forbidden',403);next();};

export const requireImpersonation:RequestHandler=async(req,res,next)=>{
  try{
    const h=req.headers.authorization;
    if(!h?.startsWith('Bearer '))return fail(res,'Authentication required',401);
    const p=await verifyAccess(h.slice(7));
    if(!p.impersonatedBy)return fail(res,'Impersonation session required',403);
    req.auth={userId:p.sub,role:p.role};
    next();
  }catch(e){
    return fail(res,e instanceof Error?e.message:'Unauthorized',401);
  }
};
