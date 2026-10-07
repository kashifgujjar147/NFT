import {Router} from 'express'; import {authRateLimit} from '../middleware/rate-limit.js'; import {registerController,loginController,refreshController,logoutController,meController,returnFromImpersonation} from '../controllers/auth.controller.js'; import {validate} from '../middleware/validate.js'; import {registerSchema,loginSchema} from '../../../shared/schemas/index.js'; import {requireAuth,requireImpersonation} from '../middleware/auth.js';
export const authRouter=Router(); authRouter.post('/register',authRateLimit,validate(registerSchema),registerController); authRouter.post('/login',authRateLimit,validate(loginSchema),loginController); authRouter.post('/refresh',authRateLimit,refreshController); authRouter.post('/logout',logoutController); authRouter.get('/me',requireAuth,meController); authRouter.post('/impersonation-return',requireImpersonation,returnFromImpersonation);




