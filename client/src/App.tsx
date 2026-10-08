import {useEffect,useState} from 'react';
import type {ReactNode,FormEvent} from 'react';
import {Link,Routes,Route,useNavigate,useParams, NavLink} from 'react-router-dom';
import {api,setAccessToken,getAccessToken} from './lib/api';
import {House,Gem, Package, WalletCards,ArrowUpRight,MessageCircle,UserRound} from 'lucide-react';

type ApiState<T>={data:T|null;loading:boolean;error:string};
function useApi<T>(url:string):ApiState<T>&{reload:()=>void}{const [data,setData]=useState<T|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[refresh,setRefresh]=useState(0);useEffect(()=>{let live=true;setLoading(true);api.get(url).then(r=>live&&setData(r.data.data)).catch(e=>live&&setError(e?.response?.data?.message??'Unable to load')).finally(()=>live&&setLoading(false));return()=>{live=false};},[url,refresh]);return {data,loading,error,reload:()=>setRefresh(v=>v+1)};}
function Protected({children,admin=false,superAdmin=false}:{children:ReactNode;admin?:boolean;superAdmin?:boolean}){const [checking,setChecking]=useState(!getAccessToken());const [ready,setReady]=useState(!!getAccessToken());const member=JSON.parse(localStorage.getItem('member')||'null');useEffect(()=>{if(getAccessToken()){setChecking(false);setReady(true);return;}let live=true;api.post('/auth/refresh').then(r=>{if(!live)return;setAccessToken(r.data.data.accessToken);localStorage.setItem('member',JSON.stringify(r.data.data.user));setReady(true)}).catch(()=>{if(live)setReady(false)}).finally(()=>live&&setChecking(false));return()=>{live=false}},[]);if(checking)return <main className="auth"><div className="auth-card"><p>Restoring secure session...</p></div></main>;if(!ready)return <NavigateTo to="/login"/>;if(superAdmin&&member?.role!=='super_admin')return <NavigateTo to="/"/>;if(admin&&!['admin','super_admin'].includes(member?.role))return <NavigateTo to="/"/>;return <>{children}</>}
function NavigateTo({to}:{to:string}){const n=useNavigate();useEffect(()=>{n(to,{replace:true});},[n,to]);return null;}
function PageTitle({title,text}:{title:string;text:string}){return <section className="page-title"><span className="eyebrow">NEXUS PLATFORM</span><h1>{title}</h1><p>{text}</p></section>}
function Card({title,value}:{title:string;value:string}){return <div className="card"><span>{title}</span><strong>{value}</strong></div>}
function List({title,rows,cols}:{title:string;rows:Record<string,unknown>[];cols:string[]}){return <section className="panel list"><h2>{title}</h2>{rows.length?rows.map(r=><div className="row" key={String(r._id)}>{cols.map(c=><span key={c}>{c.toLowerCase().includes('amount')?`$${Number(r[c]??0).toFixed(2)}`:String(r[c]??'-')}</span>)}</div>):<p className="muted">No records yet.</p>}</section>}
function Shell({children,title='NEXUS MEMBER'}:{children:ReactNode;title?:string}){
  const n=useNavigate();
  const member=JSON.parse(localStorage.getItem('member')||'null');
  const impersonation=JSON.parse(localStorage.getItem('impersonationSession')||'null');

  const logout=async()=>{
    try{await api.post('/auth/logout')}finally{
      setAccessToken(null);
      localStorage.removeItem('member');
      localStorage.removeItem('impersonationSession');
      n('/login');
    }
  };

  const returnToAdmin=async()=>{
    if(!impersonation?.returnToken)return;
    try{
      const r=await api.post('/auth/impersonation-return',{returnToken:impersonation.returnToken});
      setAccessToken(r.data.data.accessToken);
      localStorage.setItem('member',JSON.stringify(r.data.data.user));
      localStorage.removeItem('impersonationSession');
      n('/admin');
    }catch(e:any){
      setAccessToken(null);
      localStorage.removeItem('member');
      localStorage.removeItem('impersonationSession');
      n('/login');
    }
  };

  return <div className="shell">
    {impersonation&&<div className="notice" style={{margin:0,borderRadius:0,display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
      <span><strong>IMPERSONATING:</strong> {member?.username??'Member'} ó admin actions are disabled in this session.</span>
      <button onClick={returnToAdmin}>Return to Admin</button>
    </div>}
    <header>
      <Link className="back" to="/">NEXUS<span>MEMBER</span></Link>
      <div className="head-actions">
        {!impersonation&&['admin','super_admin'].includes(member?.role)&&<Link to="/admin" className="header-link">Admin</Link>}
        <button onClick={impersonation?returnToAdmin:logout}>{impersonation?'Return to Admin':'Logout'}</button>
      </div>
    </header>
    <main className="content">{children}</main>
    <nav className="bottom"><NavLink to="/" end><span className="nav-icon"><House size={22}/></span><span>Home</span></NavLink><NavLink to="/packages"><span className="nav-icon"><Gem size={22}/></span><span>NFT</span></NavLink><NavLink to="/active-packages"><span className="nav-icon"><Package size={22}/></span><span>Packages</span></NavLink><NavLink to="/deposit"><span className="nav-icon"><WalletCards size={22}/></span><span>Deposit</span></NavLink><NavLink to="/withdrawal"><span className="nav-icon"><ArrowUpRight size={22}/></span><span>Withdraw</span></NavLink><NavLink to="/support"><span className="nav-icon"><MessageCircle size={22}/></span><span>Support</span></NavLink><NavLink to="/account"><span className="nav-icon"><UserRound size={22}/></span><span>Account</span></NavLink></nav>
  </div>
}
function Auth(){const n=useNavigate();const [mode,setMode]=useState<'login'|'register'>('login');const referralFromUrl=new URLSearchParams(location.search).get('ref')?.trim()??'';const [form,setForm]=useState({username:'',password:'',fullName:'',mobile:'',email:'',referralCode:mode==='register'?referralFromUrl:'',jazzCash:'',easypaisa:''});useEffect(()=>{if(mode==='register'&&referralFromUrl)setForm(f=>({...f,referralCode:referralFromUrl.toUpperCase()}));},[mode,referralFromUrl]);const [error,setError]=useState('');const submit=async(e:FormEvent)=>{e.preventDefault();setError('');try{const body=mode==='login'?{username:form.username,password:form.password}:{...form,paymentDetails:{jazzCash:form.jazzCash,easypaisa:form.easypaisa}};const r=await api.post(mode==='login'?'/auth/login':'/auth/register',body);setAccessToken(r.data.data.accessToken);localStorage.setItem('member',JSON.stringify(r.data.data.user));localStorage.setItem('showWhatsappJoinPrompt','1');n('/');}catch(err:any){setError(err?.response?.data?.message??'Request failed')}};return <main className="auth"><div className="auth-card"><div className="brand">NEXUS<span>MEMBER</span></div><h1>{mode==='login'?'Welcome back':'Create your account'}</h1><p className="muted">Secure member workspace with server-authoritative financial data.</p>{error&&<div className="alert">{error}</div>}<form onSubmit={submit}>{mode==='register'&&<><input required placeholder="Full name" value={form.fullName} onChange={e=>setForm({...form,fullName:e.target.value})}/><input required placeholder="Mobile number" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})}/><input required type="email" placeholder="Email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/><input placeholder="Referral code" value={form.referralCode} readOnly={Boolean(referralFromUrl)} onChange={e=>setForm({...form,referralCode:e.target.value.toUpperCase()})}/></>}<input required placeholder="Username" value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/><input required type="password" minLength={10} placeholder="Password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/><button className="primary">{mode==='login'?'Sign in':'Register'}</button></form>{mode==='login'&&<Link className="back-link" to="/forgot-password">Forgot password?</Link>}<button className="link-btn" onClick={()=>setMode(mode==='login'?'register':'login')}>{mode==='login'?'Create a new account':'Already have an account?'}</button></div></main>}
function Forgot(){const [email,setEmail]=useState(''),[msg,setMsg]=useState('');return <main className="auth"><div className="auth-card"><div className="brand">NEXUS<span>MEMBER</span></div><h1>Reset password</h1><form className="form" onSubmit={async e=>{e.preventDefault();try{await api.post('/security/forgot-password',{email});setMsg('If the account exists, reset instructions were initiated.')}catch(err:any){setMsg(err?.response?.data?.message??'Request failed')}}}><input required type="email" placeholder="Registered Email" value={email} onChange={e=>setEmail(e.target.value)}/><button className="primary">Send reset instructions</button></form>{msg&&<div className="notice">{msg}</div>}<Link className="back-link" to="/login">Back to login</Link></div></main>}
function Reset(){const token=new URLSearchParams(location.search).get('token')??'';const [password,setPassword]=useState(''),[msg,setMsg]=useState('');return <main className="auth"><div className="auth-card"><div className="brand">NEXUS<span>MEMBER</span></div><h1>Choose a new password</h1><form className="form" onSubmit={async e=>{e.preventDefault();try{await api.post('/security/reset-password',{token,newPassword:password});setMsg('Password reset. You can now sign in.')}catch(err:any){setMsg(err?.response?.data?.message??'Reset failed')}}}><input required minLength={10} type="password" placeholder="New password" value={password} onChange={e=>setPassword(e.target.value)}/><button className="primary">Reset password</button></form>{msg&&<div className="notice">{msg}</div>}<Link className="back-link" to="/login">Back to login</Link></div></main>}
function Dashboard(){const {data,loading,error}=useApi<any>('/members/summary');const [showWhatsapp,setShowWhatsapp]=useState(localStorage.getItem('showWhatsappJoinPrompt')==='1');const {data:banners,loading:bannerLoading}=useApi<any[]>('/content/banners');const {data:notes}=useApi<any[]>('/content/notifications');const {data:publicSettings}=useApi<any>('/content/settings');const member=JSON.parse(localStorage.getItem('member')||'null');return <Shell><section className="hero"><div><span className="eyebrow">MEMBER DASHBOARD</span><h1>Welcome, {data?.user?.username??member?.username??'Member'}</h1><p>Upliner: <strong>{data?.user?.uplinerName??'-'}</strong></p></div><div className="member-id"><small>MEMBER ID</small><strong>{data?.user?.memberId??member?.memberId??'-'}</strong><button onClick={()=>navigator.clipboard.writeText(`${location.origin}/register?ref=${data?.user?.referralCode??member?.referralCode??''}`)}>Copy referral link</button></div></section><BannerCarousel banners={banners??[]} loading={bannerLoading}/>{showWhatsapp&&<div className='modal-backdrop'><div className='modal' style={{maxWidth:480,position:'relative'}}><button type='button' aria-label='Close' onClick={()=>{localStorage.removeItem('showWhatsappJoinPrompt');setShowWhatsapp(false)}} style={{position:'absolute',top:12,right:12,width:36,height:36,padding:0,fontSize:22,lineHeight:1}}>◊</button><span className='eyebrow'>WHATSAPP CHANNEL</span><h2>Join our WhatsApp Channel</h2><p className='muted'>Stay updated with the latest announcements, offers and important updates.</p><div className='modal-actions'><a className='primary' href='https://whatsapp.com/channel/0029VbDEDXl1XqudTC6fmS25' target='_blank' rel='noreferrer'>Join WhatsApp Channel</a><button onClick={()=>{localStorage.removeItem('showWhatsappJoinPrompt');setShowWhatsapp(false)}}>I Have Already Joined</button></div></div></div>}{notes?.length?<NotificationPopup note={notes[0]}/>:null}{loading?<p>Loading secure account data...</p>:error?<div className="alert">{error}<button onClick={()=>location.reload()}>Retry</button></div>:<><div className="grid">{[['Total Deposit',data?.wallet?.totalDeposits],['Available',data?.wallet?.available],['Capital locked',data?.wallet?.capitalLocked],['Capital available',data?.wallet?.capitalAvailable],['Profit',data?.wallet?.profit],['Commission',data?.wallet?.commission],['Rewards',data?.wallet?.rewards]].map(([k,v])=><Card key={String(k)} title={String(k)} value={`$${Number(v??0).toFixed(2)}`}/>)}</div><section className="grid team-dashboard-summary"><Card title="Total Team" value={String(data?.team?.total??0)}/><Card title="Team Business" value={`$${Number(data?.team?.totalBusiness??0).toFixed(2)}`}/><Card title="Level 1" value={String(data?.team?.level1?.length??0)}/><Card title="Level 2" value={String(data?.team?.level2?.length??0)}/><Card title="Level 3" value={String(data?.team?.level3?.length??0)}/></section><section className="panel actions"><Link to="/active-packages">My Packages</Link><Link to="/team">Team Details</Link><Link to="/commission">Commission</Link><Link to="/capital">Capital</Link><Link to="/profit">Profit</Link><Link to="/rewards">Rewards</Link><Link to="/transactions">Transactions</Link></section>{(publicSettings?.whatsapp?.enabled||publicSettings?.telegram?.enabled)&&<section className="panel actions">{publicSettings?.whatsapp?.enabled&&<a href="https://whatsapp.com/channel/0029VbDEDXl1XqudTC6fmS25" target="_blank" rel="noreferrer">WhatsApp Channel</a>}{publicSettings?.telegram?.enabled&&<a href="https://t.me/+RzEEUG6MZwY4MTU0" target="_blank" rel="noreferrer">Telegram</a>}</section>}</>}</Shell>}
function BannerCarousel({banners,loading}:{banners:any[];loading:boolean}){const [index,setIndex]=useState(0);useEffect(()=>{if(banners.length<2)return;const timer=setInterval(()=>setIndex(i=>(i+1)%banners.length),5000);return()=>clearInterval(timer)},[banners.length]);useEffect(()=>{if(index>=banners.length)setIndex(0)},[index,banners.length]);if(loading)return <section className="banner-carousel skeleton"><div>Loading promotions...</div></section>;if(!banners.length)return <section className="banner-empty"><strong>No active promotions</strong><span>Check back soon for new offers.</span></section>;const b=banners[index];const content=<><div className="banner-media">{b.imageUrl?<img key={b._id} src={assetUrl(b.imageUrl)} alt={b.title} onError={e=>{e.currentTarget.style.display='none';e.currentTarget.parentElement?.classList.add('broken')}}/>:<div className="banner-fallback">PROMO</div>}</div><div className="banner-copy"><span className="eyebrow">{b.promoType==='nft'?'NFT':b.promoType==='sale'?'LIMITED SALE':'FEATURED'}</span><h2>{b.title}</h2>{b.description&&<p>{b.description}</p>}{b.offerText&&<strong>{b.offerText}</strong>}</div></>;return <section className="banner-carousel"><div className="banner-stage">{b.destinationUrl?<a href={b.destinationUrl} target="_blank" rel="noreferrer">{content}</a>:content}</div>{banners.length>1&&<div className="banner-controls"><button aria-label="Previous banner" onClick={()=>setIndex((index-1+banners.length)%banners.length)}>&lt;</button><div>{banners.map((x,i)=><button className={i===index?'dot active':'dot'} aria-label={`Banner ${i+1}`} key={x._id} onClick={()=>setIndex(i)} />)}</div><button aria-label="Next banner" onClick={()=>setIndex((index+1)%banners.length)}>&gt;</button></div>}</section>}
function NotificationPopup({note}:{note:any}){const [open,setOpen]=useState(true);const [busy,setBusy]=useState(false);if(!open)return null;const close=async(dismiss:boolean)=>{setBusy(true);try{await api.post(`/content/notifications/${note._id}/${dismiss?'dismiss':'read'}`);setOpen(false)}catch{setOpen(false)}finally{setBusy(false)}};return <div className="modal-backdrop"><div className={`modal notification-modal notification-${note.type??'info'}`} style={{borderTopColor:note.color??'#D4AF37'}}><span className="eyebrow">{note.type??'NOTICE'}</span><h2>{note.title}</h2><p>{note.message}</p><div className="modal-actions"><button className="primary" disabled={busy} onClick={()=>close(!!note.dismissible)}>{busy?'Saving...':note.dismissible?'Dismiss':'Mark as read'}</button></div></div></div>}
function Deposit(){
  const params=new URLSearchParams(location.search);
  const requestedPackagePurchaseId=params.get('packagePurchaseId')??'';
  const requestedPackageId=params.get('packageId')??'';
  const requestedAmount=params.get('amount')??'';

  const [f,setF]=useState({
    amount:requestedAmount,
    paymentMethod:'BEP20',
    reference:'',
    details:'',
    receipt:null as File|null,
    depositType:requestedPackageId?'package':'wallet',
    packagePurchaseId:requestedPackagePurchaseId,
    packageId:requestedPackageId
  });

  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);

  const {data,loading,error,reload}=useApi<any[]>('/deposits');
  const {data:settings,loading:settingsLoading}=useApi<any>('/content/settings');
  const {data:purchases}=useApi<any[]>('/packages/purchases');
  const {data:packages}=useApi<any[]>('/packages');

  const bep20=settings?.paymentDetails?.bep20Active!==false;
  const bep20Address=String(settings?.paymentDetails?.bep20Address??'').trim();
  const bep20Network=settings?.paymentDetails?.bep20Network??'BEP20 / BNB Smart Chain';

  const pendingPackage=purchases?.find(
    (p:any)=>p._id===f.packagePurchaseId&&p.status==='pending'
  );
  const selectedPackage=packages?.find(
    (p:any)=>p._id===f.packageId
  );

  useEffect(()=>{
    if(selectedPackage&&f.packageId&&!f.packagePurchaseId){
      setF((x:any)=>({
        ...x,
        amount:String(
          selectedPackage.salePrice??
          selectedPackage.price??
          ''
        ),
        depositType:'package',
        paymentMethod:'BEP20'
      }));
    }
  },[
    selectedPackage?._id,
    selectedPackage?.salePrice,
    selectedPackage?.price,
    f.packageId,
    f.packagePurchaseId
  ]);

  useEffect(()=>{
    if(pendingPackage){
      setF((x:any)=>({
        ...x,
        amount:String(pendingPackage.totalAmount??''),
        depositType:'package',
        packagePurchaseId:pendingPackage._id,
        paymentMethod:'BEP20'
      }));
    }
  },[pendingPackage?._id,pendingPackage?.totalAmount]);

  const qrUrl=bep20Address
    ?`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(bep20Address)}`
    :'';

  const submit=async(e:FormEvent)=>{
    e.preventDefault();

    if(!bep20){
      setMsg('BEP20 deposits are currently unavailable.');
      return;
    }

    if(!bep20Address){
      setMsg('Admin has not configured the BEP20 deposit address yet.');
      return;
    }

    if(f.depositType==='package'&&!f.packagePurchaseId){
      setMsg('Package purchase link is missing.');
      return;
    }

    setBusy(true);
    setMsg('');

    try{
      const body=new FormData();

      body.append('amount',f.amount);
      body.append('paymentMethod','BEP20');
      body.append('reference',f.reference);
      body.append('details',f.details);
      body.append('depositType',f.depositType);

      if(f.packagePurchaseId){
        body.append('packagePurchaseId',f.packagePurchaseId);
      }

      if(f.receipt){
        body.append('receipt',f.receipt);
      }

      if(f.depositType==='package'&&f.packageId){
        if(!f.receipt){
          setMsg('NFT payment receipt upload karein.');
          setBusy(false);
          return;
        }

        const packageBody=new FormData();

        packageBody.append(
          'quantity',
          '1'
        );

        packageBody.append(
          'paymentMethod',
          'BEP20'
        );

        packageBody.append(
          'idempotencyKey',
          crypto.randomUUID()
        );

        packageBody.append(
          'amount',
          f.amount
        );

        packageBody.append(
          'reference',
          f.reference
        );

        packageBody.append(
          'details',
          f.details
        );

        packageBody.append(
          'receipt',
          f.receipt
        );

        await api.post(
          `/packages/${encodeURIComponent(f.packageId)}/purchase`,
          packageBody
        );
      }else{
        await api.post('/deposits',body);
      }

      setF({
        amount:'',
        paymentMethod:'BEP20',
        reference:'',
        details:'',
        receipt:null,
        depositType:'wallet',
        packagePurchaseId:'',
        packageId:''
      });

      history.replaceState(null,'','/deposit');

      reload();

      setMsg(
        f.depositType==='package'
          ?'NFT payment proof submitted. Package will activate only after admin verification.'
          :'BEP20 deposit submitted. Balance will be credited only after admin verification.'
      );

      if(f.depositType==='package'){
        location.href='/active-packages';
        return;
      }
    }catch(err:any){
      setMsg(
        err?.response?.data?.message??
        'Deposit submission failed'
      );
    }finally{
      setBusy(false);
    }
  };

  const copyAddress=()=>{
    if(bep20Address){
      navigator.clipboard.writeText(bep20Address);
      setMsg('BEP20 address copied.');
    }
  };

  return <Shell>
    <PageTitle
      title="BEP20 Deposit"
      text="Send BEP20 / BNB Smart Chain funds and submit the transaction proof for administrator verification."
    />

    {!bep20Address&&
      <div className="alert">
        Admin has not configured the BEP20 deposit address yet.
      </div>
    }

    {bep20Address&&
      <section className="panel">
        <div className="section-heading">
          <span className="eyebrow">BEP20 PAYMENT ADDRESS</span>
          <h2>Send funds to this address</h2>
        </div>

        <div className="payment-detail-grid">
          <div>
            <span>Network</span>
            <strong>{bep20Network}</strong>
          </div>

          <div>
            <span>Asset</span>
            <strong>BEP20 / BNB Smart Chain</strong>
          </div>
        </div>

        <div style={{
          display:'grid',
          gridTemplateColumns:'minmax(180px,280px) 1fr',
          gap:24,
          alignItems:'center'
        }}>
          {qrUrl&&
            <div style={{textAlign:'center'}}>
              <img
                src={qrUrl}
                alt="BEP20 deposit QR code"
                style={{
                  width:240,
                  height:240,
                  maxWidth:'100%',
                  background:'#fff',
                  padding:10,
                  borderRadius:14
                }}
              />
              <small className="muted">
                Scan this QR code with your wallet.
              </small>
            </div>
          }

          <div>
            <span className="eyebrow">WALLET ADDRESS</span>

            <div style={{
              wordBreak:'break-all',
              fontFamily:'monospace',
              padding:'14px',
              borderRadius:12,
              background:'rgba(255,255,255,.04)',
              margin:'8px 0 12px'
            }}>
              {bep20Address}
            </div>

            <button type="button" onClick={copyAddress}>
              Copy BEP20 address
            </button>

            <p className="muted">
            </p>
          </div>
        </div>
      </section>
    }

    {pendingPackage&&
      <section className="panel">
        <span className="eyebrow">NFT PAYMENT PENDING</span>
        <h2>{pendingPackage.packageName??'NFT Package'}</h2>

        <div className="grid">
          <Card
            title="Exact payment"
            value={`${Number(pendingPackage.totalAmount??0).toFixed(2)}`}
          />
          <Card
            title="Capital recovery"
            value={`${Number(pendingPackage.capitalRecoveryDays??45)} days`}
          />
          <Card
            title="Profit phase"
            value={`${Number(pendingPackage.profitDurationDays??45)} days`}
          />
          <Card
            title="Total duration"
            value={`${Number(pendingPackage.investmentDays??90)} days`}
          />
        </div>

        <p>
        </p>
      </section>
    }

    <section className="panel payment-instructions">
      <span className="eyebrow">HOW TO DEPOSIT</span>
      <h2>Payment instructions</h2>

      <p>
        {settings?.paymentDetails?.instructions||
          'Send the exact amount to the BEP20 address, then submit your transaction reference and receipt below.'}
      </p>

      <small>
      </small>
    </section>

    <form
      className="panel form deposit-form"
      onSubmit={submit}
    >
      <div className="form-heading">
        <span className="eyebrow">SUBMIT PROOF</span>
        <h2>Transaction details</h2>
      </div>

      <label>
        Deposit type
        <select
          value={f.depositType}
          disabled={!!f.packagePurchaseId}
          onChange={e=>setF({...f,depositType:e.target.value})}
        >
          <option value="wallet">Wallet deposit</option>
          <option value="package">NFT / Package payment</option>
        </select>
      </label>

      <label>
        Amount
        <input
          required
          readOnly={!!pendingPackage}
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={f.amount}
          onChange={e=>setF({...f,amount:e.target.value})}
        />
      </label>

      <label>
        Payment method
        <input value="BEP20" readOnly />
      </label>

      <label>
        Transaction / reference ID
        <input
          required
          placeholder="Enter BEP20 transaction hash / reference"
          value={f.reference}
          onChange={e=>setF({...f,reference:e.target.value})}
        />
      </label>

      <label>
        Transaction details
        <textarea
          placeholder="Optional BEP20 transaction details"
          value={f.details}
          onChange={e=>setF({...f,details:e.target.value})}
        />
      </label>

      <label>
        Payment receipt / proof
        <input
          required
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={e=>setF({
            ...f,
            receipt:e.target.files?.[0]??null
          })}
        />
        <small>
          {f.receipt
            ?`Selected: ${f.receipt.name}`
            :'JPG, PNG, WEBP or PDF'}
        </small>
      </label>

      <button
        className="primary"
        disabled={busy||!bep20||!bep20Address}
      >
        {busy
          ?'Submitting...'
          :'Submit BEP20 proof'}
      </button>

      {msg&&<div className="notice">{msg}</div>}
    </form>

    {loading
      ?<p>Loading deposit history...</p>
      :error
        ?<div className="alert">{error}</div>
        :<section className="panel deposit-history">
          <div className="section-heading">
            <span className="eyebrow">ACTIVITY</span>
            <h2>Deposit history</h2>
          </div>

          <div className="list">
            {(data??[]).length
              ?(data??[]).map((d:any)=>
                <div className="row" key={d._id}>
                  <span>
                    <strong>
                      ${Number(d.amount??0).toFixed(2)}
                    </strong>
                    <br/>
                    <small>
                      {d.depositType==='package'
                        ?'NFT / Package'
                        :'Wallet'} ∑ {d.paymentMethod}
                    </small>
                  </span>

                  <span>
                    {d.reference}
                  </span>

                  <span>
                    {d.status}
                  </span>

                  <span>
                    <small>
                      {d.createdAt
                        ?new Date(d.createdAt).toLocaleString()
                        :'-'}
                    </small>
                  </span>
                </div>
              )
              :<p className="muted">No deposits found.</p>}
          </div>
        </section>}
  </Shell>
}function Withdrawal(){
  const {data}=useApi<any>('/members/summary');
  const {data:rows}=useApi<any[]>('/withdrawals');
  const {data:payment}=useApi<any>('/payment-details');
  const {data:settings,loading:settingsLoading}=useApi<any>('/content/settings');

  const bep20Active=settings?.paymentDetails?.bep20Active!==false;

  const activeWithdrawalMethods=[
    ...(bep20Active?['BEP20']:[]),
    ...(settings?.paymentDetails?.jazzCashActive!==false?['JazzCash']:[]),
    ...(settings?.paymentDetails?.easypaisaActive!==false?['Easypaisa']:[]),
    ...(Array.isArray(settings?.paymentDetails?.customMethods)
      ?settings.paymentDetails.customMethods
        .filter((m:any)=>m.active!==false)
        .map((m:any)=>String(m.name??'').trim())
        .filter(Boolean)
      :[])
  ];

  const [f,setF]=useState({
    amount:'',
    paymentMethod:'BEP20',
    paymentAccount:''
  });

  useEffect(()=>{
    if(
      activeWithdrawalMethods.length&&
      !activeWithdrawalMethods.includes(f.paymentMethod)
    ){
      setF((x:any)=>({
        ...x,
        paymentMethod:activeWithdrawalMethods[0]
      }));
    }
  },[
    settings,
    activeWithdrawalMethods.join('|')
  ]);

  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);

  const feePct=Number(
    settings?.withdrawalFeePercent??10
  );

  const amount=Number(f.amount||0);
  const fee=Math.round(
    amount*feePct
  )/100;

  const net=Math.max(
    0,
    amount-fee
  );

  const minimum=Number(
    settings?.minimumWithdrawal??0
  );

  const maximum=Number(
    settings?.maximumWithdrawal??0
  );

  const disabled=
    settings?.withdrawalsEnabled===false;

  const isBep20=
    f.paymentMethod==='BEP20';

  const submit=async(e:FormEvent)=>{
    e.preventDefault();

    if(isBep20&&f.paymentAccount.trim().length<10){
      setMsg('Enter a valid BEP20 withdrawal address.');
      return;
    }

    setBusy(true);
    setMsg('');

    try{
      await api.post('/withdrawals',{
        amount,
        paymentMethod:f.paymentMethod,
        ...(isBep20
          ?{paymentAccount:f.paymentAccount.trim()}
          :{}),
        idempotencyKey:crypto.randomUUID()
      });

      setF({
        amount:'',
        paymentMethod:f.paymentMethod,
        paymentAccount:''
      });

     
    }catch(err:any){
      setMsg(
        err?.response?.data?.message??
        'Withdrawal submission failed'
      );
    }finally{
      setBusy(false);
    }
  };

  return <Shell>
    <PageTitle
      title="Withdrawal"
      text="BEP20 withdrawals are reviewed and processed by the administrator."
    />

    {disabled&&
      <div className="alert withdrawal-disabled">
        <div>
          <strong>Withdrawals are currently unavailable</strong>
          <span>
            {settings?.withdrawalDisabledMessage||
              'Withdrawals are temporarily unavailable.'}
          </span>
        </div>
      </div>
    }

    <div className="grid withdrawal-summary">
      <Card
        title="Available balance"
        value={`${Number(data?.wallet?.available??0).toFixed(2)}`}
      />
      <Card
        title="Requested"
        value={`${amount.toFixed(2)}`}
      />
      <Card
        title={`Fee (${feePct}%)`}
        value={`${fee.toFixed(2)}`}
      />
      <Card
        title="Net amount"
        value={`${net.toFixed(2)}`}
      />
    </div>

    <form
      className="panel form withdrawal-form"
      onSubmit={submit}
    >
      <div className="form-heading">
        <span className="eyebrow">REQUEST WITHDRAWAL</span>
        <h2>Withdrawal details</h2>
        <p>
        </p>
      </div>

      <label>
        Requested amount
        <input
          required
          type="number"
          min={Math.max(0.01,minimum)}
          max={maximum||undefined}
          step="0.01"
          placeholder="0.00"
          value={f.amount}
          onChange={e=>setF({
            ...f,
            amount:e.target.value
          })}
        />
      </label>

      <label>
        Payment method
        <select
          value={f.paymentMethod}
          onChange={e=>setF({
            ...f,
            paymentMethod:e.target.value,
            paymentAccount:''
          })}
        >
          {activeWithdrawalMethods.map(
            (method:string)=>
              <option key={method}>{method}</option>
          )}
        </select>
      </label>

      {isBep20&&
        <section className="panel">
          <span className="eyebrow">BEP20 DESTINATION</span>
          <h3>Member wallet address</h3>

          <input
            required
            minLength={10}
            maxLength={120}
            placeholder="Enter your BEP20 / BNB Smart Chain address"
            value={f.paymentAccount}
            onChange={e=>setF({
              ...f,
              paymentAccount:e.target.value
            })}
          />

          <small className="muted">
           
          </small>
        </section>
      }

      {!isBep20&&
        <section className="panel withdrawal-payment">
          <div className="section-heading">
            <span className="eyebrow">VERIFIED PAYMENT DETAILS</span>
            <h2>Withdrawal destination</h2>
          </div>

          <div className="payment-detail-grid">
            <div>
              <span>JazzCash</span>
              <strong>{payment?.jazzCash||'Not verified'}</strong>
            </div>

            <div>
              <span>Easypaisa</span>
              <strong>{payment?.easypaisa||'Not verified'}</strong>
            </div>
          </div>

          <Link
            to="/payment-details"
            className="gold-link"
          >
            Manage payment details
          </Link>
        </section>
      }

      <div className="withdrawal-preview">
        <div>
          <span>Requested</span>
          <strong>${amount.toFixed(2)}</strong>
        </div>

        <div>
          <span>10% / configured fee</span>
          <strong>${fee.toFixed(2)}</strong>
        </div>

        <div>
          <span>Admin pays net</span>
          <strong>${net.toFixed(2)}</strong>
        </div>
      </div>

      <button
        className="primary withdrawal-submit"
        disabled={
          busy||
          settingsLoading||
          disabled||
          !activeWithdrawalMethods.length
        }
      >
        {busy
          ?'Submitting...'
          :disabled
            ?'Withdrawals unavailable'
            :'Request withdrawal'}
      </button>

      {msg&&
        <div className="notice">{msg}</div>
      }
    </form>

    <section className="panel withdrawal-history">
      <div className="section-heading">
        <span className="eyebrow">ACTIVITY</span>
        <h2>Withdrawal history</h2>
      </div>

      <div className="list">
        {(rows??[]).length
          ?(rows??[]).map((w:any)=>
            <div className="row" key={w._id}>
              <span>
                <strong>
                  ${Number(w.requestedAmount??0).toFixed(2)}
                </strong>
                <br/>
                <small>
                  Fee ${Number(w.feeAmount??0).toFixed(2)}
                  {' ∑ '}
                  Net ${Number(w.netAmount??0).toFixed(2)}
                </small>
              </span>

              <span>{w.paymentMethod}</span>

              <span>
                {w.paymentMethod==='BEP20'
                  ?String(w.paymentAccount??'')
                  :`****${String(w.paymentAccount??'').slice(-4)}`}
              </span>

              <span>{w.status}</span>

              <span>
                <small>
                  {w.requestedAt
                    ?new Date(w.requestedAt).toLocaleString()
                    :w.createdAt
                      ?new Date(w.createdAt).toLocaleString()
                      :'-'}
                </small>
              </span>
            </div>
          )
          :<p className="muted">No withdrawals found.</p>}
      </div>
    </section>
  </Shell>
}function PackageDetail({
  p,
  onBack,
  onBuy,
  busy
}:{
  p:any;
  onBack:()=>void;
  onBuy:(id:string,amount:number)=>void;
  busy:boolean
}){
  const price=Number(
    p.salePrice??p.price??0
  );

  const recoveryDays=Math.max(
    0,
    Number(p.capitalRecoveryDays??45)
  );

  const profitDays=Math.max(
    0,
    Number(p.profitDurationDays??45)
  );

  const days=Math.max(
    1,
    Number(
      p.investmentDays??
      (recoveryDays+profitDays)
    )
  );

  const profitPct=Number(
    p.profitPercent??0
  );

  const profit=price*profitPct/100;
  const payout=price+profit;

  return <Shell>
    <PageTitle
      title={p.name??'NFT Details'}
      text="Review NFT price, payment and investment schedule."
    />

    <button
      type="button"
      onClick={onBack}
    >
      ? Back to NFTs
    </button>

    <section className="panel details">
      {p.images?.length?
        <img
          src={assetUrl(p.images[0])}
          alt={p.name??'NFT'}
          style={{
            width:'100%',
            maxHeight:320,
            objectFit:'cover',
            borderRadius:16,
            marginBottom:16
          }}
        />
        :null}

      <h2>{p.name}</h2>
      <p>{p.description??'NFT investment package'}</p>

      <div className="grid">
        <Card
          title="Exact price"
          value={`${price.toFixed(2)}`}
        />

        <Card
          title="Capital recovery"
          value={`${recoveryDays} days`}
        />

        <Card
          title="Profit phase"
          value={`${profitDays} days`}
        />

        <Card
          title="Total duration"
          value={`${days} days`}
        />

        <Card
          title="Profit"
          value={`${profitPct.toFixed(2)}%`}
        />

        <Card
          title="Expected profit"
          value={`${profit.toFixed(2)}`}
        />

        <Card
          title="Expected payout"
          value={`${payout.toFixed(2)}`}
        />
      </div>

      <p>
        Available: <strong>{p.remainingQuantity??0}</strong>
      </p>

      <div className="notice">

      </div>

      <button
        className="primary"
        disabled={
          busy||
          Number(p.remainingQuantity??0)<=0
        }
        onClick={()=>onBuy(p._id,price)}
      >
        {busy
          ?'Creating payment...'
          :Number(p.remainingQuantity??0)<=0
            ?'Sold Out'
            :'Buy NFT & Pay by BEP20'}
      </button>
    </section>
  </Shell>
}

