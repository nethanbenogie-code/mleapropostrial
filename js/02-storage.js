/* ============================================================
   MLEA POS v6.0 — 02-storage.js
   LocalDB, FirebaseDB, offline queue, unified DB, network status
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */

// ════════════════════════════════════════════
// STORAGE — LOCAL
// ════════════════════════════════════════════
const STORES=['products','sales','users','settings','branches','activityLogs','suppliers','purchaseOrders','voidedSales','heldSales','returns','customers','expenses'];
const LocalDB={
  init(){STORES.forEach(s=>{if(!localStorage.getItem('mlea_'+s))localStorage.setItem('mlea_'+s,'[]')})},
  getAll(k){try{return JSON.parse(localStorage.getItem('mlea_'+k)||'[]')}catch{return[]}},
  set(k,d){localStorage.setItem('mlea_'+k,JSON.stringify(d))},
  add(k,item){
    const items=this.getAll(k);
    item.id=items.reduce((max,i)=>Math.max(max,i.id||0),0)+1;
    item.createdAt=new Date().toISOString();
    items.push(item);this.set(k,items);return item.id;
  },
  update(k,item){
    const items=this.getAll(k);const idx=items.findIndex(i=>i.id===item.id);
    if(idx!==-1){item.updatedAt=new Date().toISOString();items[idx]=item;this.set(k,items);}
  },
  delete(k,id){this.set(k,this.getAll(k).filter(i=>i.id!==id))},
  getById(k,id){return this.getAll(k).find(i=>i.id===id)||null},
  getByBranch(k,bid){return this.getAll(k).filter(i=>i.branchId===bid)}
};
LocalDB.init();

// ════════════════════════════════════════════
// STORAGE — FIREBASE
// ════════════════════════════════════════════
let _fb=null; // firestore module refs
const FirebaseDB={
  _cache:{},
  async init(config){
    try{
      const{initializeApp,getApps}=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
      const fs=await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
      const app=getApps().length===0?initializeApp(config):getApps()[0];
      _fb={...fs,db:fs.getFirestore(app)};
      for(const s of STORES)await this._load(s);
      setSyncStatus('cloud','Connected ✓');return true;
    }catch(e){setSyncStatus('offline','Firebase error: '+e.message);return false;}
  },
  async _load(k){
    try{
      const snap=await _fb.getDocs(_fb.collection(_fb.db,k));
      this._cache[k]=snap.docs.map(d=>({...d.data(),_did:d.id}));
    }catch{this._cache[k]=this._cache[k]||[];}
  },
  getAll(k){return this._cache[k]||[]},
  set(k,arr){this._cache[k]=arr},
  add(k,item){
    const items=this.getAll(k);
    item.id=items.reduce((max,i)=>Math.max(max,i.id||0),0)+1;
    item.createdAt=new Date().toISOString();
    const did=k+'_'+item.id;item._did=did;items.push(item);this._cache[k]=items;
    this._write(k,did,item);
    // mirror to local
    const li=LocalDB.getAll(k);if(!li.find(i=>i.id===item.id)){li.push({...item});LocalDB.set(k,li);}
    return item.id;
  },
  update(k,item){
    const items=this.getAll(k);const idx=items.findIndex(i=>i.id===item.id);
    if(idx!==-1){item.updatedAt=new Date().toISOString();const did=item._did||k+'_'+item.id;item._did=did;items[idx]=item;this._cache[k]=items;
      this._write(k,did,item);
      const li=LocalDB.getAll(k);const li2=li.findIndex(i=>i.id===item.id);if(li2!==-1){li[li2]=item;LocalDB.set(k,li);}
    }
  },
  delete(k,id){
    const item=this.getById(k,id);this._cache[k]=(this._cache[k]||[]).filter(i=>i.id!==id);
    LocalDB.set(k,LocalDB.getAll(k).filter(i=>i.id!==id));
    if(item){const did=item._did||k+'_'+id;if(isOnline)this._del(k,did);else offQ.push({op:'del',col:k,did});}
  },
  getById(k,id){return(this._cache[k]||[]).find(i=>i.id===id)||null},
  getByBranch(k,bid){return(this._cache[k]||[]).filter(i=>i.branchId===bid)},
  async _write(col,did,data){
    if(!isOnline){offQ.push({op:'set',col,did,data});setSyncStatus('offline','Offline — queuing');return;}
    try{await _fb.setDoc(_fb.doc(_fb.db,col,did),data);setSyncStatus('cloud','Synced ✓');}
    catch(e){offQ.push({op:'set',col,did,data});setSyncStatus('offline','Sync error');}
  },
  async _del(col,did){
    try{await _fb.deleteDoc(_fb.doc(_fb.db,col,did));}
    catch(e){offQ.push({op:'del',col,did});}
  }
};

