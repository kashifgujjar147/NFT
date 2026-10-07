import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {env} from '../config/env.js';
const dir=path.resolve(env.UPLOAD_DIR,'public');
fs.mkdirSync(dir,{recursive:true});
const allowed=new Set(['image/jpeg','image/png','image/webp']);
const extensions:Record<string,string>={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'};
function validateName(name:string){const base=path.basename(name);if(base!==name||name.includes('\0')||name.split('.').length>2||/[/\\]/.test(name))throw new Error('Unsafe upload filename');}
export const mediaUpload=multer({
  storage:multer.diskStorage({destination:(_req,_file,cb)=>cb(null,dir),filename:(_req,file,cb)=>{try{validateName(file.originalname);cb(null,`${crypto.randomUUID()}${extensions[file.mimetype]??'.bin'}`);}catch(e){cb(e as Error,'');}}}),
  limits:{fileSize:env.MAX_UPLOAD_BYTES,files:10},
  fileFilter:(_req,file,cb)=>{try{validateName(file.originalname);if(!allowed.has(file.mimetype))return cb(new Error('Unsupported image type'));cb(null,true);}catch(e){cb(e as Error);}},
});
export const mediaDirectory=dir;
