import rateLimit from 'express-rate-limit';
export const authRateLimit=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'Too many authentication attempts. Please try again later.'}});
export const resetRateLimit=rateLimit({windowMs:60*60*1000,limit:8,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'Too many password reset attempts. Please try again later.'}});
export const financialRateLimit=rateLimit({windowMs:15*60*1000,limit:20,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'Too many financial requests. Please try again later.'}});
export const paymentChangeRateLimit=rateLimit({windowMs:60*60*1000,limit:5,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'Too many payment-detail change requests. Please try again later.'}});
export const adminMutationRateLimit=rateLimit({windowMs:15*60*1000,limit:60,standardHeaders:true,legacyHeaders:false,message:{success:false,message:'Too many administrative mutations. Please try again later.'}});
