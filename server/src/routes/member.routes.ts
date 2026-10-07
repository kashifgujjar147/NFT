import {Router} from 'express';
import {commission} from '../controllers/commission.controller.js'; import {memberSupport,memberSupportMessage} from '../controllers/support.controller.js'; import {requireAuth} from '../middleware/auth.js'; import {memberSummary} from '../controllers/member.controller.js'; export const memberRouter=Router(); memberRouter.use(requireAuth); memberRouter.get('/summary',memberSummary); memberRouter.get('/commission',commission); memberRouter.get('/support',memberSupport); memberRouter.post('/support/messages',memberSupportMessage); memberRouter.get('/support',memberSupport); memberRouter.post('/support/messages',memberSupportMessage);



