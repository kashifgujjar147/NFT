$ErrorActionPreference = "Stop"

$Root = (Get-Location).Path
$App = Join-Path $Root "client\src\App.tsx"

if (-not (Test-Path $App)) {
    throw "client\src\App.tsx not found. Run this script from the project root."
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$Backup = "$App.before-active-packages-$stamp.bak"
Copy-Item $App $Backup -Force
Write-Host "Backup created: $Backup" -ForegroundColor Green

$content = Get-Content $App -Raw

# Fix the existing NFT purchase redirect bug.
$oldBuy = @'
  const buy=async(id:string,amount:number)=>{
    setBuying(true);
    setMsg('');

    try{
      location.href=
        `/deposit?packageId=&amount=${encodeURIComponent(id)}`;
    }catch{
      setMsg('Payment page open nahi ho saki');
    }finally{
      setBuying(false);
    }
  };
'@

$newBuy = @'
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
'@

if ($content.Contains($oldBuy)) {
    $content = $content.Replace($oldBuy,$newBuy)
    Write-Host "Fixed NFT purchase -> deposit redirect." -ForegroundColor Green
} else {
    Write-Warning "Expected buy() block was not found; purchase redirect was not changed."
}

# Add a separate Packages navigation item while keeping NFT marketplace intact.
$oldNav = '<NavLink to="/packages"><span className="nav-icon"><Gem size={22}/></span><span>NFT</span></NavLink>'
$newNav = '<NavLink to="/packages"><span className="nav-icon"><Gem size={22}/></span><span>NFT</span></NavLink><NavLink to="/active-packages"><span className="nav-icon"><Package size={22}/></span><span>Packages</span></NavLink>'

if ($content.Contains($oldNav) -and -not $content.Contains('to="/active-packages"')) {
    $content = $content.Replace($oldNav,$newNav)
    Write-Host "Added Packages navigation button." -ForegroundColor Green
} elseif ($content.Contains('to="/active-packages"')) {
    Write-Host "Packages navigation already exists; leaving it unchanged." -ForegroundColor Yellow
} else {
    Write-Warning "NFT navigation block was not found."
}

# Add a dedicated authenticated Active Packages page.
$marker = 'function PackageMaturity({end,status}:{end:string,status:string})'

if (-not $content.Contains('function ActivePackages()')) {
$component = @'
function ActivePackages(){
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
'@
    if (-not $content.Contains($marker)) {
        throw "Could not find PackageMaturity insertion point."
    }
    $content = $content.Replace($marker, $component + "`r`n" + $marker)
    Write-Host "Added dedicated Active Packages page." -ForegroundColor Green
}

# Add the dedicated authenticated route.
$oldRoute = '<Route path="/packages" element={<Protected><Packages/></Protected>}/>'
$newRoute = '<Route path="/packages" element={<Protected><Packages/></Protected>}/><Route path="/active-packages" element={<Protected><ActivePackages/></Protected>}/>'

if ($content.Contains($oldRoute) -and -not $content.Contains('<Route path="/active-packages"')) {
    $content = $content.Replace($oldRoute,$newRoute)
    Write-Host "Added /active-packages route." -ForegroundColor Green
}

# After package payment proof submission, send the user directly to Packages.
$oldSuccess = @'
      history.replaceState(null,'','/deposit');

      reload();

      setMsg(
        f.depositType==='package'
          ?'NFT payment proof submitted. Package will activate only after admin verification.'
          :'BEP20 deposit submitted. Balance will be credited only after admin verification.'
      );
'@

$newSuccess = @'
      if(f.depositType==='package'){
        location.href='/active-packages';
        return;
      }

      history.replaceState(null,'','/deposit');

      reload();

      setMsg(
        'BEP20 deposit submitted. Balance will be credited only after admin verification.'
      );
'@

if ($content.Contains($oldSuccess)) {
    $content = $content.Replace($oldSuccess,$newSuccess)
    Write-Host "Package payment submission now redirects to /active-packages." -ForegroundColor Green
} else {
    Write-Warning "Expected Deposit success block was not found; post-purchase redirect was not changed."
}

# Ensure Package icon is imported from lucide-react.
if ($content -match "from ['""]lucide-react['""]" -and $content -notmatch "\bPackage\b") {
    $content = $content -replace "(?s)(import\s*\{)(.*?)(\}\s*from\s*['""]lucide-react['""])", '$1$2, Package$3'
    Write-Host "Added Package icon import." -ForegroundColor Green
}

Set-Content -Path $App -Value $content -Encoding utf8
Write-Host "`nApp.tsx updated successfully." -ForegroundColor Green

Write-Host "`n===== VERIFY =====" -ForegroundColor Cyan
Select-String -Path $App -Pattern 'active-packages|function ActivePackages|packageId=' |
    Select-Object LineNumber,Line |
    Format-Table -Wrap -AutoSize

Write-Host "`n===== CLIENT BUILD =====" -ForegroundColor Cyan
Push-Location ".\client"
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Client build failed. Review the errors above."
    }
} finally {
    Pop-Location
}

Write-Host "`nDONE: Active Packages implementation applied. Backup: $Backup" -ForegroundColor Green
