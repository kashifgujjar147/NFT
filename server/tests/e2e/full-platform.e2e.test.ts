import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
vi.setConfig({testTimeout:20000});
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest'; import crypto from 'node:crypto';

const uri=process.env.MONGODB_URI;
if(!uri) throw new Error('MONGODB_URI is required for real E2E tests; mocks are not accepted.');

const {app}=await import('../../src/app.js');
const {User}=await import('../../src/models/User.js');
const {AdminSettings}=await import('../../src/models/AdminSettings.js');
const {PackageModel}=await import('../../src/models/Package.js');
const {Deposit}=await import('../../src/models/Deposit.js');
const {Withdrawal}=await import('../../src/models/Withdrawal.js');
const {Wallet}=await import('../../src/models/Wallet.js');
const {Commission}=await import('../../src/models/Commission.js');
const {Transaction}=await import('../../src/models/Transaction.js');
const {AuditLog}=await import('../../src/models/AuditLog.js');
const {PackagePurchase}=await import('../../src/models/PackagePurchase.js');
const {CapitalLock}=await import('../../src/models/CapitalLock.js');
const {createCapital,unlockDueCapital}=await import('../../src/services/capital.service.js');

async function login(username:string,password:string){const r=await request(app).post('/api/auth/login').send({username,password}).expect(200);return {accessToken:r.body.data.accessToken,cookie:r.headers['set-cookie']};}
async function register(username:string,referralCode?:string){const r=await request(app).post('/api/auth/register').send({fullName:username,username,mobile:`03${Math.floor(100000000+Math.random()*899999999)}`,email:`${username}@example.test`,password:'StrongPass!123',referralCode,paymentDetails:{jazzCash:'03009990000',easypaisa:''}}).expect(201);return r.body.data;}

let admin:{token:string};let a:any,b:any,c:any,d:any;let pkg:any;

