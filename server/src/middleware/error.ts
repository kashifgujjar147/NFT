import type {ErrorRequestHandler} from 'express'; import multer from 'multer'; import {AppError} from '../utils/errors.js';
export const errorHandler:ErrorRequestHandler=(err,_req,res,_next)=>{
  if(err?.code===11000)return res.status(409).json({success:false,message:'A unique value is already in use'});
  if(err instanceof multer.MulterError)return res.status(400).json({success:false,message:err.code==='LIMIT_FILE_SIZE'?'Uploaded file is too large':'Invalid file upload'});
  if(err instanceof AppError)return res.status(err.statusCode).json({success:false,message:err.message,errors:err.details?[err.details]:undefined});
  if(err instanceof Error&&['Unsupported upload type','Unsupported image type','Unsafe upload filename','Invalid upload metadata'].includes(err.message))return res.status(400).json({success:false,message:err.message});
  if(err instanceof SyntaxError)return res.status(400).json({success:false,message:'Invalid request body'});
  console.error(err); return res.status(500).json({success:false,message:'Internal server error'});
};
