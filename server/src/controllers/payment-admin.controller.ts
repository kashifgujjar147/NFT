import {Request,Response} from 'express';
import {PaymentChangeRequest} from '../models/PaymentChangeRequest.js';
import {reviewPaymentChange} from './payment.controller.js';
import {ok} from '../utils/api.js';
export async function paymentChangeRequests(_req:Request,res:Response){return ok(res,await PaymentChangeRequest.find().sort({createdAt:-1}).limit(100).populate('userId','username memberId mobile').lean());}
export async function reviewPaymentChangeRequestController(req:Request,res:Response){return reviewPaymentChange(req,res);}