describe('real MongoDB platform E2E',()=>{
  beforeAll(async()=>{
    await mongoose.connect(uri,{serverSelectionTimeoutMS:5000});
    const hello=await mongoose.connection.db!.admin().command({hello:1});
    if(!hello.setName) throw new Error('MongoDB replica set is required because financial operations use transactions.');
    await mongoose.connection.dropDatabase();
    await AdminSettings.create({key:'global',withdrawalsEnabled:true,withdrawalFeePercent:10,withdrawalCooldownHours:24,capitalLockDays:30,referralRates:{level1:.1,level2:.02,level3:.01}});
    const passwordHash=await bcrypt.hash('AdminStrong!123',12);
    await User.create({fullName:'E2E Admin',username:'e2eadmin',mobile:'03000000001',email:'e2eadmin@example.test',passwordHash,memberId:'E2E-ADMIN',referralCode:'E2E-ADMIN-REF',role:'super_admin'});
    admin=await login('e2eadmin','AdminStrong!123');
    a=await register('membera');b=await register('memberb',a.user.referralCode);c=await register('memberc',b.user.referralCode);d=await register('memberd',c.user.referralCode);
  },30000);

  it('creates the AÃ¢â€ â€™BÃ¢â€ â€™CÃ¢â€ â€™D referral chain',async()=>{
    const rows=await User.find({username:{$in:['membera','memberb','memberc','memberd']}}).lean();
    const map=new Map(rows.map(x=>[x.username,x]));
    expect(map.get('memberb')!.uplinerId!.toString()).toBe(map.get('membera')!._id.toString());
    expect(map.get('memberc')!.uplinerId!.toString()).toBe(map.get('memberb')!._id.toString());
    expect(map.get('memberd')!.uplinerId!.toString()).toBe(map.get('memberc')!._id.toString());
  });

  it('approves a deposit exactly once and records transaction/audit',async()=>{
    const dep=await request(app).post('/api/deposits').set('Authorization',`Bearer ${a.accessToken}`).send({amount:100,paymentMethod:'JazzCash',reference:'E2E-DEP-A-1',details:'test'}).expect(201);
    await request(app).post(`/api/admin/deposits/${dep.body.data._id}/approve`).set('Authorization',`Bearer ${admin.accessToken}`).send({note:'approved'}).expect(200);
    const wallet=await Wallet.findOne({userId:a.user.id}).lean();expect(wallet?.deposit).toBe(100);
    await expect(request(app).post(`/api/admin/deposits/${dep.body.data._id}/approve`).set('Authorization',`Bearer ${admin.accessToken}`).send({})).resolves.toMatchObject({status:404});
    expect(await Transaction.countDocuments({reference:`DEP-${dep.body.data._id}`})).toBe(1);
    expect(await AuditLog.countDocuments({action:'deposit.approve',targetId:dep.body.data._id})).toBe(1);
  });

  it('creates a package and prevents last-item oversell under concurrency',async()=>{
    const created=await request(app).post('/api/admin/packages').set('Authorization',`Bearer ${admin.accessToken}`).send({name:'E2E Package',description:'test',price:50,salePrice:40,quantity:1,active:true,images:[]}).expect(201);
    pkg=created.body.data;
    await Promise.all([b,c].map(x=>request(app).post(`/api/deposits`).set('Authorization',`Bearer ${x.accessToken}`).send({amount:100,paymentMethod:'JazzCash',reference:`E2E-${x.user.username}-DEP`,details:'test'}).then(r=>request(app).post(`/api/admin/deposits/${r.body.data._id}/approve`).set('Authorization',`Bearer ${admin.accessToken}`).send({}))));
    const keys=[crypto.randomUUID(),crypto.randomUUID()];
    const results=await Promise.all([b,c].map((x,i)=>request(app).post(`/api/packages/${pkg._id}/purchase`).set('Authorization',`Bearer ${x.accessToken}`).send({quantity:1,idempotencyKey:keys[i]})));
    expect(results.filter(r=>r.status===201)).toHaveLength(1);
    expect(await PackageModel.findById(pkg._id).then(x=>x!.remainingQuantity)).toBe(0);
    expect(await PackagePurchase.countDocuments({packageId:pkg._id})).toBe(1);
  });

  it('generates exactly 10/2/1 commissions for D business without duplicates',async()=>{
    const dep=await request(app).post('/api/deposits').set('Authorization',`Bearer ${d.accessToken}`).send({amount:100,paymentMethod:'JazzCash',reference:'E2E-DEP-D-1',details:'test'}).expect(201);
    await request(app).post(`/api/admin/deposits/${dep.body.data._id}/approve`).set('Authorization',`Bearer ${admin.accessToken}`).send({}).expect(200);
    const before=await Commission.countDocuments({sourceUserId:d.user.id});
    const created=await request(app).post('/api/admin/packages').set('Authorization',`Bearer ${admin.accessToken}`).send({name:'E2E Commission Package',description:'test',price:50,salePrice:40,quantity:1,active:true,images:[]}).expect(201);
    const key=crypto.randomUUID();
    const purchase=await request(app).post(`/api/packages/${created.body.data._id}/purchase`).set('Authorization',`Bearer ${d.accessToken}`).send({quantity:1,idempotencyKey:key}).expect(201);
    expect(purchase.body.data.totalAmount).toBe(40);
    const rows=await Commission.find({sourceUserId:d.user.id}).sort({level:1}).lean();
    expect(rows.map(x=>x.level)).toEqual([1,2,3]);
    expect(rows.map(x=>x.rate)).toEqual([.1,.02,.01]);
    expect(rows.map(x=>x.amount)).toEqual([4,.8,.4]);
    const retry=await request(app).post(`/api/packages/${created.body.data._id}/purchase`).set('Authorization',`Bearer ${d.accessToken}`).send({quantity:1,idempotencyKey:key}).expect(201);
    expect(retry.body.data._id).toBe(purchase.body.data._id);
    expect(await Commission.countDocuments({sourceUserId:d.user.id})).toBe(before+3);
  });

  it('enforces 30-day capital locking and server-side unlock eligibility',async()=>{
    const c=await createCapital(a.user.id,25,'E2E-CAP-1',a.user.id);
    expect(c.status).toBe('locked');
    expect(c.unlockAt.getTime()-c.createdAt.getTime()).toBe(30*86400000);
    expect(await unlockDueCapital()).toBe(0);
    await request(app).post(`/api/rewards/capital/${c._id}/unlock`).set('Authorization',`Bearer ${a.accessToken}`).send({}).expect(403);
    await CapitalLock.updateOne({_id:c._id},{$set:{unlockAt:new Date(Date.now()-1000)}});
    expect(await unlockDueCapital()).toBe(1);
    const after=await CapitalLock.findById(c._id).lean();expect(after?.status).toBe('unlocked');
    expect(await unlockDueCapital()).toBe(0);
  });

  it('enforces withdrawal fee, cooldown and global switch',async()=>{
    const dep=await request(app).post('/api/deposits').set('Authorization',`Bearer ${a.accessToken}`).send({amount:100,paymentMethod:'JazzCash',reference:'E2E-DEP-A-2',details:'test'}).expect(201);
    await request(app).post(`/api/admin/deposits/${dep.body.data._id}/approve`).set('Authorization',`Bearer ${admin.accessToken}`).send({}).expect(200);
    const first=await request(app).post('/api/withdrawals').set('Authorization',`Bearer ${a.accessToken}`).send({amount:100,paymentMethod:'JazzCash',idempotencyKey:crypto.randomUUID()}).expect(201);
    expect(first.body.data.feeAmount).toBe(10);expect(first.body.data.netAmount).toBe(90);
    await request(app).post(`/api/admin/withdrawals/${first.body.data._id}/approve`).set('Authorization',`Bearer ${admin.accessToken}`).send({}).expect(200);
    const second=await request(app).post('/api/withdrawals').set('Authorization',`Bearer ${a.accessToken}`).send({amount:1,paymentMethod:'JazzCash',idempotencyKey:crypto.randomUUID()});
    expect(second.status).toBe(429);
    await request(app).patch('/api/admin/settings').set('Authorization',`Bearer ${admin.accessToken}`).send({withdrawalsEnabled:false,withdrawalDisabledMessage:'Maintenance'}).expect(200);
    const blocked=await request(app).post('/api/withdrawals').set('Authorization',`Bearer ${b.accessToken}`).send({amount:1,paymentMethod:'JazzCash',idempotencyKey:crypto.randomUUID()});
    expect(blocked.status).toBe(403);
  });

  it('supports admin member search, detail and blocks member IDOR',async()=>{
    const byUsername=await request(app).get('/api/admin/members?q=membera&page=1&limit=20').set('Authorization',`Bearer ${admin.accessToken}`).expect(200);
    expect(byUsername.body.data.items.some((x:any)=>x.username==='membera')).toBe(true);
    const byReferral=await request(app).get(`/api/admin/members?q=${a.user.referralCode}&page=1&limit=20`).set('Authorization',`Bearer ${admin.accessToken}`).expect(200);
    expect(byReferral.body.data.items.some((x:any)=>x._id===a.user.id)).toBe(true);
    const detail=await request(app).get(`/api/admin/members/${a.user.id}`).set('Authorization',`Bearer ${admin.accessToken}`).expect(200);
    expect(detail.body.data.user.username).toBe('membera');
    expect(detail.body.data.payment.jazzCash).toMatch(/^03\*+\d{4}$/);
    await request(app).get('/api/admin/members/not-an-object-id').set('Authorization',`Bearer ${admin.accessToken}`).expect(422);
    await request(app).get(`/api/admin/members/${a.user.id}`).set('Authorization',`Bearer ${a.accessToken}`).expect(403);
  });

  it('supports deposit rejection with reason and audit',async()=>{
    const dep=await request(app).post('/api/deposits').set('Authorization',`Bearer ${b.accessToken}`).send({amount:12,paymentMethod:'JazzCash',reference:'E2E-DEP-REJECT',details:'test'}).expect(201);
    await request(app).post(`/api/admin/deposits/${dep.body.data._id}/reject`).set('Authorization',`Bearer ${admin.accessToken}`).send({note:'Receipt invalid'}).expect(200);
    const row=await Deposit.findById(dep.body.data._id).lean();expect(row?.status).toBe('rejected');expect(row?.adminNote).toBe('Receipt invalid');
    expect(await AuditLog.countDocuments({action:'deposit.reject',targetId:dep.body.data._id})).toBe(1);
  });

  it('supports package edit, activation and inventory management',async()=>{
    const created=await request(app).post('/api/admin/packages').set('Authorization',`Bearer ${admin.accessToken}`).send({name:'Admin CRUD Package',description:'crud',price:100,salePrice:80,quantity:5,active:true,images:[]}).expect(201);
    const id=created.body.data._id;
    await request(app).patch(`/api/admin/packages/${id}`).set('Authorization',`Bearer ${admin.accessToken}`).send({name:'Admin CRUD Package Updated',price:110,salePrice:90}).expect(200);
    await request(app).post(`/api/admin/packages/${id}/status`).set('Authorization',`Bearer ${admin.accessToken}`).send({active:false}).expect(200);
    expect((await PackageModel.findById(id).lean())?.active).toBe(false);
    await request(app).post(`/api/admin/packages/${id}/status`).set('Authorization',`Bearer ${admin.accessToken}`).send({active:true}).expect(200);
    await request(app).post(`/api/admin/packages/${id}/inventory`).set('Authorization',`Bearer ${admin.accessToken}`).send({quantity:8}).expect(200);
    expect((await PackageModel.findById(id).lean())?.remainingQuantity).toBe(8);
    await request(app).patch(`/api/admin/packages/${id}`).set('Authorization',`Bearer ${admin.accessToken}`).send({price:-1}).expect(422);
  });

  it('records reward, profit and capital admin operations through financial endpoints',async()=>{
    const rewardRef=`E2E-REWARD-${Date.now()}`;
    await request(app).post('/api/rewards').set('Authorization',`Bearer ${admin.accessToken}`).send({userId:a.user.id,amount:7.5,type:'salary',reason:'Performance',sourceReference:rewardRef}).expect(201);
    expect(await Transaction.countDocuments({reference:/^REWARD-/})).toBeGreaterThan(0);
    const profitRef=`E2E-PROFIT-${Date.now()}`;
    await request(app).post('/api/rewards/profit').set('Authorization',`Bearer ${admin.accessToken}`).send({userId:a.user.id,amount:3.25,reason:'Profit adjustment',sourceReference:profitRef}).expect(201);
    const capRef=`E2E-CAP-ADMIN-${Date.now()}`;
    await request(app).post('/api/rewards/capital').set('Authorization',`Bearer ${admin.accessToken}`).send({userId:a.user.id,amount:11,sourceReference:capRef}).expect(201);
    await request(app).post('/api/rewards').set('Authorization',`Bearer ${admin.accessToken}`).send({userId:a.user.id,amount:-1,type:'salary',reason:'Invalid',sourceReference:`E2E-BAD-${Date.now()}`}).expect(422);
    await request(app).post('/api/rewards').set('Authorization',`Bearer ${a.accessToken}`).send({userId:b.user.id,amount:5,type:'salary',reason:'forbidden',sourceReference:`E2E-FORBIDDEN-${Date.now()}`}).expect(403);
  });

  it('rejects normal-admin super-admin escalation',async()=>{
    const create=await request(app).post('/api/admin/admins').set('Authorization',`Bearer ${admin.accessToken}`).send({fullName:'Normal Admin',username:'normaladmin',mobile:'03000000002',password:'AdminStrong!123',role:'admin'}).expect(201);
    const normal=await login('normaladmin','AdminStrong!123');
    const target=create.body.data._id;
    await request(app).patch(`/api/admin/admins/${target}/role`).set('Authorization',`Bearer ${normal.accessToken}`).send({role:'super_admin'}).expect(403);
  });

  afterAll(async()=>{await mongoose.disconnect();});
});

