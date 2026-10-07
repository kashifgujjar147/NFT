import crypto from 'node:crypto';
import {RefreshSession} from '../models/RefreshSession.js';
export function hashToken(token:string){return crypto.createHash('sha256').update(token).digest('hex');}
export async function createRefreshSession(userId:string,token:string,expiresAt:Date){return RefreshSession.create({userId,tokenHash:hashToken(token),expiresAt});}
export async function revokeRefreshToken(token:string){await RefreshSession.findOneAndUpdate({tokenHash:hashToken(token),revokedAt:null},{$set:{revokedAt:new Date()}});}
export async function consumeRefreshToken(token:string){const s=await RefreshSession.findOne({tokenHash:hashToken(token),revokedAt:null,expiresAt:{$gt:new Date()}});if(!s)return null;s.revokedAt=new Date();await s.save();return s;}
