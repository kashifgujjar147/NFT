import crypto from 'node:crypto';
import {env} from '../config/env.js';

function deriveLegacyKey(){return crypto.createHash('sha256').update(env.JWT_SECRET).digest();}
function getKey(){
  if(!env.ENCRYPTION_KEY) throw new Error('ENCRYPTION_KEY is required for encrypted data operations');
  return crypto.createHash('sha256').update(env.ENCRYPTION_KEY,'utf8').digest();
}
function decryptWithKey(value:string,key:Buffer){
  const [,ivB64,tagB64,dataB64]=value.split(':');
  if(!ivB64||!tagB64||!dataB64)throw new Error('Invalid encrypted field');
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(ivB64,'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64,'base64url')),decipher.final()]).toString('utf8');
}
export function encryptField(value:string){
  if(!value)return '';
  const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',getKey(),iv);
  const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);
  return `v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}
export function decryptField(value:string){
  if(!value)return '';
  if(!value.startsWith('v1:'))return value;
  try{return decryptWithKey(value,getKey());}
  catch{
    // Compatibility for data encrypted before the dedicated ENCRYPTION_KEY was introduced.
    return decryptWithKey(value,deriveLegacyKey());
  }
}