// PATCH 3 coverage: banners, notifications, settings, payment security and uploads.
// These tests use the real MongoDB-backed API; no mocks are introduced.
describe('PATCH 3 real MongoDB coverage',()=>{
  beforeAll(async()=>{await mongoose.connect(uri,{serverSelectionTimeoutMS:5000});});
  afterAll(async()=>{await mongoose.disconnect();});

  it('filters active, scheduled, expired and inactive banners',async()=>{
    const {Banner}=await import('../../src/models/Banner.js');
    await Banner.deleteMany({});
    const now=Date.now();
    await Banner.create([
      {title:'Active banner',imageUrl:'/media/active.jpg',active:true,startAt:new Date(now-3600000),endAt:new Date(now+3600000)},
      {title:'Inactive banner',imageUrl:'/media/inactive.jpg',active:false},
      {title:'Scheduled banner',imageUrl:'/media/scheduled.jpg',active:true,startAt:new Date(now+3600000)},
      {title:'Expired banner',imageUrl:'/media/expired.jpg',active:true,endAt:new Date(now-3600000)},
    ]);
    const response=await request(app).get('/api/content/banners').expect(200);
    expect(response.body.data.map((x:any)=>x.title)).toEqual(['Active banner']);
  });

  it('enforces notification schedule and once-dismiss state',async()=>{
    const {Notification}=await import('../../src/models/Notification.js');
    await Notification.deleteMany({});
    const now=Date.now();
    await Notification.create([
      {title:'Visible',message:'Visible message',active:true},
      {title:'Scheduled',message:'Later',active:true,startAt:new Date(now+3600000)},
      {title:'Expired',message:'Gone',active:true,endAt:new Date(now-3600000)},
      {title:'Inactive',message:'Off',active:false},
    ]);
    const first=await request(app).get('/api/content/notifications').set('Authorization',`Bearer ${a.accessToken}`).expect(200);
    expect(first.body.data.map((x:any)=>x.title)).toEqual(['Visible']);
    await request(app).post(`/api/content/notifications/${first.body.data[0]._id}/dismiss`).set('Authorization',`Bearer ${a.accessToken}`).expect(200);
    const second=await request(app).get('/api/content/notifications').set('Authorization',`Bearer ${a.accessToken}`).expect(200);
    expect(second.body.data).toHaveLength(0);
    const history=await request(app).get('/api/content/notifications/history').set('Authorization',`Bearer ${a.accessToken}`).expect(200);
    expect(history.body.data[0].dismissedAt).toBeTruthy();
  });

  it('rejects unsafe settings URLs and accepts validated WhatsApp/Telegram configuration',async()=>{
    await request(app).patch('/api/admin/settings').set('Authorization',`Bearer ${admin.accessToken}`).send({whatsapp:{enabled:true,url:'javascript:alert(1)'}}).expect(422);
    const okResponse=await request(app).patch('/api/admin/settings').set('Authorization',`Bearer ${admin.accessToken}`).send({whatsapp:{enabled:true,url:'+923001234567'},telegram:{enabled:true,url:'https://t.me/example'},minimumWithdrawal:10,maximumWithdrawal:1000}).expect(200);
    expect(okResponse.body.data.whatsapp.url).toBe('https://wa.me/923001234567');
    expect(okResponse.body.data.minimumWithdrawal).toBe(10);
    expect(okResponse.body.data.maximumWithdrawal).toBe(1000);
  });

  it('blocks withdrawal below/above server-configured limits and respects global disable',async()=>{
    await request(app).patch('/api/admin/settings').set('Authorization',`Bearer ${admin.accessToken}`).send({withdrawalsEnabled:true,minimumWithdrawal:10,maximumWithdrawal:20,withdrawalCooldownHours:0,withdrawalFeePercent:5}).expect(200);
    const tooSmall=await request(app).post('/api/withdrawals').set('Authorization',`Bearer ${a.accessToken}`).send({amount:5,paymentMethod:'JazzCash',idempotencyKey:crypto.randomUUID()});
    expect(tooSmall.status).toBe(422);
    const tooLarge=await request(app).post('/api/withdrawals').set('Authorization',`Bearer ${a.accessToken}`).send({amount:25,paymentMethod:'JazzCash',idempotencyKey:crypto.randomUUID()});
    expect(tooLarge.status).toBe(422);
    await request(app).patch('/api/admin/settings').set('Authorization',`Bearer ${admin.accessToken}`).send({withdrawalsEnabled:false,withdrawalDisabledMessage:'Maintenance window'}).expect(200);
    const blocked=await request(app).post('/api/withdrawals').set('Authorization',`Bearer ${a.accessToken}`).send({amount:10,paymentMethod:'JazzCash',idempotencyKey:crypto.randomUUID()});
    expect(blocked.status).toBe(403);
    await request(app).patch('/api/admin/settings').set('Authorization',`Bearer ${admin.accessToken}`).send({withdrawalsEnabled:true,minimumWithdrawal:0,maximumWithdrawal:100000000}).expect(200);
  });

  it('keeps payment-detail changes encrypted and pending until admin approval',async()=>{
    const before=await request(app).get('/api/payment-details').set('Authorization',`Bearer ${a.accessToken}`).expect(200);
    expect(before.body.data.jazzCash).toMatch(/\d{4}$/);
    const submitted=await request(app).post('/api/payment-details/change-request').set('Authorization',`Bearer ${a.accessToken}`).send({currentPassword:'StrongPass!123',jazzCash:'03001112222',easypaisa:'03113334444'}).expect(201);
    const {PaymentChangeRequest}=await import('../../src/models/PaymentChangeRequest.js');
    const pending=await PaymentChangeRequest.findById(submitted.body.data._id).select('+jazzCash +easypaisa').lean();
    expect(pending?.status).toBe('pending');
    expect(pending?.jazzCash).toMatch(/^v1:/);expect(pending?.easypaisa).toMatch(/^v1:/);
    expect(pending?.jazzCash).not.toContain('03001112222');
    const stillOld=await request(app).get('/api/payment-details').set('Authorization',`Bearer ${a.accessToken}`).expect(200);
    expect(stillOld.body.data.jazzCash).toBe(before.body.data.jazzCash);
    await request(app).post(`/api/admin/payment-change-requests/${submitted.body.data._id}/review`).set('Authorization',`Bearer ${admin.accessToken}`).send({approve:true}).expect(200);
    const approved=await request(app).get('/api/payment-details').set('Authorization',`Bearer ${a.accessToken}`).expect(200);
    expect(approved.body.data.jazzCash).toBe('\u2022\u2022\u2022\u20222222');
  });

  it('protects member receipt access and rejects invalid upload content',async()=>{
    const jpeg=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=','base64');
    const dep=await request(app).post('/api/deposits').set('Authorization',`Bearer ${a.accessToken}`).attach('receipt',jpeg,'receipt.jpg').field('amount','15').field('paymentMethod','JazzCash').field('reference',`E2E-UPLOAD-${Date.now()}`).field('details','receipt').expect(201);
    await request(app).get(`/api/deposits/${dep.body.data._id}/receipt`).set('Authorization',`Bearer ${a.accessToken}`).expect(200);
    await request(app).get(`/api/deposits/${dep.body.data._id}/receipt`).set('Authorization',`Bearer ${b.accessToken}`).expect(404);
    const bad=await request(app).post('/api/deposits').set('Authorization',`Bearer ${a.accessToken}`).attach('receipt',Buffer.from('<script>alert(1)</script>'),'receipt.jpg').field('amount','15').field('paymentMethod','JazzCash').field('reference',`E2E-BAD-UPLOAD-${Date.now()}`).field('details','bad');
    expect([400,422]).toContain(bad.status);
  });

  it('rejects member access to admin banner/notification management',async()=>{
    await request(app).post('/api/admin/notifications').set('Authorization',`Bearer ${a.accessToken}`).send({title:'Nope',message:'Nope'}).expect(403);
    await request(app).get('/api/admin/banners').set('Authorization',`Bearer ${a.accessToken}`).expect(403);
    await request(app).get('/api/admin/settings').set('Authorization',`Bearer ${a.accessToken}`).expect(403);
  });
});