let offQ=[];
async function flushQ(){
  if(!_fb||!offQ.length)return;
  const q=[...offQ];offQ=[];
  for(const op of q){
    try{
      if(op.op==='set')await _fb.setDoc(_fb.doc(_fb.db,op.col,op.did),op.data);
      else await _fb.deleteDoc(_fb.doc(_fb.db,op.col,op.did));
    }catch{offQ.push(op);}
  }
  if(!offQ.length)setSyncStatus('cloud','All synced ✓');
}

// ════════════════════════════════════════════
// UNIFIED DB
// ════════════════════════════════════════════
let storageMode='local';
const DB={
  get _a(){return storageMode==='firebase'?FirebaseDB:LocalDB},
  getAll(k){return this._a.getAll(k)},
  set(k,d){this._a.set(k,d)},
  add(k,item){return this._a.add(k,item)},
  update(k,item){this._a.update(k,item)},
  delete(k,id){this._a.delete(k,id)},
  getById(k,id){return this._a.getById(k,id)},
  getByBranch(k,bid){return this._a.getByBranch(k,bid)}
};

// ════════════════════════════════════════════
// NETWORK
// ════════════════════════════════════════════
let isOnline=navigator.onLine;
window.addEventListener('online',()=>{isOnline=true;updateSyncBar();flushQ();});
window.addEventListener('offline',()=>{isOnline=false;updateSyncBar();});
function setSyncStatus(mode,msg){
  const dot=document.getElementById('syncDot'),lbl=document.getElementById('syncLabel'),sm=document.getElementById('syncMsg');
  if(!dot)return;
  dot.className='sdot '+mode;
  lbl.textContent=mode==='cloud'?'☁️ Firebase':mode==='local'?'💾 Local':'📴 Offline';
  if(sm)sm.textContent=msg||'';
}
function updateSyncBar(){
  const bar=document.getElementById('syncBar');if(!bar)return;bar.style.display='flex';
  if(storageMode==='firebase')setSyncStatus(isOnline?'cloud':'offline',isOnline?'Online':'Offline — queuing changes');
  else setSyncStatus('local','Local only');
}

// ════════════════════════════════════════════
// SETTINGS HELPERS
// ════════════════════════════════════════════
function getSetting(k,def=''){return LocalDB.getAll('settings').find(s=>s.key===k)?.value??def}
function saveSetting(k,v){
  const all=LocalDB.getAll('settings'),e=all.find(s=>s.key===k);
  if(e){e.value=v;LocalDB.update('settings',e);}else LocalDB.add('settings',{key:k,value:v});
  // also persist to Firebase if active
  if(storageMode==='firebase'){
    const all2=FirebaseDB.getAll('settings'),e2=all2.find(s=>s.key===k);
    if(e2){e2.value=v;FirebaseDB.update('settings',e2);}else FirebaseDB.add('settings',{key:k,value:v});
  }
}

// ════════════════════════════════════════════
// FONT SIZE (accessibility)
// Scales the whole UI by adjusting the body base
// font-size; all em-based styles cascade from it.
// ════════════════════════════════════════════
const FS_MIN=12, FS_MAX=22, FS_DEFAULT=16;
function getFontSize(){
  const v=parseInt(getSetting('app_fontsize',String(FS_DEFAULT)))||FS_DEFAULT;
  return Math.min(FS_MAX,Math.max(FS_MIN,v));
}
function applyFontSize(px){
  document.documentElement.style.setProperty('--app-fs',px+'px');
}
function setFontSize(px){
  px=Math.min(FS_MAX,Math.max(FS_MIN,parseInt(px)||FS_DEFAULT));
  saveSetting('app_fontsize',String(px));
  applyFontSize(px);
  const prev=document.getElementById('fsPreview');
  if(prev){prev.textContent=px+'px';const lbl=prev.nextElementSibling;if(lbl)lbl.textContent=fontSizeLabel(px);}
  if(typeof toast==='function')toast('Font size: '+px+'px','emerald',1500);
}
function adjFontSize(delta){
  setFontSize(getFontSize()+delta*2); // step by 2px
}
function fontSizeLabel(px){
  if(px<=12)return'Extra Small';
  if(px<=14)return'Small';
  if(px<=16)return'Default';
  if(px<=18)return'Large';
  if(px<=20)return'Extra Large';
  return'Maximum';
}

