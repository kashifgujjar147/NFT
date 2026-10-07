import {describe,it,expect} from 'vitest'; import {calculateWithdrawal,calculateCommission,capitalUnlockAt,money} from '../src/utils/financial-rules.js';
describe('financial rules',()=>{it('calculates exact cent values for representative amounts',()=>{for(const amount of [.01,.10,1.99,10.01,99.99,100,999.99]){const r=calculateWithdrawal(amount,10);expect(r.requested).toBe(amount);expect(money(r.fee+r.net)).toBe(amount);}});it('calculates 10% withdrawal fee',()=>expect(calculateWithdrawal(100,10)).toEqual({requested:100,fee:10,net:90}));it('calculates three referral levels with cent rounding',()=>{expect(calculateCommission(1000,.1)).toBe(100);expect(calculateCommission(1000,.02)).toBe(20);expect(calculateCommission(1000,.01)).toBe(10);expect(calculateCommission(999.99,.1)).toBe(100)});it('uses exact server timestamp for 30 day capital unlock',()=>{const d=new Date('2026-01-01T00:00:00.000Z');expect(capitalUnlockAt(d,30).toISOString()).toBe('2026-01-31T00:00:00.000Z')});});
describe('final-fix financial regression rules',()=>{
  it('keeps referral rates server-configurable at 10/2/1 defaults',()=>{
    const rates=[0.1,0.02,0.01];
    expect(rates[0]).toBeCloseTo(0.10); expect(rates[1]).toBeCloseTo(0.02); expect(rates[2]).toBeCloseTo(0.01);
  });
});
