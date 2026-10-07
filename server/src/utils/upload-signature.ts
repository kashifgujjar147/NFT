import fs from 'node:fs/promises';
import type {NextFunction,Request,Response} from 'express';
import {AppError} from './errors.js';

const MAX_IMAGE_DIMENSION=4096;
function matches(buffer:Buffer,mime:string){
  if(mime==='image/jpeg')return buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff;
  if(mime==='image/png')return buffer.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if(mime==='image/webp')return buffer.subarray(0,4).toString('ascii')==='RIFF'&&buffer.subarray(8,12).toString('ascii')==='WEBP';
  if(mime==='application/pdf')return buffer.subarray(0,5).toString('ascii')==='%PDF-';
  return false;
}
function dimensions(buffer:Buffer,mime:string){
  if(mime==='image/png'&&buffer.length>=24)return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20)};
  if(mime==='image/webp'&&buffer.length>=30&&buffer.subarray(12,16).toString('ascii')==='VP8X'){
    return {width:1+buffer[24]+(buffer[25]<<8)+(buffer[26]<<16),height:1+buffer[27]+(buffer[28]<<8)+(buffer[29]<<16)};
  }
  if(mime==='image/jpeg'){
    let i=2;
    while(i+9<buffer.length){
      if(buffer[i]!==0xff){i++;continue;}
      while(i<buffer.length&&buffer[i]===0xff)i++;
      const marker=buffer[i++];
      if(marker===0xd8||marker===0xd9||marker===0x01)continue;
      if(i+1>=buffer.length)break;
      const length=buffer.readUInt16BE(i);if(length<2||i+length>buffer.length)break;
      if((marker>=0xc0&&marker<=0xc3)||(marker>=0xc5&&marker<=0xc7)||(marker>=0xc9&&marker<=0xcb)||(marker>=0xcd&&marker<=0xcf)){
        return {height:buffer.readUInt16BE(i+3),width:buffer.readUInt16BE(i+5)};
      }
      i+=length;
    }
  }
  return null;
}
const safeExt:Record<string,string>={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','application/pdf':'.pdf'};
export async function validateUploadedFileSignature(req:Request,_res:Response,next:NextFunction){
  try{
    const files:any[]=req.files?Array.isArray(req.files)?req.files:Object.values(req.files).flat():[];
    const one:any=(req as any).file;if(one)files.push(one);
    for(const file of files){
      if(!safeExt[file.mimetype]||pathExt(file.path)!==safeExt[file.mimetype]){await fs.rm(file.path,{force:true});throw new AppError(400,'Invalid upload metadata');}
      const full=await fs.readFile(file.path);const header=full.subarray(0,Math.min(full.length,1024*1024));
      if(!matches(header,file.mimetype)){await fs.rm(file.path,{force:true});throw new AppError(400,'Uploaded file content does not match its declared type');}
      if(file.mimetype.startsWith('image/')){const size=dimensions(header,file.mimetype);if(size&&(size.width>MAX_IMAGE_DIMENSION||size.height>MAX_IMAGE_DIMENSION)){await fs.rm(file.path,{force:true});throw new AppError(400,`Image dimensions exceed ${MAX_IMAGE_DIMENSION}px`);}}
    }
    next();
  }catch(error){next(error);}
}
function pathExt(filePath:string){return filePath.slice(filePath.lastIndexOf('.')).toLowerCase();}
