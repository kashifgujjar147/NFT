import type { Role, TransactionType } from '../constants';
export interface ApiResponse<T=unknown>{success:boolean;message:string;data?:T;errors?:unknown[]}
export interface AuthUser {id:string; username:string; memberId:string; role:Role}
export interface Session {user:AuthUser; accessToken:string}
export interface MoneyBalance {deposit:number;capital:number;profit:number;commission:number;rewards:number;withdrawn:number;available:number}
export interface LedgerRecord {transactionId:string; type:TransactionType; amount:number; direction:'credit'|'debit'; status:string; reference:string; description:string; createdAt:string}
