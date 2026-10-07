import express from 'express';
import path from 'path';
import {fileURLToPath} from 'url';
import {mediaDirectory} from './utils/media-upload.js'; import helmet from 'helmet'; import cors from 'cors'; import compression from 'compression'; import cookieParser from 'cookie-parser'; import rateLimit from 'express-rate-limit'; import {env} from './config/env.js'; import {authRouter} from './routes/auth.routes.js'; import {memberRouter} from './routes/member.routes.js'; import {financeRouter} from './routes/finance.routes.js'; import {packageRouter} from './routes/package.routes.js'; import {adminRouter} from './routes/admin.routes.js'; import {contentRouter} from './routes/content.routes.js'; import {securityRouter} from './routes/security.routes.js'; import {rewardRouter} from './routes/reward.routes.js';
import {paymentRouter} from './routes/payment.routes.js'; import {errorHandler} from './middleware/error.js';
const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const frontendDirectory=path.resolve(__dirname,'../../../../client/dist');
export const app=express(); app.disable('x-powered-by'); app.use(helmet()); app.use(cors({origin:env.CLIENT_URL,credentials:true})); app.use(compression()); app.use(express.json({limit:'1mb'})); app.use(express.urlencoded({extended:false,limit:'1mb'})); app.use(cookieParser()); app.use(rateLimit({windowMs:15*60*1000,limit:300,standardHeaders:true,legacyHeaders:false})); app.use(express.static(frontendDirectory,{index:'index.html'})); app.use('/media',(req,res,next)=>{res.setHeader('Cross-Origin-Resource-Policy','cross-origin');next()},express.static(mediaDirectory,{index:false,maxAge:'1h'}));
app.get('/health',(_req,res)=>res.json({success:true,message:'OK',data:{service:'server'}})); app.use('/api/auth',authRouter); app.use('/api/members',memberRouter); app.use('/api/content',contentRouter); app.use('/api',financeRouter); app.use('/api/packages',packageRouter); app.use('/api/admin',adminRouter); app.use('/api/security',securityRouter); app.use('/api/rewards',rewardRouter); app.use('/api/payment-details',paymentRouter); app.use((req,res,next)=>{if(req.path.startsWith('/api/')||req.path==='/health'||req.path.startsWith('/media/'))return next();res.sendFile(path.join(frontendDirectory,'index.html'))}); app.use(errorHandler);




