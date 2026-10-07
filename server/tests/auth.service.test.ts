import {describe,expect,it} from 'vitest';
import {COMMISSION_RATES} from '../../shared/constants/index.js';
import {calculateCommission} from '../src/utils/financial-rules.js';

describe('foundation rules',()=>{
  it('uses the required configurable three-level commission defaults',()=>{
    expect(COMMISSION_RATES).toEqual({level1:.1,level2:.02,level3:.01});
    expect(calculateCommission(1000,COMMISSION_RATES.level1)).toBe(100);
    expect(calculateCommission(1000,COMMISSION_RATES.level2)).toBe(20);
    expect(calculateCommission(1000,COMMISSION_RATES.level3)).toBe(10);
  });
});
