import {AdminSettings} from '../models/AdminSettings.js';
import {AppError} from '../utils/errors.js';
import {audit} from './audit.service.js';
import {withTransaction} from './ledger.service.js';

const TOP_LEVEL=['platformName','theme','withdrawalsEnabled','withdrawalDisabledMessage','withdrawalFeePercent','minimumWithdrawal','maximumWithdrawal','withdrawalCooldownHours','capitalLockDays','capitalRecoveryDays','profitDurationDays','totalInvestmentDays','referralRates','paymentDetails','whatsapp','telegram'] as const;
const PAYMENT_FIELDS=['jazzCashNumber','jazzCashTitle','jazzCashActive','easypaisaNumber','easypaisaTitle','easypaisaActive','bep20Address','bep20Network','bep20Active','customMethods','instructions'] as const;
const RATE_FIELDS=['level1','level2','level3'] as const;
const LINK_FIELDS=['enabled','url'] as const;

function pick(source:Record<string,unknown>,fields:readonly string[]){const out:Record<string,unknown>={};for(const field of fields)if(Object.prototype.hasOwnProperty.call(source,field))out[field]=source[field];return out;}
function auditSettings(value:any){if(!value)return value;const clone=JSON.parse(JSON.stringify(value));const pd=clone.paymentDetails??{};for(const key of ['jazzCashNumber','easypaisaNumber'])if(typeof pd[key]==='string'&&pd[key])pd[key]=pd[key].length>4?'â€¢â€¢â€¢â€¢'+pd[key].slice(-4):'â€¢â€¢â€¢â€¢';if(Array.isArray(pd.customMethods))pd.customMethods=pd.customMethods.map((m:any)=>({...m,number:typeof m.number==='string'&&m.number?(m.number.length>4?'â€¢â€¢â€¢â€¢'+m.number.slice(-4):'â€¢â€¢â€¢â€¢'):''}));if(clone.whatsapp?.url)clone.whatsapp.url='configured';if(clone.telegram?.url)clone.telegram.url='configured';return clone;}

export async function getSettings(){let s=await AdminSettings.findOne({key:'global'}).lean();if(!s)s=await AdminSettings.create({key:'global'}).then(x=>x.toObject());return s;}

export async function updateSettings(patch:Record<string,unknown>,actorId:any,meta?:{ip?:string;userAgent?:string}){
  return withTransaction(async session=>{
    const current=await AdminSettings.findOne({key:'global'}).session(session).lean();
    const clean=pick(patch,TOP_LEVEL);
    const currentPayment=(current?.paymentDetails??{}) as Record<string,unknown>;
    const currentRates=(current?.referralRates??{}) as Record<string,unknown>;
    const currentWhatsApp=(current?.whatsapp??{}) as Record<string,unknown>;
    const currentTelegram=(current?.telegram??{}) as Record<string,unknown>;
    if(patch.paymentDetails!==undefined){if(!patch.paymentDetails||typeof patch.paymentDetails!=='object'||Array.isArray(patch.paymentDetails))throw new AppError(422,'Invalid payment settings');clean.paymentDetails={...currentPayment,...pick(patch.paymentDetails as Record<string,unknown>,PAYMENT_FIELDS)};}
    if(patch.referralRates!==undefined){if(!patch.referralRates||typeof patch.referralRates!=='object'||Array.isArray(patch.referralRates))throw new AppError(422,'Invalid referral rates');clean.referralRates={...currentRates,...pick(patch.referralRates as Record<string,unknown>,RATE_FIELDS)};}
    if(patch.whatsapp!==undefined){if(!patch.whatsapp||typeof patch.whatsapp!=='object'||Array.isArray(patch.whatsapp))throw new AppError(422,'Invalid WhatsApp settings');clean.whatsapp={...currentWhatsApp,...pick(patch.whatsapp as Record<string,unknown>,LINK_FIELDS)};}
    if(patch.telegram!==undefined){if(!patch.telegram||typeof patch.telegram!=='object'||Array.isArray(patch.telegram))throw new AppError(422,'Invalid Telegram settings');clean.telegram={...currentTelegram,...pick(patch.telegram as Record<string,unknown>,LINK_FIELDS)};}
    const merged:any={...(current??{}),...clean};
    if(merged.minimumWithdrawal>merged.maximumWithdrawal)throw new AppError(422,'Minimum withdrawal cannot exceed maximum withdrawal');
    if(merged.withdrawalFeePercent<0||merged.withdrawalFeePercent>100)throw new AppError(422,'Withdrawal fee percentage is invalid');
    if(merged.capitalLockDays<0||merged.withdrawalCooldownHours<0||merged.capitalRecoveryDays<0||merged.profitDurationDays<0||merged.totalInvestmentDays<1)throw new AppError(422,'Financial durations cannot be negative');
    const update={$set:clean};
    const s=await AdminSettings.findOneAndUpdate({key:'global'},update,{new:true,upsert:true,runValidators:true,session});
    if(!s)throw new AppError(500,'Settings update failed');
    await audit({actorId,action:'settings.update',targetType:'AdminSettings',targetId:'global',before:auditSettings(current),after:auditSettings(s.toObject()),ip:meta?.ip,userAgent:meta?.userAgent},{session});
    return {before:current,settings:s};
  });
}



