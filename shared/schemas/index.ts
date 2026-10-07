import { z } from 'zod';
export const registerSchema = z.object({fullName:z.string().trim().min(2).max(120),username:z.string().trim().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/),mobile:z.string().trim().min(7).max(20),email:z.string().email(),password:z.string().min(10).max(128),referralCode:z.string().trim().max(40).optional().or(z.literal('')),paymentDetails:z.object({jazzCash:z.string().trim().max(50).optional(),easypaisa:z.string().trim().max(50).optional()}).optional()});
export const loginSchema = z.object({username:z.string().trim().min(1),password:z.string().min(1)});
export const refreshSchema = z.object({refreshToken:z.string().min(1)});
export const idParamSchema = z.object({id:z.string().regex(/^[a-f\d]{24}$/i)});
export type RegisterInput=z.infer<typeof registerSchema>; export type LoginInput=z.infer<typeof loginSchema>;
