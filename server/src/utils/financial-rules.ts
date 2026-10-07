export function money(value:number){
  if(!Number.isFinite(value)) throw new Error('Invalid money value');
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateWithdrawal(amount:number,feePercent:number){
  const requestedCents=Math.round(amount*100);
  if(!Number.isFinite(amount)||requestedCents<=0)throw new Error('Invalid amount');
  if(!Number.isFinite(feePercent)||feePercent<0||feePercent>100)throw new Error('Invalid fee');
  const feeCents=Math.round(requestedCents*feePercent/100);
  const netCents=requestedCents-feeCents;
  return {requested:requestedCents/100,fee:feeCents/100,net:netCents/100};
}

export function calculateCommission(business:number,rate:number){
  const cents=Math.round(business*100);
  if(cents<0||!Number.isFinite(rate)||rate<0||rate>1)throw new Error('Invalid commission inputs');
  return Math.round(cents*rate)/100;
}

export function capitalUnlockAt(createdAt:Date,lockDays:number){
  if(lockDays<0||!Number.isFinite(lockDays))throw new Error('Invalid lock');
  return new Date(createdAt.getTime()+lockDays*86400000);
}
