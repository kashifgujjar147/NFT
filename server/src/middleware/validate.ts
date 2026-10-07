import type {RequestHandler} from 'express'; import {ZodTypeAny} from 'zod'; import {fail} from '../utils/api.js';
export const validate=(schema:ZodTypeAny,source:'body'|'params'|'query'='body'):RequestHandler=>(req,res,next)=>{const parsed=schema.safeParse(req[source]);if(!parsed.success)return fail(res,'Validation failed',422,parsed.error.issues);req[source]=parsed.data;next();};
