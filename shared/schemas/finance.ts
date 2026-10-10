import {z} from 'zod';
const safeHttpUrl=z.string().trim().url().refine(v=>/^https?:\/\//i.test(v),'Only HTTP/HTTPS URLs are allowed');
const safeWhatsApp=z.union([safeHttpUrl,z.string().trim().regex(/^\+?[0-9 ()-]{7,25}$/),z.literal('')]).transform(v=>!v?'':/^https?:\/\//i.test(v)?v:`https://wa.me/${v.replace(/\D/g,'')}`);
export const depositCreateSchema=z.object({amount:z.coerce.number().positive().max(100000000),paymentMethod:z.enum(['JazzCash','Easypaisa','BEP20']),reference:z.string().trim().min(3).max(120),details:z.string().trim().max(1000).optional(),depositType:z.enum(['wallet','package']).default('wallet'),packagePurchaseId:z.string().trim().optional()}).superRefine((v,ctx)=>{if(v.depositType==='package'&&!v.packagePurchaseId)ctx.addIssue({code:'custom',message:'Package purchase is required',path:['packagePurchaseId']});});
export const withdrawalCreateSchema=z.object({amount:z.coerce.number().positive().max(100000000),paymentMethod:z.enum(['JazzCash','Easypaisa','BEP20']),paymentAccount:z.string().trim().min(10).max(120).optional(),idempotencyKey:z.string().trim().min(16).max(128)});
export const walletPackagePurchaseSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(100),
  idempotencyKey: z.string().trim().min(16).max(128)
});
export const packagePurchaseSchema=z.object({
  quantity:z.coerce.number().int().min(1).max(100),
  paymentMethod:z.enum(['BEP20']).default('BEP20'),
  idempotencyKey:z.string().trim().min(16).max(128),
  amount:z.coerce.number().positive().max(100000000),
  reference:z.string().trim().min(3).max(120),
  details:z.string().trim().max(1000).optional()
});
const packageBaseSchema=z.object({name:z.string().trim().min(2).max(120),description:z.string().max(5000).default(''),price:z.coerce.number().positive(),salePrice:z.coerce.number().positive().nullable().optional(),quantity:z.coerce.number().int().min(0),active:z.boolean().default(true),startDate:z.string().datetime().nullable().optional(),endDate:z.string().datetime().nullable().optional(),limitedTimeSale:z.boolean().default(false),investmentDays:z.coerce.number().int().min(1).default(90),capitalRecoveryDays:z.coerce.number().int().min(0).default(45),profitDurationDays:z.coerce.number().int().min(0).default(45),profitPercent:z.coerce.number().min(0).default(0),images:z.array(z.string().max(500)).max(10).default([])});
const packageRules=<T extends z.ZodTypeAny>(schema:T)=>schema.refine((v:unknown)=>{const x=v as {salePrice?:number|null;price?:number};return x.salePrice==null||x.price==null||x.salePrice<=x.price},{message:'Sale price cannot exceed regular price',path:['salePrice']}).refine((v:unknown)=>{const x=v as {startDate?:string|null;endDate?:string|null};return !x.startDate||!x.endDate||new Date(x.startDate)<new Date(x.endDate)},{message:'End date must be after start date',path:['endDate']});
export const packageSchema=packageRules(packageBaseSchema);
export const packageUpdateSchema=packageRules(packageBaseSchema.partial());
export const adminActionSchema=z.object({note:z.string().trim().max(1000).optional()});
export const settingsSchema=z.object({platformName:z.string().trim().min(2).max(120).optional(),theme:z.record(z.string()).optional(),paymentDetails:z.object({jazzCashNumber:z.string().trim().max(50).optional(),jazzCashTitle:z.string().trim().max(120).optional(),jazzCashActive:z.boolean().optional(),easypaisaNumber:z.string().trim().max(50).optional(),easypaisaTitle:z.string().trim().max(120).optional(),easypaisaActive:z.boolean().optional(),bep20Address:z.string().trim().max(120).optional(),bep20Network:z.string().trim().max(80).optional(),bep20Active:z.boolean().optional(),instructions:z.string().trim().max(2000).optional()}).optional(),withdrawalsEnabled:z.boolean().optional(),withdrawalDisabledMessage:z.string().trim().max(500).optional(),withdrawalFeePercent:z.number().min(0).max(100).optional(),minimumWithdrawal:z.number().min(0).max(100000000).optional(),maximumWithdrawal:z.number().min(0).max(100000000).optional(),withdrawalCooldownHours:z.number().min(0).max(720).optional(),capitalLockDays:z.number().min(0).max(3650).optional(),capitalRecoveryDays:z.number().min(0).max(3650).optional(),profitDurationDays:z.number().min(0).max(3650).optional(),totalInvestmentDays:z.number().min(1).max(3650).optional(),referralRates:z.object({level1:z.number().min(0).max(1),level2:z.number().min(0).max(1),level3:z.number().min(0).max(1)}).optional(),whatsapp:z.object({enabled:z.boolean(),url:safeWhatsApp}).optional(),telegram:z.object({enabled:z.boolean(),url:z.union([safeHttpUrl,z.literal('')])}).optional()}).superRefine((v,ctx)=>{if(v.minimumWithdrawal!=null&&v.maximumWithdrawal!=null&&v.minimumWithdrawal>v.maximumWithdrawal)ctx.addIssue({code:'custom',message:'Minimum withdrawal cannot exceed maximum withdrawal',path:['minimumWithdrawal']});});
export const passwordChangeSchema=z.object({currentPassword:z.string().min(1),newPassword:z.string().min(10).max(128)});
export const passwordResetRequestSchema=z.object({email:z.string().trim().email()});
export const passwordResetSchema=z.object({token:z.string().min(20),newPassword:z.string().min(10).max(128)});

export const paymentChangeSchema=z.object({currentPassword:z.string().min(1),jazzCash:z.string().trim().max(50).optional().default(''),easypaisa:z.string().trim().max(50).optional().default('')});
export const paymentReviewSchema=z.object({approve:z.boolean(),reason:z.string().trim().max(1000).optional()});




