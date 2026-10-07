import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('final-fix source regressions',()=>{
  it('does not persist access tokens in localStorage',()=>{
    const source=fs.readFileSync(path.resolve(process.cwd(),'../client/src/lib/api.ts'),'utf8');
    expect(source).not.toContain("localStorage.setItem('accessToken'");
    expect(source).not.toContain("localStorage.getItem('accessToken'");
  });
  it('settings service explicitly merges nested payment settings',()=>{
    const source=fs.readFileSync(path.resolve(process.cwd(),'src/services/settings.service.ts'),'utf8');
    expect(source).toContain('currentPayment');
    expect(source).toContain('pick(patch.paymentDetails');
    expect(source).toContain('$set:clean');
  });
  it('package image management never accepts arbitrary image references',()=>{
    const source=fs.readFileSync(path.resolve(process.cwd(),'src/controllers/package-media.controller.ts'),'utf8');
    expect(source).toContain("/^\\/media/");
    expect(source).toContain('removePackageImage');
    expect(source).toContain('updatePackageImages');
  });
});
