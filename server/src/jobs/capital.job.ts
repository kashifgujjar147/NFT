import {unlockDueCapital} from '../services/capital.service.js';
import {matureDuePackages} from '../services/package.service.js';

export function startCapitalUnlockJob(){
  const run=async()=>{
    try{await unlockDueCapital();}catch(err){console.error('capital unlock job',err);}
    try{await matureDuePackages();}catch(err){console.error('package maturity job',err);}
  };
  run();
  return setInterval(run,60_000);
}
