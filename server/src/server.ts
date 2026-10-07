import {app} from './app.js'; import {connectDb} from './config/db.js'; import {env} from './config/env.js'; import {startCapitalUnlockJob} from './jobs/capital.job.js';
connectDb().then(()=>app.listen(env.PORT,()=>{startCapitalUnlockJob();console.log(`API listening on ${env.PORT}`)})).catch(err=>{console.error('Database connection failed',err);process.exit(1);});
