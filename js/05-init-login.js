/* ============================================================
   MLEA POS v6.0 — 05-init-login.js
   initApp, login screen, sidebar, view switcher
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */

// ════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════
function initApp(){
  if(!LocalDB.getAll('branches').length)LocalDB.add('branches',{name:'Main Branch',address:'Head Office',phone:'555-0000'});
  if(!LocalDB.getAll('users').length)LocalDB.add('users',{name:'Admin',role:'admin',active:true,pin:'1234',branchId:null});
  if(!LocalDB.getAll('products').length)[
    {sku:'SKU001',name:'Bottled Water 500ml',   price:15,  cost:9,  stock:120,category:'Beverages',    barcode:'4800001000017',vatExempt:false},
    {sku:'SKU002',name:'Instant Coffee 3-in-1', price:12,  cost:7,  stock:200,category:'Beverages',    barcode:'4800001000024',vatExempt:false},
    {sku:'SKU003',name:'White Bread Loaf',       price:55,  cost:36, stock:40, category:'Bakery',       barcode:'4800001000031',vatExempt:false},
    {sku:'SKU004',name:'Canned Sardines 155g',   price:28,  cost:19, stock:90, category:'Canned Goods', barcode:'4800001000048',vatExempt:false},
    {sku:'SKU005',name:'Shampoo Sachet',         price:8,   cost:4,  stock:250,category:'Personal Care',barcode:'4800001000055',vatExempt:false},
    {sku:'SKU006',name:'Bath Soap 90g',          price:35,  cost:22, stock:80, category:'Personal Care',barcode:'4800001000062',vatExempt:false},
    {sku:'SKU007',name:'Paracetamol 500mg (10s)',price:45,  cost:28, stock:60, category:'Medicine',     barcode:'4800001000079',vatExempt:true },
    {sku:'SKU008',name:'Vitamin C 500mg (10s)',  price:60,  cost:38, stock:55, category:'Medicine',     barcode:'4800001000086',vatExempt:true },
    {sku:'SKU009',name:'Ballpen Black',          price:10,  cost:5,  stock:150,category:'Stationery',   barcode:'4800001000093',vatExempt:false},
    {sku:'SKU010',name:'Face Towel',             price:40,  cost:24, stock:35, category:'Household',     barcode:'4800001000109',vatExempt:false}
  ].forEach(p=>LocalDB.add('products',{...p,unit:'pcs',active:true,branchId:null,supplierId:null,zeroRated:false}));
  if(!LocalDB.getAll('suppliers').length)LocalDB.add('suppliers',{name:'Sample Supplier',contact:'John Doe',phone:'555-0001',email:'supplier@email.com',address:'123 Supplier St'});
  LocalDB.getAll('settings').forEach(s=>{
    if(s.key==='currency')cur=s.value;
    if(s.key==='taxRate')taxRate=parseFloat(s.value)||0.12;
    if(s.key==='lowStockThresh')lowStockThresh=parseInt(s.value)||10;
    if(s.key==='printMode')printMode=s.value||'ask';
    if(s.key==='rcptFooter')rcptFooter=s.value||'Thank you for your purchase!';
    if(s.key==='storageMode')storageMode=s.value||'local';
  });
  held=LocalDB.getAll('heldSales');
  applyFontSize(getFontSize()); // restore saved font size
  updateSyncBar();
  // Migrate any plaintext PINs to hashed storage on startup
  migratePlaintextPINs().catch(()=>{});
  renderLogin();
}

