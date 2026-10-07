import {User} from '../models/User.js';
import {Deposit} from '../models/Deposit.js';
import {Withdrawal} from '../models/Withdrawal.js';
import {PackagePurchase} from '../models/PackagePurchase.js';
import {Commission} from '../models/Commission.js';
import {Reward} from '../models/Reward.js';
import {Transaction} from '../models/Transaction.js';
import {Wallet} from '../models/Wallet.js';
import {decryptField} from '../utils/secret-fields.js';
import {teamStats} from './referral.service.js';

export async function dashboardStats(){
  const [members,active,pendingDeposits,pendingWithdrawals,deposits,withdrawals,purchases,commissions,rewards,wallets]=await Promise.all([
    User.countDocuments({role:'member'}),
    User.countDocuments({role:'member',isActive:true}),
    Deposit.countDocuments({status:'pending'}),
    Withdrawal.countDocuments({status:'pending'}),
    Deposit.aggregate([{$match:{status:'approved'}},{$group:{_id:null,total:{$sum:'$amount'}}}]),
    Withdrawal.aggregate([{$match:{status:{$in:['approved','paid']}}},{$group:{_id:null,total:{$sum:'$requestedAmount'}}}]),
    PackagePurchase.aggregate([{$match:{status:'completed'}},{$group:{_id:null,total:{$sum:'$totalAmount'}}}]),
    Commission.aggregate([{$group:{_id:null,total:{$sum:'$amount'}}}]),
    Reward.aggregate([{$group:{_id:null,total:{$sum:'$amount'}}}]),
    Wallet.aggregate([{$group:{_id:null,capital:{$sum:{$add:['$capitalLocked','$capitalAvailable']}},profit:{$sum:'$profit'},commission:{$sum:'$commission'},rewards:{$sum:'$rewards'}}}])
  ]);
  return {members,active,pendingDeposits,pendingWithdrawals,totalDeposits:deposits[0]?.total??0,totalWithdrawals:withdrawals[0]?.total??0,packageSales:purchases[0]?.total??0,totalCommissions:commissions[0]?.total??0,totalRewards:rewards[0]?.total??0,totalCapital:wallets[0]?.capital??0,totalProfit:wallets[0]?.profit??0};
}
export async function searchMembers(q:string,page=1,limit=20){const rx=q?new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'):null;const filter:any={role:'member'};if(rx)filter.$or=[{username:rx},{memberId:rx},{mobile:rx},{fullName:rx},{referralCode:rx}];const safeLimit=Math.min(100,Math.max(1,limit));const safePage=Math.max(1,page);const [items,total]=await Promise.all([User.find(filter).select('-passwordHash -passwordResetTokenHash -paymentDetails').sort({createdAt:-1}).skip((safePage-1)*safeLimit).limit(safeLimit).lean(),User.countDocuments(filter)]);return {items,total,page:safePage,limit:safeLimit,pages:Math.max(1,Math.ceil(total/safeLimit))};}
export async function memberDetail(id:string){const u=await User.findById(id).select('-passwordHash -passwordResetTokenHash -paymentDetails').lean();if(!u)return null;const [wallet,deposits,withdrawals,purchases,txs,commissions,rewards,upliner,team]=await Promise.all([Wallet.findOne({userId:id}).lean(),Deposit.find({userId:id}).sort({createdAt:-1}).limit(100).lean(),Withdrawal.find({userId:id}).sort({createdAt:-1}).limit(100).lean(),PackagePurchase.find({userId:id}).sort({createdAt:-1}).populate('packageId','name price salePrice').lean(),Transaction.find({userId:id}).sort({createdAt:-1}).limit(100).lean(),Commission.find({beneficiaryId:id}).sort({createdAt:-1}).limit(100).lean(),Reward.find({userId:id}).sort({createdAt:-1}).limit(100).lean(),u.uplinerId?User.findById(u.uplinerId).select('username memberId fullName referralCode').lean():null,teamStats(id)]);const masked=(v:string)=>v?`${v.slice(0,2)}${'*'.repeat(Math.max(0,v.length-6))}${v.slice(-4)}`:'—';const userDoc=await User.findById(id).select('paymentDetails').lean();const payment={jazzCash:masked(decryptField(userDoc?.paymentDetails?.jazzCash??'')),easypaisa:masked(decryptField(userDoc?.paymentDetails?.easypaisa??''))};const totalProfit=txs.filter(t=>t.type==='profit'&&t.direction==='credit').reduce((n,t)=>n+Number(t.amount),0);const totalWithdrawals=withdrawals.reduce((n,w)=>n+Number(w.requestedAmount),0);const totalDeposits=deposits.filter(d=>d.status==='approved').reduce((n,d)=>n+Number(d.amount),0);const levels=[team.level1,team.level2,team.level3].map((rows:any[],i)=>({level:i+1,count:rows.length,business:rows.reduce((n,r)=>n+Number(r.business??0),0),commission:rows.reduce((n,r)=>n+Number(r.commission??0),0)}));return {user:u,upliner,payment,referralLink:`/register?ref=${u.referralCode}`,wallet,deposits,withdrawals,purchases:purchases.map((x:any)=>({...x,packageName:x.packageId?.name??'Package'})),transactions:txs,commissions,rewards,team:{levels},summary:{deposits:totalDeposits,withdrawals:totalWithdrawals,capitalAvailable:wallet?.capitalAvailable??0,capitalLocked:wallet?.capitalLocked??0,profit:wallet?.profit??0,totalProfit,rewards:wallet?.rewards??0,commission:wallet?.commission??0}};}
