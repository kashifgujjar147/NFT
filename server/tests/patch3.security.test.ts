import {describe,it,expect,beforeEach} from 'vitest';

process.env.NODE_ENV='test';
process.env.MONGODB_URI??='mongodb://127.0.0.1:27017/member_capital_platform_test';
process.env.CLIENT_URL??='http://localhost:5173';
process.env.JWT_SECRET??='test-jwt-secret-that-is-at-least-32-characters-long';
process.env.ENCRYPTION_KEY??='test-encryption-key-that-is-at-least-32-characters-long';
process.env.REFRESH_TOKEN_SECRET??='test-refresh-secret-that-is-at-least-32-characters-long';

const {settingsSchema}=await import('../../shared/schemas/finance.js');
const {bannerCreateSchema,notificationCreateSchema}=await import('../../shared/schemas/content.js');
const {encryptField,decryptField}=await import('../src/utils/secret-fields.js');
import crypto from 'node:crypto';

describe('PATCH 3 validation and encryption',()=>{
  it('allows only safe HTTP/HTTPS settings URLs and rejects javascript URLs',()=>{
    const bad=settingsSchema.safeParse({telegram:{enabled:true,url:'javascript:alert(1)'}});
    expect(bad.success).toBe(false);
    const good=settingsSchema.safeParse({whatsapp:{enabled:true,url:'+923001234567'},telegram:{enabled:true,url:'https://t.me/example'}});
    expect(good.success).toBe(true);
    expect(good.success&&good.data.whatsapp?.url).toBe('https://wa.me/923001234567');
  });

  it('strips unknown settings update fields instead of mass-assigning them',()=>{
    const parsed=settingsSchema.safeParse({withdrawalFeePercent:5,$set:{role:'super_admin'},unknownField:'danger'});
    expect(parsed.success).toBe(true);
    if(parsed.success){expect((parsed.data as any).$set).toBeUndefined();expect((parsed.data as any).unknownField).toBeUndefined();}
  });

  it('validates banner scheduling and rejects an end before start',()=>{
    const result=bannerCreateSchema.safeParse({title:'Sale',imageUrl:'/media/sale.jpg',startAt:'2026-10-10T10:00:00.000Z',endAt:'2026-10-09T10:00:00.000Z'});
    expect(result.success).toBe(false);
  });

  it('validates notification color and repeat interval',()=>{
    expect(notificationCreateSchema.safeParse({title:'Notice',message:'Hello',color:'#D4AF37',frequency:'repeat',repeatIntervalHours:24}).success).toBe(true);
    expect(notificationCreateSchema.safeParse({title:'Notice',message:'Hello',color:'red'}).success).toBe(false);
  });

  it('encrypts new sensitive fields with the dedicated key and decrypts them',()=>{
    const plaintext='03001112222';
    const encrypted=encryptField(plaintext);
    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain(plaintext);
    expect(decryptField(encrypted)).toBe(plaintext);
  });

  it('retains compatibility with legacy JWT-derived encrypted values',()=>{
    const plaintext='03113334444';
    const key=crypto.createHash('sha256').update(process.env.JWT_SECRET!).digest();
    const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
    const encrypted=Buffer.concat([cipher.update(plaintext,'utf8'),cipher.final()]);
    const legacy=`v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
    expect(decryptField(legacy)).toBe(plaintext);
  });
});