// ════════════════════════════════════════════
// LOGIN
// ════════════════════════════════════════════
function renderLogin(){
  document.getElementById('loginScreen').style.display='flex';
  document.getElementById('mainApp').style.display='none';
  document.getElementById('syncBar').style.display='none';
  const users=LocalDB.getAll('users');
  document.getElementById('usrGrid').innerHTML=users.filter(u=>u.active).map(u=>`
    <div class="usr-card ${selUserId===u.id?'sel':''}" onclick="selUser(${u.id})">
      <span class="av">${u.role==='admin'?'👑':u.role==='manager'?'🎯':'👤'}</span>
      <div class="nm">${u.name}</div>
      <span class="rbadge rb-${u.role}">${u.role}</span>
    </div>`).join('');
  pinEntry='';updPinDots();
  document.getElementById('errMsg').textContent='';
  if(Date.now()<pinLockUntil)chkLock();
}
function selUser(id){selUserId=id;pinEntry='';pinFails=0;pinLockUntil=0;updPinDots();document.getElementById('errMsg').textContent='';const lb=document.getElementById('lockoutBar');if(lb)lb.style.display='none';document.querySelectorAll('.pbn').forEach(b=>b.disabled=false);renderLogin();}
function ePin(d){if(chkLock())return;if(!selUserId){document.getElementById('errMsg').textContent='Select a user first';return;}if(pinEntry.length<4){pinEntry+=d;updPinDots();if(pinEntry.length===4)setTimeout(subPin,180);}}
function clrPin(){pinEntry='';updPinDots();document.getElementById('errMsg').textContent='';}
function updPinDots(){document.querySelectorAll('.pin-dot').forEach((d,i)=>{d.classList.toggle('on',i<pinEntry.length);d.classList.remove('err');});}
async function subPin(){
  if(chkLock())return;if(!selUserId)return;
  const users=LocalDB.getAll('users');const user=users.find(u=>u.id===selUserId);
  if(!user||!user.active){document.getElementById('errMsg').textContent=!user?'User not found':'Account deactivated';pinEntry='';updPinDots();return;}
  const result=await verifyPIN(pinEntry,user.pin);
  if(result){
    // Auto-upgrade legacy plaintext PIN to hashed silently
    if(result==='legacy'){
      hashAndStorePIN(user.id,pinEntry).catch(()=>{});
    }
    pinFails=0;pinLockUntil=0;currentUser=user;
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('mainApp').style.display='block';
    document.getElementById('syncBar').style.display='flex';
    const b=user.branchId?LocalDB.getById('branches',user.branchId):null;
    document.getElementById('hdrBranch').innerHTML=user.branchId?`<span class="br-chip">🏢 ${b?b.name:'Branch'}</span>`:`<span class="adm-chip">👑 Admin</span>`;
    document.getElementById('hdrTitle').textContent=user.branchId?(b?b.name:'Branch')+' POS':'MLEA HQ';
    renderSidebar();pinEntry='';selUserId=null;updPinDots();document.getElementById('errMsg').textContent='';
    resetSesTimer();sw('dashboard');setTimeout(showLowStockToast,700);
    // Auto-backup reminder
    const lastBackup=parseInt(getSetting('last_backup_ts','0'))||0;
    const daysSince=Math.floor((Date.now()-lastBackup)/(1000*60*60*24));
    if(daysSince>=7||!lastBackup)setTimeout(()=>toast('💾 No backup in '+(lastBackup?daysSince+'':'many')+' days. Download one from Backup & Export.','gold',6000),3000);
  }else{
    pinFails++;document.getElementById('errMsg').textContent='Incorrect PIN ('+pinFails+'/5)';
    pinEntry='';updPinDots();
    document.querySelectorAll('.pin-dot').forEach(d=>d.classList.add('err'));
    setTimeout(()=>document.querySelectorAll('.pin-dot').forEach(d=>d.classList.remove('err')),500);
    if(pinFails>=5){pinLockUntil=Date.now()+60000;logAct('PIN Lockout','User '+selUserId);chkLock();}
  }
}
// ════════════════════════════════════════════
// SIDEBAR
// ════════════════════════════════════════════
function renderSidebar(){
  const nav=document.getElementById('sbNav');if(!currentUser)return;
  const low=getMyData('products').filter(p=>p.active&&p.stock<=lowStockThresh).length;
  const heldCnt=held.length;
  document.getElementById('sbSub').textContent='v6.0 · '+(storageMode==='firebase'?'☁️ Firebase':'💾 Local');
  const nb=(n,c)=>n>0?` <span style="color:var(--${c});font-size:.72em;font-weight:700">(${n})</span>`:'';
  const adminNav=`
    <div class="sb-sec">Main</div>
    <div class="sb-item" onclick="sw('dashboard')"><span class="sb-icon">📊</span>Dashboard</div>
    <div class="sb-sec">Sales</div>
    <div class="sb-item" onclick="sw('pos')"><span class="sb-icon">💳</span>POS Terminal${nb(heldCnt,'gold')}</div>
    <div class="sb-item" onclick="sw('allSales')"><span class="sb-icon">💰</span>Sales History</div>
    <div class="sb-item" onclick="sw('returns')"><span class="sb-icon">↩️</span>Returns & Refunds</div>
    <div class="sb-item" onclick="sw('voidedSales')"><span class="sb-icon">🚫</span>Voided Transactions</div>
    <div class="sb-sec">Inventory</div>
    <div class="sb-item" onclick="sw('allProducts')"><span class="sb-icon">📦</span>Products${nb(low,'rose')}</div>
    <div class="sb-item" onclick="sw('suppliers')"><span class="sb-icon">🚚</span>Suppliers</div>
    <div class="sb-item" onclick="sw('purchaseOrders')"><span class="sb-icon">📋</span>Purchase Orders</div>
    <div class="sb-sec">Management</div>
    <div class="sb-item" onclick="sw('branches')"><span class="sb-icon">🏢</span>Branches</div>
    <div class="sb-item" onclick="sw('allUsers')"><span class="sb-icon">👥</span>Users</div>
    <div class="sb-sec">BIR Compliance</div>
    <div class="sb-item" onclick="sw('xReading')"><span class="sb-icon">📑</span>X-Reading</div>
    <div class="sb-item" onclick="sw('zReading')"><span class="sb-icon">📋</span>Z-Reading</div>
    <div class="sb-item" onclick="sw('birSetup')"><span class="sb-icon">🏛️</span>BIR Setup</div>
    <div class="sb-sec">Reports</div>
    <div class="sb-item" onclick="sw('reports')"><span class="sb-icon">📈</span>Reports & Analytics</div>
    <div class="sb-item" onclick="sw('actLog')"><span class="sb-icon">📝</span>Activity Log</div>
    <div class="sb-item" onclick="sw('backup')"><span class="sb-icon">📁</span>Backup & Export</div>
    <div class="sb-sec">System</div>
    <div class="sb-item" onclick="sw('settings')"><span class="sb-icon">⚙️</span>Settings</div>
    <div class="sb-item" onclick="sw('fbSetup')"><span class="sb-icon">☁️</span>Firebase Setup</div>`;
  const manNav=`
    <div class="sb-sec">Main</div>
    <div class="sb-item" onclick="sw('dashboard')"><span class="sb-icon">📊</span>Dashboard</div>
    <div class="sb-item" onclick="sw('pos')"><span class="sb-icon">💳</span>POS Terminal${nb(heldCnt,'gold')}</div>
    <div class="sb-item" onclick="sw('branchSales')"><span class="sb-icon">💰</span>Sales</div>
    <div class="sb-item" onclick="sw('returns')"><span class="sb-icon">↩️</span>Returns</div>
    <div class="sb-sec">Inventory</div>
    <div class="sb-item" onclick="sw('inventory')"><span class="sb-icon">📦</span>Products${nb(low,'rose')}</div>
    <div class="sb-item" onclick="sw('suppliers')"><span class="sb-icon">🚚</span>Suppliers</div>
    <div class="sb-item" onclick="sw('purchaseOrders')"><span class="sb-icon">📋</span>Purchase Orders</div>
    <div class="sb-sec">Team</div>
    <div class="sb-item" onclick="sw('myUsers')"><span class="sb-icon">👥</span>Cashiers</div>
    <div class="sb-sec">BIR</div>
    <div class="sb-item" onclick="sw('xReading')"><span class="sb-icon">📑</span>X-Reading</div>
    <div class="sb-item" onclick="sw('zReading')"><span class="sb-icon">📋</span>Z-Reading</div>
    <div class="sb-sec">Reports</div>
    <div class="sb-item" onclick="sw('reports')"><span class="sb-icon">📈</span>Reports</div>
    <div class="sb-item" onclick="sw('actLog')"><span class="sb-icon">📝</span>Activity Log</div>
    <div class="sb-item" onclick="sw('backup')"><span class="sb-icon">📁</span>Backup</div>
    <div class="sb-item" onclick="sw('settings')"><span class="sb-icon">⚙️</span>Settings</div>`;
  const cashNav=`
    <div class="sb-sec">Main</div>
    <div class="sb-item" onclick="sw('dashboard')"><span class="sb-icon">📊</span>Dashboard</div>
    <div class="sb-item" onclick="sw('pos')"><span class="sb-icon">💳</span>POS Terminal${nb(heldCnt,'gold')}</div>`;
  nav.innerHTML=currentUser.role==='admin'?adminNav:currentUser.role==='manager'?manNav:cashNav;
}
function logout(){
  confirm2('Sign out of MLEA POS?','🚪').then(ok=>{
    if(!ok)return;
    currentUser=null;cart=[];discAmt=0;discType='none';clearTimeout(sesTimer);clearTimeout(sesWarnTimer);
    document.getElementById('mainApp').style.display='none';
    document.getElementById('syncBar').style.display='none';
    closeSB();renderLogin();
  });
}
function openSB(){document.getElementById('sidebar').classList.add('on');document.getElementById('sbOv').classList.add('on');}
function closeSB(){document.getElementById('sidebar').classList.remove('on');document.getElementById('sbOv').classList.remove('on');}

// ════════════════════════════════════════════
// VIEW SWITCHER
// ────────────────────────────────────────────
// NOTE (modular build): viewMap is populated in
// 19-patches.js, which loads LAST — after every
// render* function it points to has been defined.
// Declaring it here (empty) lets sw() reference it;
// sw() only runs at click-time, by which point the
// map is fully populated.
// ════════════════════════════════════════════
var viewMap={};
function sw(view){
  // Reset product list filters when leaving the products view
  if(currentView!==view&&view!=='allProducts'&&view!=='inventory'){
    _prodSearch='';_prodCat='all';_prodStock='all';_prodSort='name';_prodPage=1;
  }
  currentView=view;closeSB();resetSesTimer();
  const el=document.getElementById('mainContent');
  el.style.opacity='0';el.style.transform='translateY(8px)';
  setTimeout(()=>{
    (viewMap[view]||renderDashboard)(el);
    el.style.transition='all .25s ease';el.style.opacity='1';el.style.transform='translateY(0)';
  },80);
}