// ════════════════════════════════════════════
// CURRENCIES
// ════════════════════════════════════════════
const CURR={
  PHP:{s:'₱',n:'Philippine Peso',f:'🇵🇭',d:2},USD:{s:'$',n:'US Dollar',f:'🇺🇸',d:2},
  EUR:{s:'€',n:'Euro',f:'🇪🇺',d:2},GBP:{s:'£',n:'British Pound',f:'🇬🇧',d:2},
  JPY:{s:'¥',n:'Japanese Yen',f:'🇯🇵',d:0},KRW:{s:'₩',n:'Korean Won',f:'🇰🇷',d:0},
  SGD:{s:'S$',n:'Singapore Dollar',f:'🇸🇬',d:2},MYR:{s:'RM',n:'Malaysian Ringgit',f:'🇲🇾',d:2},
  THB:{s:'฿',n:'Thai Baht',f:'🇹🇭',d:2},IDR:{s:'Rp',n:'Indonesian Rupiah',f:'🇮🇩',d:0},
  AUD:{s:'A$',n:'Australian Dollar',f:'🇦🇺',d:2},CAD:{s:'C$',n:'Canadian Dollar',f:'🇨🇦',d:2},
  INR:{s:'₹',n:'Indian Rupee',f:'🇮🇳',d:2},AED:{s:'د.إ',n:'UAE Dirham',f:'🇦🇪',d:2},
  SAR:{s:'﷼',n:'Saudi Riyal',f:'🇸🇦',d:2},HKD:{s:'HK$',n:'HK Dollar',f:'🇭🇰',d:2},
  VND:{s:'₫',n:'Vietnamese Dong',f:'🇻🇳',d:0},BRL:{s:'R$',n:'Brazilian Real',f:'🇧🇷',d:2},
  MXN:{s:'Mex$',n:'Mexican Peso',f:'🇲🇽',d:2},NGN:{s:'₦',n:'Nigerian Naira',f:'🇳🇬',d:2},
  ZAR:{s:'R',n:'South African Rand',f:'🇿🇦',d:2},CHF:{s:'Fr',n:'Swiss Franc',f:'🇨🇭',d:2},
  TWD:{s:'NT$',n:'Taiwan Dollar',f:'🇹🇼',d:0},PKR:{s:'₨',n:'Pakistani Rupee',f:'🇵🇰',d:2},
  BDT:{s:'৳',n:'Bangladeshi Taka',f:'🇧🇩',d:2},
};
function fc(a){const c=CURR[cur]||CURR.PHP;const n=parseFloat(a)||0;return c.s+(c.d===0?Math.round(n).toLocaleString():n.toFixed(2));}

// ════════════════════════════════════════════
// GLOBALS
// ════════════════════════════════════════════
let currentUser=null,currentView='dashboard';
let cur='PHP',taxRate=0.12,lowStockThresh=10,printMode='ask';
let cart=[],selUserId=null,pinEntry='',pinFails=0,pinLockUntil=0;
let discAmt=0,discType='none',lastSale=null;
let held=[],selCat='All',sesTimer=null;
let _posSkipScanFocus=false; // POS: suppress scanner auto-focus during in-place search re-render
let rcptFooter='Thank you for your purchase!';

function getMyData(k){
  const all=DB.getAll(k);
  if(!currentUser)return all;
  if(currentUser.role==='admin')return all;
  if(currentUser.branchId){
    // activityLogs and returns use branchId directly
    if(k==='activityLogs'||k==='returns')return all.filter(i=>i.branchId===currentUser.branchId||!i.branchId);
    // sales, voidedSales: filter by branchId
    return all.filter(i=>i.branchId===currentUser.branchId||!i.branchId);
  }
  return all;
}
function logAct(action,details){
  if(!currentUser)return;
  DB.add('activityLogs',{userId:currentUser.id,userName:currentUser.name,userRole:currentUser.role,branchId:currentUser.branchId,action,details,timestamp:new Date().toISOString()});
}