function Packages(){
  const {data,loading,error}=useApi<any[]>('/packages');
  const {data:purchases}=useApi<any[]>('/packages/purchases');
  const {data:packages}=useApi<any[]>('/packages');

  const [msg,setMsg]=useState('');
  const [selected,setSelected]=useState<any>(null);
  const [buying,setBuying]=useState(false);

  const buy=async(id:string,amount:number)=>{
    setBuying(true);
    setMsg('');

    try{
      location.href=
        `/deposit?packageId=${encodeURIComponent(id)}&amount=${encodeURIComponent(amount)}`;
    }catch{
      setMsg('Payment page open nahi ho saki');
    }finally{
      setBuying(false);
    }
  };

  const rows=purchases??[];

  const active=rows.filter(
    (p:any)=>
      ['capital_recovery','profit','matured'].includes(
        p.status
      )
  );

  const pending=rows.filter(
    (p:any)=>
      ['pending'].includes(p.status)
  );

  const activeUnits=active.reduce(
    (n,p)=>n+Number(p.quantity??0),
    0
  );

  const activeValue=active.reduce(
    (n,p)=>n+Number(p.totalAmount??0),
    0
  );

  if(selected){
    return <PackageDetail
      p={selected}
      onBack={()=>setSelected(null)}
      onBuy={buy}
      busy={buying}
    />;
  }

  return <Shell>
    <PageTitle
      title="NFT / Packages"
      text="Buy an NFT package by exact BEP20 payment and wait for admin verification."
    />

    {msg&&
      <div className="notice">{msg}</div>
    }

    <div className="grid">
      <Card
        title="Active Packages"
        value={String(active.length)}
      />
      <Card
        title="Pending Payments"
        value={String(pending.length)}
      />
      <Card
        title="Active Units"
        value={String(activeUnits)}
      />
      <Card
        title="Package Value"
        value={`${activeValue.toFixed(2)}`}
      />
    </div>

    {loading
      ?<p>Loading...</p>
      :error
        ?<div className="alert">{error}</div>
        :<div className="package-grid">
          {(data??[]).map(p=>
            <article
              className="package"
              key={p._id}
            >
              {p.images?.[0]
                ?<img
                  src={assetUrl(p.images[0])}
                  alt={p.name}
                />
                :<div className="package-art">NFT</div>}

              <span className="eyebrow">
                {p.remainingQuantity} LEFT
              </span>

              <h2>{p.name}</h2>
              <p>{p.description}</p>

              <div>
                <del className="muted">
                  ${Number(p.price).toFixed(2)}
                </del>{' '}
                <strong>
                  ${Number(p.salePrice??p.price).toFixed(2)}
                </strong>
              </div>

              <div className="muted">
                Capital recovery:{' '}
                {Number(p.capitalRecoveryDays??45)} days
                {' ∑ '}
                Profit phase:{' '}
                {Number(p.profitDurationDays??45)} days
                {' ∑ '}
                Total:{' '}
                {Number(p.investmentDays??90)} days
              </div>

              <div>
                Profit:{' '}
                <strong>
                  {Number(p.profitPercent??0)}%
                </strong>
              </div>

              <div>
                Expected payout:{' '}
                <strong>
                  ${(Number(p.salePrice??p.price)*
                    (1+Number(p.profitPercent??0)/100)
                  ).toFixed(2)}
                </strong>
              </div>

              {p.endDate&&
                <Countdown end={p.endDate}/>
              }

              <div className="actions">
                <button
                  type="button"
                  onClick={()=>setSelected(p)}
                >
                  View NFT
                </button>

                <button
                  className="primary"
                  disabled={
                    buying||
                    Number(p.remainingQuantity??0)<1
                  }
                  onClick={()=>buy(p._id,Number(p.salePrice??p.price??0))}
                >
                  {buying
                    ?'Processing...'
                    :'Buy & Pay BEP20'}
                </button>
              </div>
            </article>
          )}
        </div>
    }

    {pending.length>0&&
      <section className="panel">
        <h2>Pending NFT Payments</h2>

        <p className="muted">
         
        </p>

        <div className="list">
          {pending.map((p:any)=>
            <div
              className="row"
              key={p._id}
            >
              <span>
                <strong>
                  {p.packageName??'NFT Package'}
                </strong>
                <br/>
                <small>
                  {p.createdAt
                    ?new Date(p.createdAt).toLocaleString()
                    :'-'}
                </small>
              </span>

              <span>
                ${Number(p.totalAmount??0).toFixed(2)}
              </span>

              <span>
                Pending
              </span>

              <button
                onClick={()=>
                  location.href=
                    `/deposit?packagePurchaseId=${encodeURIComponent(p._id)}`
                }
              >
                Submit payment proof
              </button>
            </div>
          )}
        </div>
      </section>
    }

    <section className="panel">
      <h2>My Investment Packages</h2>

      {active.length
        ?<div className="list">
          {active.map((p:any)=>
            <div
              className="row"
              key={p._id}
            >
              <span>
                <strong>
                  {p.packageName??'Package'}
                </strong>
                <br/>
                <small>
                  Activated:{' '}
                  {p.activatedAt
                    ?new Date(p.activatedAt).toLocaleString()
                    :'-'}
                </small>
              </span>

              <span>
                Capital recovery:{' '}
                {p.capitalRecoveryAt
                  ?new Date(p.capitalRecoveryAt).toLocaleString()
                  :'-'}
              </span>

              <span>
                Profit starts:{' '}
                {p.profitStartsAt
                  ?new Date(p.profitStartsAt).toLocaleString()
                  :'-'}
              </span>

              <span>
                Matures:{' '}
                {p.maturesAt
                  ?new Date(p.maturesAt).toLocaleString()
                  :'-'}
              </span>

              <span>
                Profit ${Number(p.profitAmount??0).toFixed(2)}
                <br/>
                Payout ${Number(p.payoutAmount??0).toFixed(2)}
              </span>

              <strong>
                {p.status}
              </strong>
            </div>
          )}
        </div>
        :<p className="muted">
          No activated packages yet.
        </p>}
    </section>

    <List
      title="Purchase History"
      rows={rows}
      cols={[
        'packageName',
        'reference',
        'quantity',
        'totalAmount',
        'createdAt',
        'status'
      ]}
    />
  </Shell>
}function ActivePackages(){
  const {data:rows,loading,error,reload}=useApi<any[]>('/packages/purchases');

  const purchases=rows??[];

  const active=purchases.filter((p:any)=>
    ['active','capital_recovery','profit'].includes(String(p.status))
  );

  const pending=purchases.filter((p:any)=>
    String(p.status)==='pending'
  );

  const history=purchases.filter((p:any)=>
    !['active','capital_recovery','profit','pending'].includes(String(p.status))
  );

  return <Shell>
    <PageTitle
      title="My Packages"
      text="Your purchased NFT packages, activation status and investment schedule."
    />

    <div className="grid">
      <Card title="Active Packages" value={String(active.length)} />
      <Card title="Pending Packages" value={String(pending.length)} />
      <Card
        title="Active Units"
        value={String(active.reduce((n,p)=>n+Number(p.quantity??0),0))}
      />
      <Card
        title="Active Value"
        value={`$${active.reduce((n,p)=>n+Number(p.totalAmount??0),0).toFixed(2)}`}
      />
    </div>

    {loading
      ?<p>Loading packages...</p>
      :error
        ?<div className="alert">{error}<button onClick={reload}>Retry</button></div>
        :<>
          <section className="panel">
            <div className="section-heading">
              <span className="eyebrow">ACTIVE PACKAGES</span>
              <h2>My Active Packages</h2>
            </div>

            {active.length
              ?<div className="list">
                {active.map((p:any)=>{
                  const pkg=typeof p.packageId==='object'?p.packageId:null;
                  return <div className="row" key={p._id}>
                    <span>
                      <strong>{pkg?.name??p.packageName??'Package'}</strong>
                      <br/>
                      <small>
                        Activated:{' '}
                        {p.activatedAt
                          ?new Date(p.activatedAt).toLocaleString()
                          :'-'}
                      </small>
                    </span>
                    <span>
                      Amount<br/>
                      <strong>${Number(p.totalAmount??0).toFixed(2)}</strong>
                    </span>
                    <span>
                      Capital recovery<br/>
                      {p.capitalRecoveryAt
                        ?new Date(p.capitalRecoveryAt).toLocaleString()
                        :'-'}
                    </span>
                    <span>
                      Profit starts<br/>
                      {p.profitStartsAt
                        ?new Date(p.profitStartsAt).toLocaleString()
                        :'-'}
                    </span>
                    <span>
                      Matures<br/>
                      {p.maturesAt
                        ?new Date(p.maturesAt).toLocaleString()
                        :'-'}
                    </span>
                    <span>
                      Profit ${Number(p.profitAmount??0).toFixed(2)}
                      <br/>
                      Payout ${Number(p.payoutAmount??0).toFixed(2)}
                    </span>
                    <strong>{p.status}</strong>
                  </div>
                })}
              </div>
              :<p className="muted">No active packages yet. Packages become active after payment verification.</p>}
          </section>

          {pending.length>0&&
            <section className="panel">
              <div className="section-heading">
                <span className="eyebrow">PENDING VERIFICATION</span>
                <h2>Pending Packages</h2>
              </div>
              <div className="list">
                {pending.map((p:any)=>{
                  const pkg=typeof p.packageId==='object'?p.packageId:null;
                  return <div className="row" key={p._id}>
                    <span>
                      <strong>{pkg?.name??p.packageName??'Package'}</strong>
                      <br/>
                      <small>
                        Submitted:{' '}
                        {p.createdAt
                          ?new Date(p.createdAt).toLocaleString()
                          :'-'}
                      </small>
                    </span>
                    <span>${Number(p.totalAmount??0).toFixed(2)}</span>
                    <strong>Pending</strong>
                    <button
                      onClick={()=>
                        location.href=
                          `/deposit?packagePurchaseId=${encodeURIComponent(p._id)}`
                      }
                    >
                      Submit Payment Proof
                    </button>
                  </div>
                })}
              </div>
            </section>
          }

          {history.length>0&&
            <List
              title="Package History"
              rows={history}
              cols={['reference','quantity','totalAmount','createdAt','status']}
            />
          }
        </>}
  </Shell>
}
function PackageMaturity({end,status}:{end:string,status:string}){const [left,setLeft]=useState(Math.max(0,new Date(end).getTime()-Date.now()));useEffect(()=>{const i=setInterval(()=>setLeft(Math.max(0,new Date(end).getTime()-Date.now())),1000);return()=>clearInterval(i)},[end]);if(status==='matured'||left<=0)return <span className='countdown'>Matured</span>;return <span className='countdown'>Matures in {Math.floor(left/86400000)}d {Math.floor(left/3600000)%24}h {Math.floor(left/60000)%60}m</span>}function Countdown({end}:{end:string}){const [left,setLeft]=useState(Math.max(0,new Date(end).getTime()-Date.now()));useEffect(()=>{const i=setInterval(()=>setLeft(Math.max(0,new Date(end).getTime()-Date.now())),1000);return()=>clearInterval(i)},[end]);return <span className="countdown">Sale ends in {Math.floor(left/86400000)}d {Math.floor(left/3600000)%24}h {Math.floor(left/60000)%60}m</span>}
function Team(){const {data,loading,error}=useApi<any>("/members/summary");const team=data?.team??{};return <Shell><PageTitle title="Three-level team" text="Team membership, business and commission are resolved on the server."/>{loading?<p>Loading...</p>:error?<div className="alert">{error}</div>:<><div className="grid"><Card title="Total Team Members" value={String(team.total??0)}/><Card title="Total Team Business" value={`$${Number(team.totalBusiness??0).toFixed(2)}`}/><Card title="Total Commission" value={`$${Number(team.totalCommission??0).toFixed(2)}`}/></div><div className="team-columns">{[1,2,3].map(level=>{const members=team[`level${level}`]??[];return <section className="panel" key={level}><h2>Level {level}</h2><p><strong>{members.length}</strong> members</p><p>Business: <strong>${Number(team.levelBusiness?.[`level${level}`]??0).toFixed(2)}</strong></p><p>Commission: <strong>${Number(team.levelCommission?.[`level${level}`]??0).toFixed(2)}</strong></p>{members.map((u:any)=><div className="row" key={u._id}><span><strong>{u.username}</strong><br/><small>{u.fullName??""}</small></span><span><small>{u.memberId}</small><br/>Business ${Number(u.business??0).toFixed(2)} ∑ Commission ${Number(u.commission??0).toFixed(2)}</span></div>)}</section>})}</div></>}</Shell>}function Commission(){const {data,loading}=useApi<any>('/members/commission');return <Shell><PageTitle title="Commission" text="Three-level commissions are authoritative ledger credits."/>{loading?<p>Loading...</p>:<><div className="grid"><Card title="Total" value={`$${Number(data?.total??0).toFixed(2)}`}/><Card title="Level 1" value={`$${Number(data?.level1??0).toFixed(2)}`}/><Card title="Level 2" value={`$${Number(data?.level2??0).toFixed(2)}`}/><Card title="Level 3" value={`$${Number(data?.level3??0).toFixed(2)}`}/></div><List title="Commission history" rows={data?.history??[]} cols={['sourceReference','level','amount','createdAt']}/></>}</Shell>}
function Account(){const {data}=useApi<any>('/members/summary');return <Shell><PageTitle title="Account" text="Identity, referral and security controls."/><section className="panel details">{data?.user&&Object.entries({Name:data.user.fullName,Username:data.user.username,Mobile:data.user.mobile,'Member ID':data.user.memberId,'Referral code':data.user.referralCode,Upliner:data.user.uplinerName??'-'}).map(([k,v])=><div className="row" key={k}><span>{k}</span><strong>{String(v)}</strong></div>)}</section><section className="panel actions"><Link to="/payment-details">Payment Details</Link><Link to="/security">Security</Link><Link to="/notifications">Notifications</Link></section></Shell>}
function PaymentDetails(){
  const {data,loading}=useApi<any>('/payment-details');
  const [f,setF]=useState<any>({
    currentPassword:'',
    jazzCash:'',
    easypaisa:'',
    customMethods:[]
  });
  const [msg,setMsg]=useState('');

  useEffect(()=>{
    if(data){
      setF((x:any)=>({
        ...x,
        jazzCash:x.jazzCash||'',
        easypaisa:x.easypaisa||'',
        customMethods:Array.isArray(data.customMethods)
          ? data.customMethods.map((m:any)=>({
              name:String(m.name??''),
              number:String(m.number??''),
              title:String(m.title??'')
            }))
          : []
      }));
    }
  },[data]);

  const updateCustom=(i:number,key:string,value:string)=>{
    setF((x:any)=>{
      const a=[...(x.customMethods??[])];
      a[i]={...a[i],[key]:value};
      return {...x,customMethods:a};
    });
  };

  const submit=async(e:FormEvent)=>{
    e.preventDefault();
    try{
      await api.post('/payment-details/change-request',{
        currentPassword:f.currentPassword,
        jazzCash:f.jazzCash,
        easypaisa:f.easypaisa,
        customMethods:(f.customMethods??[])
          .map((m:any)=>({
            name:String(m.name??'').trim(),
            number:String(m.number??'').trim(),
            title:String(m.title??'').trim()
          }))
          .filter((m:any)=>m.name&&m.number)
      });
      setMsg('Payment details change request submitted for admin approval.');
    }catch(err:any){
      setMsg(err?.response?.data?.message??'Request failed');
    }
  };

  return <Shell>
    <PageTitle title="Payment details" text="Changes require current-password verification and administrator approval."/>
    {loading?<p>Loading...</p>:<>
      <section className="panel">
        <p>JazzCash: <strong>{data?.jazzCash||'Not configured'}</strong></p>
        <p>Easypaisa: <strong>{data?.easypaisa||'Not configured'}</strong></p>
        {(data?.customMethods??[]).map((m:any,i:number)=>
          <p key={i}>
            {m.name}: <strong>{m.number||'Not configured'}</strong>
            {m.title&&<small> ó {m.title}</small>}
          </p>
        )}
      </section>

      <form className="panel form" onSubmit={submit}>
        <input
          required
          type="password"
          placeholder="Current password"
          value={f.currentPassword}
          onChange={e=>setF({...f,currentPassword:e.target.value})}
        />

        <h3>JazzCash</h3>
        <input
          placeholder="New JazzCash account"
          value={f.jazzCash}
          onChange={e=>setF({...f,jazzCash:e.target.value})}
        />

        <h3>Easypaisa</h3>
        <input
          placeholder="New Easypaisa account"
          value={f.easypaisa}
          onChange={e=>setF({...f,easypaisa:e.target.value})}
        />

        <h3>Other payment methods</h3>

        {(f.customMethods??[]).map((m:any,i:number)=>
          <div className="settings-box" key={i}>
            <input
              placeholder="Method name (e.g. HBL Bank)"
              value={m.name}
              onChange={e=>updateCustom(i,'name',e.target.value)}
            />
            <input
              placeholder="Account / number"
              value={m.number}
              onChange={e=>updateCustom(i,'number',e.target.value)}
            />
            <input
              placeholder="Account title"
              value={m.title}
              onChange={e=>updateCustom(i,'title',e.target.value)}
            />
            <button
              type="button"
              onClick={()=>setF((x:any)=>({
                ...x,
                customMethods:(x.customMethods??[]).filter((_:any,j:number)=>j!==i)
              }))}
            >
              Remove
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={()=>setF((x:any)=>({
            ...x,
            customMethods:[
              ...(x.customMethods??[]),
              {name:'',number:'',title:''}
            ]
          }))}
        >
          Add payment method
        </button>

        <button className="primary">
          Submit change request
        </button>

        {msg&&<div className="notice">{msg}</div>}
      </form>
    </>}
  </Shell>
}function Support(){const {data,loading,error}=useApi<any>('/members/support');const [body,setBody]=useState('');const [messages,setMessages]=useState<any[]>([]);const [busy,setBusy]=useState(false);useEffect(()=>{if(Array.isArray(data?.messages))setMessages(data.messages)},[data]);useEffect(()=>{const timer=setInterval(async()=>{try{const r=await api.get('/members/support');if(Array.isArray(r.data?.data?.messages))setMessages(r.data.data.messages)}catch{}},4000);return()=>clearInterval(timer)},[]);const send=async()=>{const text=body.trim();if(!text||busy)return;setBusy(true);try{const r=await api.post('/members/support/messages',{body:text});if(r.data?.data?.message)setMessages(x=>[...x,r.data.data.message]);setBody('')}catch(e:any){alert(e?.response?.data?.message??'Unable to send message')}finally{setBusy(false)}};return <Shell><PageTitle title='Live Support' text='Chat directly with our support team for help with your account.'/><section className='panel support-page'><div className='support-chat-header'><div><span className='eyebrow'>LIVE SUPPORT</span><h2>Support chat</h2><p className='muted'>Our support team can help you with deposits, withdrawals, packages and account questions.</p></div><span className='notice'>Online support</span></div>{loading?<div className='support-empty'><p>Loading support chat...</p></div>:error?<div className='alert'>{error}</div>:<><div className='support-messages'>{messages.length?messages.map((m:any)=><div key={m._id} className={'support-message '+(m.senderRole==='member'?'member':'admin')}><div>{m.body}</div><small>{m.senderRole==='member'?'You':'Support'} ï {m.createdAt?new Date(m.createdAt).toLocaleString():''}</small></div>):<div className='support-empty'><h3>No messages yet</h3><p className='muted'>Send a message and our support team will reply here.</p></div>}</div><div className='support-compose'><textarea value={body} maxLength={2000} placeholder='Type your message...' onChange={e=>setBody(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} disabled={busy}/><button className='primary' disabled={busy||!body.trim()} onClick={send}>{busy?'Sending...':'Send Message'}</button></div></>}</section></Shell>}function Security(){const [f,setF]=useState({currentPassword:'',newPassword:''}),[msg,setMsg]=useState('');return <Shell><PageTitle title="Security" text="Change your password and keep your account protected."/><form className="panel form" onSubmit={async e=>{e.preventDefault();try{await api.post('/security/change-password',f);setMsg('Password changed successfully.')}catch(err:any){setMsg(err?.response?.data?.message??'Request failed')}}}><input required type="password" placeholder="Current password" value={f.currentPassword} onChange={e=>setF({...f,currentPassword:e.target.value})}/><input required minLength={10} type="password" placeholder="New password" value={f.newPassword} onChange={e=>setF({...f,newPassword:e.target.value})}/><button className="primary">Change password</button>{msg&&<div className="notice">{msg}</div>}</form></Shell>}
function Transactions(){const {data,loading}=useApi<any[]>('/transactions');return <Shell><PageTitle title="Transactions" text="Complete authoritative ledger history."/>{loading?<p>Loading...</p>:<List title="Ledger" rows={data??[]} cols={['transactionId','type','amount','status']}/>}</Shell>}
function Notifications(){const {data,loading,error}=useApi<any[]>('/content/notifications/history');return <Shell><PageTitle title="Notifications" text="Announcements, read state and dismissal history are stored server-side."/>{loading?<p>Loading...</p>:error?<div className="alert">{error}</div>:<section className="panel notification-history">{(data??[]).length?(data??[]).map(n=><div className="row" key={`${n._id}-${n.readAt??''}`}><span><strong>{n.title}</strong><br/><small>{n.message}</small></span><span>{n.dismissedAt?'Dismissed':n.readAt?'Read':'Unread'}</span></div>):<p className="muted">No notification history yet.</p>}</section>}</Shell>}
function Capital(){const {data}=useApi<any>('/members/summary');return <Shell><PageTitle title="Capital" text="Unlock eligibility is calculated by backend timestamps."/><div className="grid"><Card title="Locked" value={`$${Number(data?.wallet?.capitalLocked??0).toFixed(2)}`}/><Card title="Available" value={`$${Number(data?.wallet?.capitalAvailable??0).toFixed(2)}`}/></div></Shell>}
function Profit(){const {data}=useApi<any>('/members/summary');return <Shell><PageTitle title="Profit" text="Profit remains separate from capital and commission."/><Card title="Available profit" value={`$${Number(data?.wallet?.profit??0).toFixed(2)}`}/></Shell>}
function Rewards(){const {data}=useApi<any[]>('/rewards');return <Shell><PageTitle title="Rewards / Salary" text="Reward credits are separate ledger transactions."/><List title="Rewards" rows={data??[]} cols={['type','amount','status','createdAt']}/></Shell>}
function Admin(){const {data:stats}=useApi<any>('/admin/stats');return <Shell><PageTitle title="Admin control center" text="Privileged actions are server-authorized and audited."/><div className="grid">{[['Members',stats?.members],['Active',stats?.active],['Pending deposits',stats?.pendingDeposits],['Pending withdrawals',stats?.pendingWithdrawals],['Deposits',stats?.totalDeposits],['Withdrawals',stats?.totalWithdrawals],['Package sales',stats?.packageSales],['Commissions',stats?.totalCommissions],['Capital',stats?.totalCapital],['Profit',stats?.totalProfit],['Rewards',stats?.totalRewards]].map(([k,v])=><Card key={String(k)} title={String(k)} value={['Deposits','Withdrawals','Package sales','Commissions','Capital','Profit','Rewards'].includes(String(k))?`$${Number(v??0).toFixed(2)}`:String(v??0)}/>)}</div><section className="panel actions"><Link to="/admin/members">Members</Link><Link to="/admin/support">Live Support</Link><Link to="/admin/deposits">Deposits</Link><Link to="/admin/withdrawals">Withdrawals</Link><Link to="/admin/packages">Packages</Link><Link to="/admin/finance">Rewards / Profit / Capital</Link><Link to="/admin/settings">Settings</Link><Link to="/admin/notifications">Notifications</Link><Link to="/admin/banners">Banners</Link><Link to="/admin/ledger">Ledger</Link><Link to="/admin/audit">Audit Logs</Link><Link to="/admin/admins">Admin Users</Link><Link to="/admin/payment-requests">Payment Requests</Link></section></Shell>}
function AdminSupport(){
  const [selected,setSelected]=useState<any>(null);
  const [body,setBody]=useState('');
  const [busy,setBusy]=useState(false);
  const {data:inbox,loading:inboxLoading,error:inboxError}=useApi<any>('/admin/support/conversations');
  const {data:chat,loading:chatLoading}=useApi<any>(selected?`/admin/support/conversations/${selected._id}`:'');
  const conversations=inbox?.conversations??[];

  const send=async()=>{
    if(!selected||!body.trim()||busy)return;
    setBusy(true);
    try{
      await api.post(`/admin/support/conversations/${selected._id}/messages`,{body:body.trim()});
      setBody('');
      location.reload();
    }catch(e:any){
      alert(e?.response?.data?.message??'Unable to send message');
    }finally{
      setBusy(false);
    }
  };

  const close=async()=>{
    if(!selected||busy)return;
    if(!window.confirm('Close this support conversation?'))return;
    setBusy(true);
    try{
      await api.post(`/admin/support/conversations/${selected._id}/close`);
      location.reload();
    }catch(e:any){
      alert(e?.response?.data?.message??'Unable to close conversation');
    }finally{
      setBusy(false);
    }
  };

  return <Shell>
    <PageTitle title="Live Support" text="Chat directly with members and manage support conversations."/>
    <div className="support-layout">
      <section className="panel support-inbox">
        <div className="section-heading">
          <span className="eyebrow">SUPPORT INBOX</span>
          <h2>Members</h2>
        </div>

        {inboxLoading?<p>Loading...</p>:
         inboxError?<div className="alert">{inboxError}</div>:
         conversations.length?
         conversations.map((c:any)=>
          <button
            key={c._id}
            className={`support-conversation ${selected?._id===c._id?'selected':''}`}
            onClick={()=>setSelected(c)}
          >
            <strong>{c.userId?.fullName??c.userId?.username??'Member'}</strong>
            <small>{c.userId?.memberId??c.userId?.username??''}</small>
            <span>{c.unreadForAdmin?'New message':'Open conversation'}</span>
          </button>
         ):
         <p className="muted">No support conversations yet.</p>}
      </section>

      <section className="panel support-chat">
        {!selected?
          <div className="support-empty">
            <span className="eyebrow">LIVE SUPPORT</span>
            <h2>Select a member</h2>
            <p className="muted">Choose a conversation from the support inbox to start chatting.</p>
          </div>
        :
          <>
            <div className="support-chat-header">
              <div>
                <h2>{chat?.conversation?.userId?.fullName??selected.userId?.fullName??'Member'}</h2>
                <p className="muted">
                  {chat?.conversation?.userId?.email??selected.userId?.email??''}
                  {chat?.conversation?.userId?.mobile?` ï ${chat.conversation.userId.mobile}`:''}
                </p>
              </div>
              <button disabled={busy||chat?.conversation?.status==='closed'} onClick={close}>
                {chat?.conversation?.status==='closed'?'Closed':'Close Chat'}
              </button>
            </div>

            <div className="support-messages">
              {chatLoading?<p>Loading messages...</p>:
               (chat?.messages??[]).length?
               chat.messages.map((m:any)=>
                <div key={m._id} className={`support-message ${m.senderRole==='member'?'member':'admin'}`}>
                  <div>{m.body}</div>
                  <small>
                    {m.senderRole==='member'?'Member':'Admin'} ï {m.createdAt?new Date(m.createdAt).toLocaleString():''}
                  </small>
                </div>
               ):
               <p className="muted">No messages yet.</p>}
            </div>

            <div className="support-compose">
              <textarea
                value={body}
                placeholder="Type your reply..."
                onChange={e=>setBody(e.target.value)}
                disabled={busy||chat?.conversation?.status==='closed'}
              />
              <button
                className="primary"
                disabled={busy||!body.trim()||chat?.conversation?.status==='closed'}
                onClick={send}
              >
                {busy?'Sending...':'Send Reply'}
              </button>
            </div>
          </>
        }
      </section>
    </div>
  </Shell>
}
function AdminMemberDetail(){
  const {id=''}=useParams();
  const n=useNavigate();
  const {data,loading,error}=useApi<any>(`/admin/members/${id}`);
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState('');

  const impersonate=async()=>{
    if(!id||busy)return;
    if(!window.confirm(`Login as ${data?.user?.username??'this member'}?`))return;
    setBusy(true);
    setMsg('');
    try{
      const r=await api.post(`/admin/members/${id}/impersonate`);
      setAccessToken(r.data.data.accessToken);
      localStorage.setItem('member',JSON.stringify(r.data.data.user));
      localStorage.setItem('impersonationSession',JSON.stringify({
        returnToken:r.data.data.returnToken,
        expiresAt:r.data.data.expiresAt,
        adminReturnedFrom:true
      }));
      n('/');
    }catch(e:any){
      setMsg(e?.response?.data?.message??'Unable to login as this member');
    }finally{
      setBusy(false);
    }
  };

  return <Shell>
    <PageTitle title="Member detail" text="Inspect the member or securely login as them for support."/>
    {msg&&<div className="alert">{msg}</div>}
    {loading?<p>Loading...</p>:error?<div className="alert">{error}</div>:data?
      <>
        <section className="panel details">
          <div className="section-heading">
            <span className="eyebrow">ADMIN ACTION</span>
            <h2>Member session</h2>
          </div>
          <p className="muted">Login as this member starts a temporary 15-minute impersonation session. You can return to your administrator account at any time.</p>
          <button className="primary" disabled={busy||!data.user?.isActive||!!data.user?.dismissedAt} onClick={impersonate}>
            {busy?'Starting secure session...':'Login as User'}
          </button>
          {(!data.user?.isActive||data.user?.dismissedAt)&&<small className="muted">This member is currently unavailable for impersonation.</small>}
        </section>

        <section className="panel details">
          <h2>Identity</h2>
          {Object.entries({
            Name:data.user?.fullName,
            Username:data.user?.username,
            MemberID:data.user?.memberId,
            Mobile:data.user?.mobile,
            Email:data.user?.email??'-',
            Address:data.user?.address??'-',
            Status:data.user?.isActive?'Active':'Inactive',
            Joined:data.user?.createdAt,
            ReferralCode:data.user?.referralCode,
            Upliner:data.upliner?.username??'-',
            ReferralLink:data.referralLink??'-',
            JazzCash:data.payment?.jazzCash??'-',
            Easypaisa:data.payment?.easypaisa??'-'
          }).map(([k,v])=><div className="row" key={k}><span>{k}</span><strong>{String(v??'-')}</strong></div>)}
        </section>

        <div className="grid">
          {[['Total deposits',data.summary?.deposits],['Total withdrawals',data.summary?.withdrawals],['Available capital',data.summary?.capitalAvailable],['Locked capital',data.summary?.capitalLocked],['Available profit',data.summary?.profit],['Total profit',data.summary?.totalProfit],['Total commission',data.summary?.commission],['Total rewards',data.summary?.rewards]].map(([k,v])=><Card key={String(k)} title={String(k)} value={`${Number(v??0).toFixed(2)}`}/>)}
        </div>

        <section className="panel">
          <h2>Team</h2>
          {[1,2,3].map(level=><div className="row" key={level}><span>Level {level}</span><strong>{data.team?.levels?.[level-1]?.count??0} members - ${Number(data.team?.levels?.[level-1]?.business??0).toFixed(2)} business - ${Number(data.team?.levels?.[level-1]?.commission??0).toFixed(2)} commission</strong></div>)}
        </section>

        <List title="Purchased packages" rows={data.purchases??[]} cols={['packageName','quantity','totalAmount','createdAt','status']}/>
        <List title="Transactions" rows={data.transactions??[]} cols={['transactionId','type','amount','status','createdAt']}/>
      </>
    :null}
  </Shell>
}
function AdminMembers(){
  const [q,setQ]=useState(''),[page,setPage]=useState(1),[busy,setBusy]=useState(''),[msg,setMsg]=useState('');
  const url=`/admin/members?q=${encodeURIComponent(q)}&page=${page}&limit=20`;
  const {data,loading,error}=useApi<any>(url);
  const rows=data?.items??[];

  const act=async(id:string,action:'block'|'unblock'|'dismiss'|'restore')=>{
    if(busy)return;
    setBusy(`${id}:${action}`);
    setMsg('');
    try{
      await api.patch(`/admin/members/${id}/${action}`);
      setMsg(`Member ${action}ed successfully.`);
      location.reload();
    }catch(e:any){
      setMsg(e?.response?.data?.message??'Action failed');
    }finally{
      setBusy('');
    }
  };

  return <Shell>
    <PageTitle title="Members" text="Search by username, mobile, member ID, full name or referral code."/>
    <section className="panel form">
      <input value={q} placeholder="Search members..." onChange={e=>{setQ(e.target.value);setPage(1)}}/>
      <div className="actions">
        <button onClick={()=>setPage(1)}>Search</button>
        <button onClick={()=>{setQ('');setPage(1)}}>Clear</button>
      </div>
    </section>
    {msg&&<div className="notice">{msg}</div>}
    {loading?<p>Loading...</p>:error?<div className="alert">{error}</div>:<section className="panel list">
      <h2>Member results</h2>
      {rows.length?rows.map((m:any)=><div className="row" key={m._id}>
        <span>
          {m.fullName}<br/>
          <small>{m.username} - {m.memberId}</small>
        </span>
        <span>{m.mobile}</span>
        <span>{m.isActive?'Active':'Blocked'}{m.dismissedAt?' - Dismissed':''}</span>
        <span>{m.referralCode??'-'}</span>
        <span className="actions">
          <Link to={`/admin/members/${m._id}`}>View details</Link>
          {m.isActive
            ?<button disabled={busy===`${m._id}:block`} onClick={()=>act(m._id,'block')}>{busy===`${m._id}:block`?'Processing...':'Block'}</button>
            :<button disabled={busy===`${m._id}:unblock`} onClick={()=>act(m._id,'unblock')}>{busy===`${m._id}:unblock`?'Processing...':'Unblock'}</button>}
          {m.dismissedAt
            ?<button disabled={busy===`${m._id}:restore`} onClick={()=>act(m._id,'restore')}>{busy===`${m._id}:restore`?'Processing...':'Restore'}</button>
            :<button disabled={busy===`${m._id}:dismiss`} onClick={()=>act(m._id,'dismiss')}>{busy===`${m._id}:dismiss`?'Processing...':'Dismiss'}</button>}
        </span>
      </div>):<p className="muted">No members found.</p>}
      <div className="actions">
        <button disabled={page<=1} onClick={()=>setPage(page-1)}>Previous</button>
        <span>Page {page} of {data?.pages??1}</span>
        <button disabled={page>=(data?.pages??1)} onClick={()=>setPage(page+1)}>Next</button>
      </div>
    </section>}
  </Shell>
}function AdminDeposits(){
  const [q,setQ]=useState('');
  const [status,setStatus]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [page,setPage]=useState(1);
  const [busy,setBusy]=useState('');
  const [msg,setMsg]=useState('');

  const {data,loading,error}=useApi<any>(
    `/admin/deposits?q=${encodeURIComponent(q)}&status=${status}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&limit=20`
  );

  const rows=data?.items??[];

  const act=async(id:string,approve:boolean)=>{
    setBusy(id);
    setMsg('');

    try{
      const note=approve
        ?'Approved by admin'
        :(window.prompt('Rejection reason')||
          'Rejected by admin');

      await api.post(
        `/admin/deposits/${id}/${approve?'approve':'reject'}`,
        {note}
      );

      setMsg(
        approve
          ?'Deposit approved.'
          :'Deposit rejected.'
      );

      location.reload();
    }catch(e:any){
      setMsg(
        e?.response?.data?.message||
        'Action failed'
      );
    }finally{
      setBusy('');
    }
  };

  return <Shell>
    <PageTitle
      title="Deposit management"
      text="Review BEP20 proofs, NFT package payments and wallet deposits."
    />

    <section className="panel form">
      <input
        placeholder="Reference / member search"
        value={q}
        onChange={e=>{
          setQ(e.target.value);
          setPage(1);
        }}
      />

      <select
        value={status}
        onChange={e=>{
          setStatus(e.target.value);
          setPage(1);
        }}
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
      </select>

      <input
        type="date"
        value={from}
        onChange={e=>{
          setFrom(e.target.value);
          setPage(1);
        }}
      />

      <input
        type="date"
        value={to}
        onChange={e=>{
          setTo(e.target.value);
          setPage(1);
        }}
      />

      <button onClick={()=>setPage(1)}>
        Refresh
      </button>
    </section>

    {msg&&
      <div className="notice">{msg}</div>
    }

    {loading
      ?<p>Loading...</p>
      :error
        ?<div className="alert">{error}</div>
        :<section className="panel list">
          <h2>Deposits</h2>

          {rows.length
            ?rows.map((d:any)=>
              <div
                className="row"
                key={d._id}
              >
                <span>
                  <strong>
                    {d.userId?.memberId??'-'}
                    {' - '}
                    {d.userId?.username??'Member'}
                  </strong>
                  <br/>
                  <small>
                    Email: {d.userId?.email??'-'}
                    <br/>
                    Address: {d.userId?.address??'-'}
                  </small>
                </span>

                <span>
                  <strong>
                    ${Number(d.amount??0).toFixed(2)}
                  </strong>
                  <br/>
                  <small>
                    {d.paymentMethod}
                    {' ∑ '}
                    {d.depositType==='package'
                      ?'NFT / Package'
                      :'Wallet'}
                  </small>
                </span>

                <span>
                  {d.reference}
                  <br/>
                  <small>
                    Submitted:{' '}
                    {d.createdAt
                      ?new Date(d.createdAt).toLocaleString()
                      :'-'}
                  </small>
                </span>

                <span>
                  {d.status}
                  {d.reviewedAt&&
                    <small>
                      <br/>
                      Reviewed:{' '}
                      {new Date(d.reviewedAt).toLocaleString()}
                    </small>}
                </span>

                <span>
                  {d.packagePurchaseId&&
                    <small>
                      NFT Purchase:<br/>
                      {String(d.packagePurchaseId)}
                    </small>
                  }

                  {d.hasReceipt&&
                    <button
                      onClick={async()=>{
                        try{
                          const r=await api.get(
                            `/admin/deposits/${d._id}/receipt`,
                            {responseType:'blob'}
                          );

                          const u=
                            URL.createObjectURL(r.data);

                          window.open(
                            u,
                            '_blank',
                            'noopener,noreferrer'
                          );

                          setTimeout(
                            ()=>URL.revokeObjectURL(u),
                            60000
                          );
                        }catch(e:any){
                          setMsg(
                            e?.response?.data?.message||
                            'Unable to open receipt'
                          );
                        }
                      }}
                    >
                      Receipt
                    </button>
                  }

                  {d.status==='pending'&&
                    <>
                      <button
                        disabled={busy===d._id}
                        onClick={()=>act(d._id,true)}
                      >
                        {busy===d._id
                          ?'Processing...'
                          :'Approve'}
                      </button>

                      <button
                        disabled={busy===d._id}
                        onClick={()=>act(d._id,false)}
                      >
                        Reject
                      </button>
                    </>
                  }
                </span>
              </div>
            )
            :<p className="muted">
              No deposits found.
            </p>}

          <div className="actions">
            <button
              disabled={page<=1}
              onClick={()=>setPage(page-1)}
            >
              Previous
            </button>

            <span>
              Page {page} of {data?.pages??1}
            </span>

            <button
              disabled={page>=(data?.pages??1)}
              onClick={()=>setPage(page+1)}
            >
              Next
            </button>
          </div>
        </section>}
  </Shell>
}function AdminWithdrawals(){
  const [q,setQ]=useState('');
  const [status,setStatus]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [page,setPage]=useState(1);
  const [busy,setBusy]=useState('');
  const [msg,setMsg]=useState('');

  const {data,loading,error}=useApi<any>(
    `/admin/withdrawals?q=${encodeURIComponent(q)}&status=${status}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&limit=20`
  );

  const rows=data?.items??[];

  const act=async(id:string,approve:boolean)=>{
    setBusy(id);
    setMsg('');

    try{
      const note=approve
        ?'Approved by admin'
        :(window.prompt('Rejection reason')||
          'Rejected by admin');

      await api.post(
        `/admin/withdrawals/${id}/${approve?'approve':'reject'}`,
        {note}
      );

      setMsg(
        approve
          ?'Withdrawal approved. Admin can now pay the net amount.'
          :'Withdrawal rejected and reservation released.'
      );

      location.reload();
    }catch(e:any){
      setMsg(
        e?.response?.data?.message||
        'Action failed'
      );
    }finally{
      setBusy('');
    }
  };

  return <Shell>
    <PageTitle
      title="Withdrawal management"
      text="Review pending requests. Requested amount is reserved; admin approval finalizes the deduction."
    />

    <section className="panel form">
      <input
        placeholder="Reference / member search"
        value={q}
        onChange={e=>{
          setQ(e.target.value);
          setPage(1);
        }}
      />

      <select
        value={status}
        onChange={e=>{
          setStatus(e.target.value);
          setPage(1);
        }}
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="paid">Paid</option>
      </select>

      <input
        type="date"
        value={from}
        onChange={e=>{
          setFrom(e.target.value);
          setPage(1);
        }}
      />

      <input
        type="date"
        value={to}
        onChange={e=>{
          setTo(e.target.value);
          setPage(1);
        }}
      />

      <button onClick={()=>setPage(1)}>
        Refresh
      </button>
    </section>

    {msg&&
      <div className="notice">{msg}</div>
    }

    {loading
      ?<p>Loading...</p>
      :error
        ?<div className="alert">{error}</div>
        :<section className="panel list">
          <h2>Withdrawals</h2>

          {rows.length
            ?rows.map((w:any)=>
              <div
                className="row"
                key={w._id}
              >
                <span>
                  <strong>
                    {w.userId?.memberId??'-'}
                    {' - '}
                    {w.userId?.username??'Member'}
                  </strong>
                  <br/>
                  <small>
                    Requested:{' '}
                    {w.requestedAt
                      ?new Date(w.requestedAt).toLocaleString()
                      :'-'}
                  </small>
                </span>

                <span>
                  Requested
                  <strong>
                    ${Number(w.requestedAmount??0).toFixed(2)}
                  </strong>
                  <br/>
                  Fee
                  <strong>
                    ${Number(w.feeAmount??0).toFixed(2)}
                  </strong>
                  <br/>
                  Net to member
                  <strong>
                    ${Number(w.netAmount??0).toFixed(2)}
                  </strong>
                </span>

                <span>
                  <strong>{w.paymentMethod}</strong>
                  <br/>
                  {w.paymentMethod==='BEP20'
                    ?<small style={{wordBreak:'break-all'}}>
                      {w.paymentAccount}
                    </small>
                    :<small>
                      ****{String(w.paymentAccount??'').slice(-4)}
                    </small>}
                </span>

                <span>
                  <strong>{w.status}</strong>
                  {w.processedAt&&
                    <small>
                      <br/>
                      Processed:{' '}
                      {new Date(w.processedAt).toLocaleString()}
                    </small>}
                </span>

                <span>
                  <Link
                    to={`/admin/members/${w.userId?._id}`}
                  >
                    View member
                  </Link>

                  {w.status==='pending'&&
                    <>
                      <button
                        disabled={busy===w._id}
                        onClick={()=>act(w._id,true)}
                      >
                        {busy===w._id
                          ?'Processing...'
                          :'Approve'}
                      </button>

                      <button
                        disabled={busy===w._id}
                        onClick={()=>act(w._id,false)}
                      >
                        Reject
                      </button>
                    </>
                  }
                </span>
              </div>
            )
            :<p className="muted">
              No withdrawals found.
            </p>}

          <div className="actions">
            <button
              disabled={page<=1}
              onClick={()=>setPage(page-1)}
            >
              Previous
            </button>

            <span>
              Page {page} of {data?.pages??1}
            </span>

            <button
              disabled={page>=(data?.pages??1)}
              onClick={()=>setPage(page+1)}
            >
              Next
            </button>
          </div>
        </section>}
  </Shell>
}function AdminTable({type}:{type:'ledger'|'audit'|'admins'|'payment'}){const map={ledger:'/admin/transactions',audit:'/admin/audit-logs',admins:'/admin/admins',payment:'/admin/payment-change-requests'} as const;const {data,loading,error}=useApi<any>(map[type]);const rows=Array.isArray(data)?data:(data?.items??[]);const me=JSON.parse(localStorage.getItem('member')||'null');const [msg,setMsg]=useState('');return <Shell><PageTitle title={type==='ledger'?'Ledger':type==='audit'?'Audit Logs':type==='admins'?'Admin Users':'Payment Change Requests'} text="Administrative records from the backend."/>{msg&&<div className="notice">{msg}</div>}{type==='admins'&&me?.role==='super_admin'&&<section className="panel form"><input id="newAdminName" placeholder="Full name"/><input id="newAdminUser" placeholder="Username"/><input id="newAdminMobile" placeholder="Mobile"/><input id="newAdminPassword" type="password" placeholder="Temporary password"/><select id="newAdminRole"><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select><button className="primary" onClick={async()=>{const g=(id:string)=>(document.getElementById(id) as HTMLInputElement).value;try{await api.post('/admin/admins',{fullName:g('newAdminName'),username:g('newAdminUser'),mobile:g('newAdminMobile'),password:g('newAdminPassword'),role:(document.getElementById('newAdminRole') as HTMLSelectElement).value});location.reload()}catch(e:any){setMsg(e?.response?.data?.message??'Create failed')}}}>Create administrator</button></section>}{loading?<p>Loading...</p>:error?<div className="alert">{error}</div>:type==='payment'?<section className="panel">{(data??[]).map((r:any)=><div className="row" key={r._id}><span>{r.userId?.username??'Member'} - {r.status}</span><span>{r.status==='pending'&&<><button onClick={async()=>{try{await api.post(`/admin/payment-change-requests/${r._id}/review`,{approve:true,reason:'Approved'});location.reload()}catch(e:any){setMsg(e?.response?.data?.message??'Review failed')}}}>Approve</button><button onClick={async()=>{try{await api.post(`/admin/payment-change-requests/${r._id}/review`,{approve:false,reason:'Rejected'});location.reload()}catch(e:any){setMsg(e?.response?.data?.message??'Review failed')}}}>Reject</button></>}</span></div>)}</section>:<List title="Records" rows={rows} cols={type==='ledger'?['transactionId','type','amount','status','createdAt']:['action','targetType','targetId','createdAt']}/>}</Shell>}
function AdminFinance(){const [f,setF]=useState({userId:'',amount:'',reason:'',sourceReference:'',type:'reward'}),[memberSearch,setMemberSearch]=useState(''),[msg,setMsg]=useState(''),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false);const {data:memberData}=useApi<any>(`/admin/members?q=${encodeURIComponent(memberSearch)}&page=1&limit=8`);const matches=memberSearch?memberData?.items??[]:[];const submit=async()=>{setBusy(true);try{const url=f.type==='reward'?'/rewards':f.type==='profit'?'/rewards/profit':'/rewards/capital';const body={userId:f.userId,amount:Number(f.amount),sourceReference:f.sourceReference,reason:f.reason,type:'manual'};await api.post(url,body);setMsg('Financial adjustment recorded in the ledger and audit log.');setConfirm(false);setF({...f,amount:'',reason:'',sourceReference:''})}catch(err:any){setMsg(err?.response?.data?.message??'Adjustment failed')}finally{setBusy(false)}};return <Shell><PageTitle title="Rewards / Profit / Capital" text="Authorized financial adjustments use the existing backend ledger and audit architecture."/><form className="panel form" onSubmit={e=>{e.preventDefault();if(!f.userId){setMsg('Select a valid member before continuing.');return}setConfirm(true)}}><input value={memberSearch} placeholder="Find member by username, mobile, member ID or name" onChange={e=>{setMemberSearch(e.target.value);setF({...f,userId:''})}}/>{matches.length>0&&<section className="panel list">{matches.map((m:any)=><button type="button" className="row" key={m._id} onClick={()=>{setF({...f,userId:m._id});setMemberSearch(`${m.fullName} - ${m.memberId}`)}}><span>{m.fullName}</span><span>{m.username}</span><span>{m.memberId}</span></button>)}</section>}<input type="hidden" value={f.userId}/><p>Selected member: <strong>{f.userId||'None'}</strong></p><select value={f.type} onChange={e=>setF({...f,type:e.target.value})}><option value="reward">Reward / Salary</option><option value="profit">Profit</option><option value="capital">Capital</option></select><input required type="number" min="0.01" step="0.01" placeholder="Amount" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})}/><input required placeholder="Unique source reference" value={f.sourceReference} onChange={e=>setF({...f,sourceReference:e.target.value})}/><input required placeholder="Reason" value={f.reason} onChange={e=>setF({...f,reason:e.target.value})}/><button className="primary" disabled={busy}>Review adjustment</button></form>{confirm&&<div className="modal-backdrop"><div className="modal"><h2>Confirm financial adjustment</h2><p>Member: <strong>{memberSearch}</strong></p><p>Type: <strong>{f.type}</strong></p><p>Amount: <strong>${Number(f.amount||0).toFixed(2)}</strong></p><p>Reason: <strong>{f.reason}</strong></p><div className="actions"><button disabled={busy} onClick={()=>setConfirm(false)}>Cancel</button><button className="primary" disabled={busy} onClick={submit}>{busy?'Processing...':'Confirm'}</button></div></div></div>}{msg&&<div className="notice">{msg}</div>}</Shell>}
function AdminSettings(){
  const {data,loading,error}=useApi<any>('/admin/settings');
  const [form,setForm]=useState<any>(null);
  const [msg,setMsg]=useState('');
  const [busy,setBusy]=useState(false);

  useEffect(()=>{
    if(data){
      setForm({
        ...data,
        capitalRecoveryDays:data.capitalRecoveryDays??45,
        profitDurationDays:data.profitDurationDays??45,
        totalInvestmentDays:data.totalInvestmentDays??90,
        paymentDetails:{
          ...(data.paymentDetails??{}),
          bep20Address:data.paymentDetails?.bep20Address??'',
          bep20Network:data.paymentDetails?.bep20Network??'BEP20 / BNB Smart Chain',
          bep20Active:data.paymentDetails?.bep20Active!==false
        }
      });
    }
  },[data]);

  if(loading||!form){
    return <Shell>
      <PageTitle
        title="Platform settings"
        text="Financial, BEP20 and investment settings."
      />
      {error
        ?<div className="alert">{error}</div>
        :<p>Loading settings...</p>}
    </Shell>;
  }

  const save=async(e:FormEvent)=>{
    e.preventDefault();
    setBusy(true);
    setMsg('');

    try{
      const r=await api.patch(
        '/admin/settings',
        {
          platformName:String(
            form.platformName??''
          ),

          withdrawalsEnabled:
            !!form.withdrawalsEnabled,

          withdrawalDisabledMessage:
            String(
              form.withdrawalDisabledMessage??''
            ),

          withdrawalFeePercent:
            Number(form.withdrawalFeePercent),

          minimumWithdrawal:
            Number(form.minimumWithdrawal),

          maximumWithdrawal:
            Number(form.maximumWithdrawal),

          withdrawalCooldownHours:
            Number(form.withdrawalCooldownHours),

          capitalLockDays:
            Number(form.capitalLockDays),

          capitalRecoveryDays:
            Number(form.capitalRecoveryDays),

          profitDurationDays:
            Number(form.profitDurationDays),

          totalInvestmentDays:
            Number(form.totalInvestmentDays),

          referralRates:{
            level1:Number(
              form.referralRates?.level1
            ),
            level2:Number(
              form.referralRates?.level2
            ),
            level3:Number(
              form.referralRates?.level3
            )
          },

          paymentDetails:{
            jazzCashNumber:String(
              form.paymentDetails?.jazzCashNumber??''
            ),
            jazzCashTitle:String(
              form.paymentDetails?.jazzCashTitle??''
            ),
            jazzCashActive:
              !!form.paymentDetails?.jazzCashActive,

            easypaisaNumber:String(
              form.paymentDetails?.easypaisaNumber??''
            ),
            easypaisaTitle:String(
              form.paymentDetails?.easypaisaTitle??''
            ),
            easypaisaActive:
              !!form.paymentDetails?.easypaisaActive,

            bep20Address:String(
              form.paymentDetails?.bep20Address??''
            ),
            bep20Network:String(
              form.paymentDetails?.bep20Network??
              'BEP20 / BNB Smart Chain'
            ),
            bep20Active:
              form.paymentDetails?.bep20Active!==false,

            customMethods:
              Array.isArray(
                form.paymentDetails?.customMethods
              )
                ?form.paymentDetails.customMethods
                  .map((m:any)=>({
                    name:String(m.name??''),
                    number:String(m.number??''),
                    title:String(m.title??''),
                    active:m.active!==false
                  }))
                  .filter(
                    (m:any)=>m.name.trim()
                  )
                :[],

            instructions:String(
              form.paymentDetails?.instructions??''
            )
          },

          whatsapp:{
            enabled:!!form.whatsapp?.enabled,
            url:String(form.whatsapp?.url??'')
          },

          telegram:{
            enabled:!!form.telegram?.enabled,
            url:String(form.telegram?.url??'')
          }
        }
      );

      setForm(r.data.data);
      setMsg('Settings saved successfully.');
    }catch(err:any){
      setMsg(
        err?.response?.data?.message||
        'Save failed'
      );
    }finally{
      setBusy(false);
    }
  };

  return <Shell>
    <PageTitle
      title="Platform settings"
      text="Admin controls BEP20 payments, withdrawal fee and complete investment timing."
    />

    <form
      className="panel form settings-form"
      onSubmit={save}
    >
      <h2>Platform</h2>

      <input
        value={form.platformName??''}
        onChange={e=>setForm({
          ...form,
          platformName:e.target.value
        })}
        placeholder="Platform name"
      />

      <h2>Withdrawal settings</h2>

      <label>
        Withdrawals enabled
        <input
          type="checkbox"
          checked={!!form.withdrawalsEnabled}
          onChange={e=>setForm({
            ...form,
            withdrawalsEnabled:e.target.checked
          })}
        />
      </label>

      <input
        value={form.withdrawalDisabledMessage??''}
        onChange={e=>setForm({
          ...form,
          withdrawalDisabledMessage:e.target.value
        })}
        placeholder="Disabled message"
      />

      <input
        type="number"
        min="0"
        max="100"
        step="0.01"
        value={form.withdrawalFeePercent??10}
        onChange={e=>setForm({
          ...form,
          withdrawalFeePercent:e.target.value
        })}
        placeholder="Withdrawal fee %"
      />

      <div className="form-grid">
        <input
          type="number"
          min="0"
          value={form.minimumWithdrawal??0}
          onChange={e=>setForm({
            ...form,
            minimumWithdrawal:e.target.value
          })}
          placeholder="Minimum withdrawal"
        />

        <input
          type="number"
          min="0"
          value={form.maximumWithdrawal??0}
          onChange={e=>setForm({
            ...form,
            maximumWithdrawal:e.target.value
          })}
          placeholder="Maximum withdrawal"
        />
      </div>

      <div className="form-grid">
        <input
          type="number"
          min="0"
          value={form.withdrawalCooldownHours??24}
          onChange={e=>setForm({
            ...form,
            withdrawalCooldownHours:e.target.value
          })}
          placeholder="Cooldown hours"
        />

        <input
          type="number"
          min="0"
          value={form.capitalLockDays??45}
          onChange={e=>setForm({
            ...form,
            capitalLockDays:e.target.value
          })}
          placeholder="Capital lock days"
        />
      </div>

      <h2>Investment timing controls</h2>

      <p className="muted">
      </p>

      <div className="form-grid">
        <input
          type="number"
          min="0"
          value={form.capitalRecoveryDays??45}
          onChange={e=>setForm({
            ...form,
            capitalRecoveryDays:e.target.value
          })}
          placeholder="Capital recovery days"
        />

        <input
          type="number"
          min="0"
          value={form.profitDurationDays??45}
          onChange={e=>setForm({
            ...form,
            profitDurationDays:e.target.value
          })}
          placeholder="Profit duration days"
        />
      </div>

      <input
        type="number"
        min="1"
        value={form.totalInvestmentDays??90}
        onChange={e=>setForm({
          ...form,
          totalInvestmentDays:e.target.value
        })}
        placeholder="Total investment days"
      />

      <h2>BEP20 / BNB Smart Chain</h2>

      <div className="settings-box">
        <label>
          BEP20 active
          <input
            type="checkbox"
            checked={
              form.paymentDetails?.bep20Active!==false
            }
            onChange={e=>setForm({
              ...form,
              paymentDetails:{
                ...form.paymentDetails,
                bep20Active:e.target.checked
              }
            })}
          />
        </label>

        <input
          value={
            form.paymentDetails?.bep20Address??''
          }
          onChange={e=>setForm({
            ...form,
            paymentDetails:{
              ...form.paymentDetails,
              bep20Address:e.target.value
            }
          })}
          placeholder="BEP20 deposit wallet address"
        />

        <input
          value={
            form.paymentDetails?.bep20Network||
            'BEP20 / BNB Smart Chain'
          }
          onChange={e=>setForm({
            ...form,
            paymentDetails:{
              ...form.paymentDetails,
              bep20Network:e.target.value
            }
          })}
          placeholder="BEP20 network name"
        />

        <p className="muted">
        </p>
      </div>

      <h2>JazzCash</h2>

      <div className="settings-box">
        <label>
          Active
          <input
            type="checkbox"
            checked={
              !!form.paymentDetails?.jazzCashActive
            }
            onChange={e=>setForm({
              ...form,
              paymentDetails:{
                ...form.paymentDetails,
                jazzCashActive:e.target.checked
              }
            })}
          />
        </label>

        <input
          value={
            form.paymentDetails?.jazzCashNumber??''
          }
          onChange={e=>setForm({
            ...form,
            paymentDetails:{
              ...form.paymentDetails,
              jazzCashNumber:e.target.value
            }
          })}
          placeholder="Display number"
        />

        <input
          value={
            form.paymentDetails?.jazzCashTitle??''
          }
          onChange={e=>setForm({
            ...form,
            paymentDetails:{
              ...form.paymentDetails,
              jazzCashTitle:e.target.value
            }
          })}
          placeholder="Account/title"
        />
      </div>

      <h2>Easypaisa</h2>

      <div className="settings-box">
        <label>
          Active
          <input
            type="checkbox"
            checked={
              !!form.paymentDetails?.easypaisaActive
            }
            onChange={e=>setForm({
              ...form,
              paymentDetails:{
                ...form.paymentDetails,
                easypaisaActive:e.target.checked
              }
            })}
          />
        </label>

        <input
          value={
            form.paymentDetails?.easypaisaNumber??''
          }
          onChange={e=>setForm({
            ...form,
            paymentDetails:{
              ...form.paymentDetails,
              easypaisaNumber:e.target.value
            }
          })}
          placeholder="Display number"
        />

        <input
          value={
            form.paymentDetails?.easypaisaTitle??''
          }
          onChange={e=>setForm({
            ...form,
            paymentDetails:{
              ...form.paymentDetails,
              easypaisaTitle:e.target.value
            }
          })}
          placeholder="Account/title"
        />
      </div>

      <h3>Custom payment methods</h3>

      <div className="settings-box">
        {(Array.isArray(
          form.paymentDetails?.customMethods
        )
          ?form.paymentDetails.customMethods
          :[]
        ).map((m:any,i:number)=>
          <div
            className="panel form"
            key={i}
          >
            <input
              value={m.name??''}
              onChange={e=>{
                const a=[
                  ...(form.paymentDetails?.customMethods??[])
                ];
                a[i]={
                  ...a[i],
                  name:e.target.value
                };

                setForm({
                  ...form,
                  paymentDetails:{
                    ...form.paymentDetails,
                    customMethods:a
                  }
                });
              }}
              placeholder="Method name"
            />

            <input
              value={m.number??''}
              onChange={e=>{
                const a=[
                  ...(form.paymentDetails?.customMethods??[])
                ];
                a[i]={
                  ...a[i],
                  number:e.target.value
                };

                setForm({
                  ...form,
                  paymentDetails:{
                    ...form.paymentDetails,
                    customMethods:a
                  }
                });
              }}
              placeholder="Account / number"
            />

            <input
              value={m.title??''}
              onChange={e=>{
                const a=[
                  ...(form.paymentDetails?.customMethods??[])
                ];
                a[i]={
                  ...a[i],
                  title:e.target.value
                };

                setForm({
                  ...form,
                  paymentDetails:{
                    ...form.paymentDetails,
                    customMethods:a
                  }
                });
              }}
              placeholder="Account title"
            />

            <label>
              Active
              <input
                type="checkbox"
                checked={m.active!==false}
                onChange={e=>{
                  const a=[
                    ...(form.paymentDetails?.customMethods??[])
                  ];

                  a[i]={
                    ...a[i],
                    active:e.target.checked
                  };

                  setForm({
                    ...form,
                    paymentDetails:{
                      ...form.paymentDetails,
                      customMethods:a
                    }
                  });
                }}
              />
            </label>

            <button
              type="button"
              onClick={()=>{
                const a=[
                  ...(form.paymentDetails?.customMethods??[])
                ];

                a.splice(i,1);

                setForm({
                  ...form,
                  paymentDetails:{
                    ...form.paymentDetails,
                    customMethods:a
                  }
                });
              }}
            >
              Remove
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={()=>
            setForm({
              ...form,
              paymentDetails:{
                ...form.paymentDetails,
                customMethods:[
                  ...(form.paymentDetails?.customMethods??[]),
                  {
                    name:'',
                    number:'',
                    title:'',
                    active:true
                  }
                ]
              }
            })
          }
        >
          Add payment method
        </button>
      </div>

      <textarea
        value={
          form.paymentDetails?.instructions??''
        }
        onChange={e=>setForm({
          ...form,
          paymentDetails:{
            ...form.paymentDetails,
            instructions:e.target.value
          }
        })}
        placeholder="Deposit instructions"
      />

      <h2>Referral commission rates</h2>

      <div className="form-grid">
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={form.referralRates?.level1??0}
          onChange={e=>setForm({
            ...form,
            referralRates:{
              ...form.referralRates,
              level1:e.target.value
            }
          })}
          placeholder="Level 1 rate"
        />

        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={form.referralRates?.level2??0}
          onChange={e=>setForm({
            ...form,
            referralRates:{
              ...form.referralRates,
              level2:e.target.value
            }
          })}
          placeholder="Level 2 rate"
        />
      </div>

      <input
        type="number"
        min="0"
        max="1"
        step="0.01"
        value={form.referralRates?.level3??0}
        onChange={e=>setForm({
          ...form,
          referralRates:{
            ...form.referralRates,
            level3:e.target.value
          }
        })}
        placeholder="Level 3 rate"
      />

      <h2>Member communication</h2>

      <div className="settings-box">
        <label>
          WhatsApp enabled
          <input
            type="checkbox"
            checked={!!form.whatsapp?.enabled}
            onChange={e=>setForm({
              ...form,
              whatsapp:{
                ...form.whatsapp,
                enabled:e.target.checked
              }
            })}
          />
        </label>

        <input
          value={form.whatsapp?.url??''}
          onChange={e=>setForm({
            ...form,
            whatsapp:{
              ...form.whatsapp,
              url:e.target.value
            }
          })}
          placeholder="WhatsApp URL"
        />
      </div>

      <div className="settings-box">
        <label>
          Telegram enabled
          <input
            type="checkbox"
            checked={!!form.telegram?.enabled}
            onChange={e=>setForm({
              ...form,
              telegram:{
                ...form.telegram,
                enabled:e.target.checked
              }
            })}
          />
        </label>

        <input
          value={form.telegram?.url??''}
          onChange={e=>setForm({
            ...form,
            telegram:{
              ...form.telegram,
              url:e.target.value
            }
          })}
          placeholder="Telegram URL"
        />
      </div>

      <button
        className="primary"
        disabled={busy}
      >
        {busy?'Saving...':'Save settings'}
      </button>

      {msg&&
        <div className="notice">{msg}</div>
      }
    </form>
  </Shell>
}function AdminPackages(){const {data,loading,error}=useApi<any[]>('/admin/packages');const [f,setF]=useState<any>({name:'',description:'',price:'',salePrice:'',quantity:'',active:true,limitedTimeSale:false,startDate:'',endDate:'',investmentDays:90,capitalRecoveryDays:45,profitDurationDays:45,profitPercent:0});const [images,setImages]=useState<File[]>([]),[editing,setEditing]=useState<any>(null),[preview,setPreview]=useState<any>(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState('');const saveImageList=async(p:any,next:string[])=>{setBusy(`images-${p._id}`);try{const r=await api.put(`/admin/packages/${p._id}/images`,{images:next});setPreview(r.data.data);setMsg('Image order updated.')}catch(e:any){setMsg(e?.response?.data?.message??'Image update failed')}finally{setBusy('')}};const removeImage=async(p:any,img:string)=>{if(!window.confirm('Remove this image from the package?'))return;setBusy(`images-${p._id}`);try{const r=await api.delete(`/admin/packages/${p._id}/images`,{data:{image:img}});setPreview(r.data.data);setMsg('Image removed.')}catch(e:any){setMsg(e?.response?.data?.message??'Image removal failed')}finally{setBusy('')}};const moveImage=(p:any,index:number,delta:number)=>{const next=[...(p.images??[])];const target=index+delta;if(target<0||target>=next.length)return;[next[index],next[target]]=[next[target],next[index]];void saveImageList(p,next)};const payload=(x:any)=>({...x,price:Number(x.price),salePrice:x.salePrice?Number(x.salePrice):null,quantity:Number(x.quantity),investmentDays:Number(x.investmentDays||90),capitalRecoveryDays:Number(x.capitalRecoveryDays||45),profitDurationDays:Number(x.profitDurationDays||45),profitPercent:Number(x.profitPercent||0),startDate:x.startDate?new Date(x.startDate).toISOString():null,endDate:x.endDate?new Date(x.endDate).toISOString():null});const reset=()=>{setEditing(null);setImages([]);setF({name:'',description:'',price:'',salePrice:'',quantity:'',active:true,limitedTimeSale:false,startDate:'',endDate:'',investmentDays:90,capitalRecoveryDays:45,profitDurationDays:45,profitPercent:0})};const save=async(e:FormEvent)=>{e.preventDefault();setBusy('save');try{let r=editing?await api.patch(`/admin/packages/${editing._id}`,payload(f)):await api.post('/admin/packages',payload(f));if(images.length){const fd=new FormData();images.forEach(x=>fd.append('images',x));await api.post(`/admin/packages/${r.data.data._id}/images`,fd)}setMsg(editing?'Package updated.':'Package created.');reset();location.reload()}catch(err:any){setMsg(err?.response?.data?.message??'Save failed')}finally{setBusy('')}};const status=async(p:any)=>{setBusy(p._id);try{await api.post(`/admin/packages/${p._id}/status`,{active:!p.active});location.reload()}catch(e:any){setMsg(e?.response?.data?.message??'Status update failed')}finally{setBusy('')}};const inventory=async(p:any)=>{const q=window.prompt('New total quantity',String(p.quantity));if(q==null)return;setBusy(p._id);try{await api.post(`/admin/packages/${p._id}/inventory`,{quantity:Number(q)});location.reload()}catch(e:any){setMsg(e?.response?.data?.message??'Inventory update failed')}finally{setBusy('')}};return <Shell><PageTitle title="Package / NFT management" text="Create, edit, activate, deactivate and manage real package inventory."/><form className="panel form" onSubmit={save}><h2>{editing?'Edit package':'Create package'}</h2><input required placeholder="Name" value={f.name} onChange={e=>setF({...f,name:e.target.value})}/><textarea placeholder="Description" value={f.description} onChange={e=>setF({...f,description:e.target.value})}/><input required type="number" min="0.01" step="0.01" placeholder="Price" value={f.price} onChange={e=>setF({...f,price:e.target.value})}/><input type="number" min="0.01" step="0.01" placeholder="Sale price" value={f.salePrice} onChange={e=>setF({...f,salePrice:e.target.value})}/><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={e=>setImages(Array.from(e.target.files??[]))}/><input required type="number" min="0" step="1" placeholder="Quantity" value={f.quantity} onChange={e=>setF({...f,quantity:e.target.value})}/><input required type="number" min="1" step="1" placeholder="Investment days" value={f.investmentDays} onChange={e=>setF({...f,investmentDays:e.target.value})}/><input required type="number" min="0" step="0.01" placeholder="Profit %" value={f.profitPercent} onChange={e=>setF({...f,profitPercent:e.target.value})}/><label>Active <input type="checkbox" checked={!!f.active} onChange={e=>setF({...f,active:e.target.checked})}/></label><label>Limited-time sale <input type="checkbox" checked={!!f.limitedTimeSale} onChange={e=>setF({...f,limitedTimeSale:e.target.checked})}/></label><input type="datetime-local" value={f.startDate} onChange={e=>setF({...f,startDate:e.target.value})}/><input type="datetime-local" value={f.endDate} onChange={e=>setF({...f,endDate:e.target.value})}/><div className="actions"><button className="primary" disabled={busy==='save'}>{busy==='save'?'Saving...':editing?'Update package':'Create package'}</button>{editing&&<button type="button" onClick={reset}>Cancel</button>}</div></form>{msg&&<div className="notice">{msg}</div>}{loading?<p>Loading...</p>:error?<div className="alert">{error}</div>:<section className="panel list"><h2>Packages</h2>{(data??[]).map((p:any)=><div className="row" key={p._id}><span><strong>{p.name}</strong><br/>${Number(p.price).toFixed(2)} {p.salePrice!=null&&`- Sale $${Number(p.salePrice).toFixed(2)}`}</span><span>Total {p.quantity} - Remaining {p.remainingQuantity}</span><span>{p.active?'Active':'Inactive'}</span><span>{p.limitedTimeSale?'Sale':'Standard'}</span><span>{Number(p.investmentDays??90)} days ∑ {Number(p.profitPercent??0)}% profit</span><span><button onClick={()=>setPreview(p)}>Preview</button><button onClick={()=>{setEditing(p);setF({name:p.name,description:p.description??'',price:p.price,salePrice:p.salePrice??'',quantity:p.quantity,investmentDays:p.investmentDays??90,capitalRecoveryDays:p.capitalRecoveryDays??45,profitDurationDays:p.profitDurationDays??45,profitPercent:p.profitPercent??0,active:p.active,limitedTimeSale:p.limitedTimeSale,startDate:p.startDate?new Date(p.startDate).toISOString().slice(0,16):'',endDate:p.endDate?new Date(p.endDate).toISOString().slice(0,16):''})}}>Edit</button><button disabled={busy===p._id} onClick={()=>status(p)}>{p.active?'Deactivate':'Activate'}</button><button onClick={()=>inventory(p)}>Inventory</button></span></div>)}{!(data??[]).length&&<p className="muted">No packages found.</p>}</section>}{preview&&<div className="modal-backdrop"><div className="modal"><h2>{preview.name}</h2><p>{preview.description}</p><p>Price: ${Number(preview.price).toFixed(2)} - Sale: {preview.salePrice!=null?`$${Number(preview.salePrice).toFixed(2)}`:'-'}</p><p>Remaining: {preview.remainingQuantity} / {preview.quantity}</p><h3>Images</h3>{preview.images?.length?preview.images.map((img:string,i:number)=><div className="image-manager-row" key={img}><img src={assetUrl(img)} alt={`${preview.name} ${i+1}`} style={{maxWidth:'180px',borderRadius:12}} onError={e=>e.currentTarget.style.opacity='0.4'}/><span>{i===0?'Primary image':''}</span><button disabled={busy===`images-${preview._id}`} onClick={()=>moveImage(preview,i,-1)}>‚Üë</button><button disabled={busy===`images-${preview._id}`} onClick={()=>moveImage(preview,i,1)}>‚Üì</button><button disabled={busy===`images-${preview._id}`} onClick={()=>removeImage(preview,img)}>Remove</button></div>):<p className="muted">No images configured.</p>}<button onClick={()=>setPreview(null)}>Close</button></div></div>}</Shell>}
function AdminNotifications(){
  const {data,loading,error}=useApi<any[]>('/admin/notifications');
  const blank={title:'',message:'',type:'info',color:'#D4AF37',active:true,startAt:'',endAt:'',frequency:'once',repeatIntervalHours:24,dismissible:true};
  const [form,setForm]=useState<any>(blank),[editing,setEditing]=useState<any>(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState('');
  const reset=()=>{setEditing(null);setForm({...blank})};
  const payload=(x:any)=>({...x,startAt:x.startAt?new Date(x.startAt).toISOString():null,endAt:x.endAt?new Date(x.endAt).toISOString():null,repeatIntervalHours:Number(x.repeatIntervalHours)});
  const save=async(e:FormEvent)=>{e.preventDefault();setBusy('save');setMsg('');try{if(editing)await api.patch(`/admin/notifications/${editing._id}`,payload(form));else await api.post('/admin/notifications',payload(form));setMsg(editing?'Notification updated.':'Notification created.');reset();location.reload()}catch(err:any){setMsg(err?.response?.data?.message??'Save failed')}finally{setBusy('')}};
  const status=async(n:any)=>{setBusy(n._id);try{await api.post(`/admin/notifications/${n._id}/status`,{active:!n.active});location.reload()}catch(e:any){setMsg(e?.response?.data?.message??'Status update failed')}finally{setBusy('')}};
  const remove=async(n:any)=>{if(!window.confirm(`Delete notification ‚Äú${n.title}‚Äù?`))return;setBusy(n._id);try{await api.delete(`/admin/notifications/${n._id}`);location.reload()}catch(e:any){setMsg(e?.response?.data?.message??'Delete failed')}finally{setBusy('')}};
  return <Shell><PageTitle title="Notification management" text="Create scheduled, repeatable member announcements with server-controlled state."/>
    <form className="panel form" onSubmit={save}>
      <h2>{editing?'Edit notification':'Create notification'}</h2>
      <input required placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
      <textarea required placeholder="Message" value={form.message} onChange={e=>setForm({...form,message:e.target.value})}/>
      <div className="form-grid"><input placeholder="Type" value={form.type} onChange={e=>setForm({...form,type:e.target.value})}/><input type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})}/><select value={form.frequency} onChange={e=>setForm({...form,frequency:e.target.value})}><option value="once">Once</option><option value="repeat">Repeat</option><option value="always">Always</option></select></div>
      <div className="form-grid"><input type="datetime-local" value={form.startAt} onChange={e=>setForm({...form,startAt:e.target.value})}/><input type="datetime-local" value={form.endAt} onChange={e=>setForm({...form,endAt:e.target.value})}/></div>
      {form.frequency==='repeat'&&<input type="number" min="1" value={form.repeatIntervalHours} onChange={e=>setForm({...form,repeatIntervalHours:e.target.value})} placeholder="Repeat interval (hours)"/>}
      <label>Dismissible <input type="checkbox" checked={!!form.dismissible} onChange={e=>setForm({...form,dismissible:e.target.checked})}/></label>
      <label>Active <input type="checkbox" checked={!!form.active} onChange={e=>setForm({...form,active:e.target.checked})}/></label>
      <div className="actions"><button className="primary" disabled={busy==='save'}>{busy==='save'?'Saving...':editing?'Update notification':'Create notification'}</button>{editing&&<button type="button" onClick={reset}>Cancel</button>}</div>
      {msg&&<div className="notice">{msg}</div>}
    </form>
    {loading?<p>Loading...</p>:error?<div className="alert">{error}</div>:<section className="panel list"><h2>Notifications</h2>{data?.length?(data.map((n:any)=><div className="row" key={n._id}><span><strong>{n.title}</strong><br/><small>{n.message}</small></span><span>{n.status}</span><span>{n.frequency}</span><span><button onClick={()=>{setEditing(n);setForm({title:n.title,message:n.message,type:n.type??'info',color:n.color??'#D4AF37',active:n.active,startAt:n.startAt?new Date(n.startAt).toISOString().slice(0,16):'',endAt:n.endAt?new Date(n.endAt).toISOString().slice(0,16):'',frequency:n.frequency,repeatIntervalHours:n.repeatIntervalHours??24,dismissible:n.dismissible!==false})}}>Edit</button><button disabled={busy===n._id} onClick={()=>status(n)}>{n.active?'Deactivate':'Activate'}</button><button disabled={busy===n._id} onClick={()=>remove(n)}>Delete</button></span></div>)):<p className="muted">No notifications found.</p>}</section>}
  </Shell>
}
function AdminBanners(){
  const {data,loading,error}=useApi<any[]>('/admin/banners');
  const blank={title:'',description:'',offerText:'',destinationUrl:'',order:0,active:true,startAt:'',endAt:'',promoType:'general',image:null as File|null};
  const [form,setForm]=useState<any>(blank),[editing,setEditing]=useState<any>(null),[preview,setPreview]=useState<any>(null),[msg,setMsg]=useState(''),[busy,setBusy]=useState('');
  const reset=()=>{setEditing(null);setForm({...blank})};
  const save=async(e:FormEvent)=>{e.preventDefault();setBusy('save');setMsg('');try{const fd=new FormData();Object.entries(form).forEach(([k,v])=>{if(k!=='image'&&v!==null&&v!==undefined&&v!=='')fd.append(k,String(k==='startAt'||k==='endAt'?new Date(String(v)).toISOString():v))});if(form.image)fd.append('image',form.image);if(editing)await api.patch(`/content/admin/banners/${editing._id}`,fd);else await api.post('/content/admin/banners',fd);setMsg(editing?'Banner updated.':'Banner created.');reset();location.reload()}catch(err:any){setMsg(err?.response?.data?.message??'Save failed')}finally{setBusy('')}};
  const status=async(b:any)=>{setBusy(b._id);try{await api.post(`/content/admin/banners/${b._id}/status`,{active:!b.active});location.reload()}catch(e:any){setMsg(e?.response?.data?.message??'Status update failed')}finally{setBusy('')}};
  const remove=async(b:any)=>{if(!window.confirm(`Delete banner ‚Äú${b.title}‚Äù?`))return;setBusy(b._id);try{await api.delete(`/content/admin/banners/${b._id}`);location.reload()}catch(e:any){setMsg(e?.response?.data?.message??'Delete failed')}finally{setBusy('')}};
  return <Shell><PageTitle title="Banner management" text="Manage promotional, NFT and sale banners with scheduling, ordering and secure image uploads."/>
    <form className="panel form" onSubmit={save}>
      <h2>{editing?'Edit banner':'Create banner'}</h2><input required placeholder="Title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><textarea placeholder="Description" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><input placeholder="Offer text" value={form.offerText} onChange={e=>setForm({...form,offerText:e.target.value})}/>
      <div className="form-grid"><select value={form.promoType} onChange={e=>setForm({...form,promoType:e.target.value})}><option value="general">General</option><option value="nft">NFT</option><option value="sale">Sale</option></select><input type="number" min="0" value={form.order} onChange={e=>setForm({...form,order:e.target.value})} placeholder="Display order"/></div>
      <input placeholder="Destination URL (HTTPS/HTTP)" value={form.destinationUrl} onChange={e=>setForm({...form,destinationUrl:e.target.value})}/><div className="form-grid"><input type="datetime-local" value={form.startAt} onChange={e=>setForm({...form,startAt:e.target.value})}/><input type="datetime-local" value={form.endAt} onChange={e=>setForm({...form,endAt:e.target.value})}/></div>
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setForm({...form,image:e.target.files?.[0]??null})}/>{form.image&&<div className="upload-preview"><img src={URL.createObjectURL(form.image)} alt="Banner preview"/></div>}{editing?.imageUrl&&!form.image&&<div className="upload-preview"><img src={assetUrl(editing.imageUrl)} alt="Current banner"/></div>}
      <label>Active <input type="checkbox" checked={!!form.active} onChange={e=>setForm({...form,active:e.target.checked})}/></label><div className="actions"><button className="primary" disabled={busy==='save'}>{busy==='save'?'Saving...':editing?'Update banner':'Create banner'}</button>{editing&&<button type="button" onClick={reset}>Cancel</button>}</div>{msg&&<div className="notice">{msg}</div>}
    </form>
    {loading?<p>Loading...</p>:error?<div className="alert">{error}</div>:<section className="panel list"><h2>All banners</h2>{data?.length?(data.map((b:any)=><div className="row" key={b._id}><span><strong>{b.title}</strong><br/><small>{b.offerText||b.description||'-'}</small></span><span>{b.status}</span><span>Order {b.order}</span><span>{b.promoType}</span><span><button onClick={()=>setPreview(b)}>Preview</button><button onClick={()=>{setEditing(b);setForm({title:b.title,description:b.description??'',offerText:b.offerText??'',destinationUrl:b.destinationUrl??'',order:b.order??0,active:b.active,startAt:b.startAt?new Date(b.startAt).toISOString().slice(0,16):'',endAt:b.endAt?new Date(b.endAt).toISOString().slice(0,16):'',promoType:b.promoType??'general',image:null})}}>Edit</button><button disabled={busy===b._id} onClick={()=>status(b)}>{b.active?'Deactivate':'Activate'}</button><button disabled={busy===b._id} onClick={()=>remove(b)}>Delete</button></span></div>)):<p className="muted">No banners found.</p>}</section>}
    {preview&&<div className="modal-backdrop"><div className="modal"><img src={assetUrl(preview.imageUrl)} alt={preview.title} style={{width:'100%',borderRadius:14}}/><span className="eyebrow">{preview.promoType}</span><h2>{preview.title}</h2><p>{preview.description}</p><strong>{preview.offerText}</strong><button onClick={()=>setPreview(null)}>Close</button></div></div>}
  </Shell>
}
function assetUrl(value?:string){if(!value)return '';if(/^https?:/.test(value))return value;const base=(import.meta.env.VITE_API_URL??'/api').replace(/\/api$/,'');return `${base}${value}`;}
function copy(value?:string){if(value)navigator.clipboard.writeText(value)}
export default function App(){return <Routes><Route path="/login" element={<Auth/>}/><Route path="/register" element={<Auth/>}/><Route path="/forgot-password" element={<Forgot/>}/><Route path="/reset-password" element={<Reset/>}/><Route path="/" element={<Protected><Dashboard/></Protected>}/><Route path="/packages" element={<Protected><Packages/></Protected>}/><Route path="/active-packages" element={<Protected><ActivePackages/></Protected>}/><Route path="/deposit" element={<Protected><Deposit/></Protected>}/><Route path="/withdrawal" element={<Protected><Withdrawal/></Protected>}/><Route path="/team" element={<Protected><Team/></Protected>}/><Route path="/commission" element={<Protected><Commission/></Protected>}/><Route path="/account" element={<Protected><Account/></Protected>}/><Route path="/support" element={<Protected><Support/></Protected>}/><Route path="/payment-details" element={<Protected><PaymentDetails/></Protected>}/><Route path="/security" element={<Protected><Security/></Protected>}/><Route path="/transactions" element={<Protected><Transactions/></Protected>}/><Route path="/notifications" element={<Protected><Notifications/></Protected>}/><Route path="/capital" element={<Protected><Capital/></Protected>}/><Route path="/profit" element={<Protected><Profit/></Protected>}/><Route path="/rewards" element={<Protected><Rewards/></Protected>}/><Route path="/admin" element={<Protected admin><Admin/></Protected>}/><Route path="/admin/members" element={<Protected admin><AdminMembers/></Protected>}/><Route path="/admin/support" element={<Protected admin><AdminSupport/></Protected>}/><Route path="/admin/members/:id" element={<Protected admin><AdminMemberDetail/></Protected>}/><Route path="/admin/ledger" element={<Protected admin><AdminTable type="ledger"/></Protected>}/><Route path="/admin/audit" element={<Protected admin><AdminTable type="audit"/></Protected>}/><Route path="/admin/admins" element={<Protected superAdmin><AdminTable type="admins"/></Protected>}/><Route path="/admin/payment-requests" element={<Protected admin><AdminTable type="payment"/></Protected>}/><Route path="/admin/settings" element={<Protected admin><AdminSettings/></Protected>}/><Route path="/admin/finance" element={<Protected admin><AdminFinance/></Protected>}/><Route path="/admin/deposits" element={<Protected admin><AdminDeposits/></Protected>}/><Route path="/admin/withdrawals" element={<Protected admin><AdminWithdrawals/></Protected>}/><Route path="/admin/packages" element={<Protected admin><AdminPackages/></Protected>}/><Route path="/admin/notifications" element={<Protected admin><AdminNotifications/></Protected>}/><Route path="/admin/banners" element={<Protected admin><AdminBanners/></Protected>}/></Routes>}















































































