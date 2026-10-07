import {Request,Response} from 'express';
import {PackageModel} from '../models/Package.js';
import {ok} from '../utils/api.js';
import {AppError} from '../utils/errors.js';

const MEDIA_IMAGE_PREFIX=/^\/media/;
function cleanImages(value:unknown){if(!Array.isArray(value)||value.length>10)throw new AppError(422,'Invalid image list');const unique=[...new Set(value.filter((x):x is string=>typeof x==='string'&&/^\/media\/[A-Za-z0-9-]+\.(?:jpg|png|webp)$/.test(x)))];if(unique.length!==value.length)throw new AppError(422,'Invalid package image reference');return unique;}
export async function addPackageImages(req:Request,res:Response){const files=(req.files as Express.Multer.File[]|undefined)??[];const urls=files.map(f=>`/media/${f.filename}`);if(!urls.length)throw new AppError(422,'At least one valid image is required');const p=await PackageModel.findByIdAndUpdate(req.params.id,{$push:{images:{$each:urls}}},{new:true});if(!p)return res.status(404).json({success:false,message:'Package not found'});return ok(res,p,'Package images uploaded');}
export async function updatePackageImages(req:Request,res:Response){const images=cleanImages(req.body?.images);const p=await PackageModel.findByIdAndUpdate(req.params.id,{$set:{images}},{new:true,runValidators:true});if(!p)return res.status(404).json({success:false,message:'Package not found'});return ok(res,p,'Package images updated');}
export async function removePackageImage(req:Request,res:Response){const image=String(req.body?.image??'');if(!/^\/media\/[A-Za-z0-9-]+\.(?:jpg|png|webp)$/.test(image))throw new AppError(422,'Invalid image reference');const p=await PackageModel.findByIdAndUpdate(req.params.id,{$pull:{images:image}},{new:true});if(!p)return res.status(404).json({success:false,message:'Package not found'});return ok(res,p,'Package image removed');}