// ════════════════════════════════════════════
// BIR HELPERS
// ════════════════════════════════════════════
function getBIR(){
  const g=k=>getSetting(k);
  return{
    tin:g('bir_tin')||'000-000-000-000',
    name:g('bir_name')||'MLEA Store',
    address:g('bir_address')||'Registered Address',
    accNo:g('bir_accno')||'FP082010-033-2019-0',
    accDate:g('bir_accdate')||'2019-01-01',
    accExp:g('bir_accexp')||'2024-12-31',
    ptu:g('bir_ptu')||'PTU-000000',
    prefix:g('bir_prefix')||'OR',
    serFrom:g('bir_serfrom')||'0000001',
    serTo:g('bir_serto')||'9999999',
    vatType:g('bir_vattype')||'vat',
    docType:g('bir_doctype')||'or',
  };
}
function getNextOR(){
  const all=LocalDB.getAll('settings');
  const e=all.find(s=>s.key==='bir_counter');
  let c=e?parseInt(e.value)||0:0;c++;
  if(e){e.value=c.toString();LocalDB.update('settings',e);}
  else LocalDB.add('settings',{key:'bir_counter',value:c.toString()});
  if(storageMode==='firebase'){
    const fa=FirebaseDB.getAll('settings'),fe=fa.find(s=>s.key==='bir_counter');
    if(fe){fe.value=c.toString();FirebaseDB.update('settings',fe);}
    else FirebaseDB.add('settings',{key:'bir_counter',value:c.toString()});
  }
  const bir=getBIR();const to=parseInt(bir.serTo)||9999999;
  if(c>=to-50)toast('⚠️ OR series almost exhausted! '+(to-c)+' receipts remaining','rose',6000);
  return bir.prefix+'-'+String(c).padStart(7,'0');
}
function updateGAT(amt){
  const all=LocalDB.getAll('settings');const e=all.find(s=>s.key==='bir_gat');
  const cur2=e?parseFloat(e.value)||0:0;const nv=(cur2+amt).toFixed(2);
  if(e){e.value=nv;LocalDB.update('settings',e);}else LocalDB.add('settings',{key:'bir_gat',value:nv});
  if(storageMode==='firebase'){
    const fa=FirebaseDB.getAll('settings'),fe=fa.find(s=>s.key==='bir_gat');
    if(fe){fe.value=nv;FirebaseDB.update('settings',fe);}else FirebaseDB.add('settings',{key:'bir_gat',value:nv});
  }
  return parseFloat(nv);
}
function getGAT(){return parseFloat(getSetting('bir_gat','0'))||0;}

// Computes VAT respecting per-item vatExempt / zeroRated flags
// Pass the cart items array for accurate split; falls back to legacy total-based calc
function computeVAT(total,vatType,rate,items){
  if(vatType!=='vat')return{vatableSales:0,vatAmount:0,vatExempt:total,zeroRated:0,grandTotal:total};
  if(items&&items.length){
    // Split by item-level flags
    let vatableAmt=0,exemptAmt=0,zeroAmt=0;
    items.forEach(i=>{
      const lineNet=i.price*i.quantity;
      if(i.zeroRated)zeroAmt+=lineNet;
      else if(i.vatExempt)exemptAmt+=lineNet;
      else vatableAmt+=lineNet;
    });
    // vatableAmt is VAT-inclusive; back-compute
    const vatableSalesNet=vatableAmt/(1+rate);
    const vatAmount=vatableAmt-vatableSalesNet;
    return{vatableSales:vatableSalesNet,vatAmount,vatExempt:exemptAmt,zeroRated:zeroAmt,grandTotal:vatableSalesNet+vatAmount+exemptAmt+zeroAmt};
  }
  // Legacy fallback (no items passed)
  const vs=total/(1+rate);return{vatableSales:vs,vatAmount:total-vs,vatExempt:0,zeroRated:0,grandTotal:total};
}

