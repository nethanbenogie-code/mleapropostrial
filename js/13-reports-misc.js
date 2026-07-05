/* ============================================================
   MLEA POS v6.0 — 13-reports-misc.js
   Reports, activity log, Firebase setup, backup/export, settings, low-stock, modal, keyboard
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */

// ════════════════════════════════════════════
// REPORTS
// ════════════════════════════════════════════
function renderReports(el){
  const m=new Date().toISOString().substring(0,7);
  const allSales=(currentUser.role==='admin'?DB.getAll('sales'):getMyData('sales')).filter(s=>!s.voided);
  const ms=allSales.filter(s=>s.date.startsWith(m));
  const rev=ms.reduce((a,s)=>a+s.total,0);
  const vat=ms.reduce((a,s)=>a+(s.tax||0),0);
  const vs=ms.reduce((a,s)=>a+(s.vatableSales||0),0);
  const cost=ms.reduce((a,s)=>a+(s.items||[]).reduce((c,it)=>c+(it.cost||0)*(it.quantity||0),0),0);
  const sc=ms.filter(s=>s.discountType==='sc').reduce((a,s)=>a+(s.discountAmount||0),0);
  const pwd=ms.filter(s=>s.discountType==='pwd').reduce((a,s)=>a+(s.discountAmount||0),0);
  const promo=ms.filter(s=>s.discountType==='promo').reduce((a,s)=>a+(s.discountAmount||0),0);
  const voidedM=DB.getAll('sales').filter(s=>s.date.startsWith(m)&&s.voided);
  const retM=DB.getAll('returns').filter(r=>r.date&&r.date.startsWith(m));
  const refunds=retM.reduce((a,r)=>a+(r.refundAmount||0),0);
  const cashSales=ms.filter(s=>s.paymentMethod==='cash');
  const cardSales=ms.filter(s=>s.paymentMethod==='card');
  const splitSales=ms.filter(s=>s.paymentMethod==='split');
  const vatDue=vat-refunds*taxRate;
  // Expenses for the month
  const monthExp=getMyData('expenses').filter(e=>(e.date||'').startsWith(m));
  const expTotal=monthExp.reduce((a,e)=>a+(e.amount||0),0);
  const grossProfit=rev-cost;
  const netProfit=grossProfit-expTotal;
  el.innerHTML=`<h4>Reports — ${new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})}</h4>
    <div class="card" style="border-left:3px solid var(--gold)">
      <h5>Revenue</h5>
      <div class="metrics">
        <div class="met"><div class="met-v">${fc(rev)}</div><div class="met-l">Gross Revenue</div></div>
        <div class="met"><div class="met-v" style="color:var(--rose)">${fc(vat)}</div><div class="met-l">VAT Collected</div></div>
      </div>
      <div class="metrics" style="margin-top:8px">
        <div class="met"><div class="met-v">${fc(vs)}</div><div class="met-l">VATable Sales</div></div>
        <div class="met"><div class="met-v" style="color:var(--emerald)">${fc(grossProfit)}</div><div class="met-l">Gross Profit</div></div>
      </div>
    </div>
    <div class="card" style="border-left:3px solid var(--rose)">
      <h5>💸 Expenses & Net Profit</h5>
      <div class="metrics">
        <div class="met"><div class="met-v" style="color:var(--rose)">${fc(expTotal)}</div><div class="met-l">Expenses (${monthExp.length})</div></div>
        <div class="met"><div class="met-v" style="color:${netProfit>=0?'var(--emerald)':'var(--rose)'}">${fc(netProfit)}</div><div class="met-l">Net Profit</div></div>
      </div>
      <p style="font-size:.72em;color:var(--text3);margin-top:6px">Net Profit = Gross Profit − Expenses. <span onclick="sw('expenses')" style="color:var(--blue);cursor:pointer;text-decoration:underline">Manage expenses →</span></p>
    </div>
    <div class="card">
      <h5>🏛️ BIR Tax Summary</h5>
      <div class="metrics">
        <div class="met"><div class="met-v" style="color:var(--blue)">${fc(sc)}</div><div class="met-l">SC Discounts</div></div>
        <div class="met"><div class="met-v" style="color:var(--blue)">${fc(pwd)}</div><div class="met-l">PWD Discounts</div></div>
        <div class="met"><div class="met-v" style="color:var(--rose)">${fc(refunds)}</div><div class="met-l">Refunds</div></div>
        <div class="met"><div class="met-v" style="color:var(--gold)">${fc(vatDue)}</div><div class="met-l">VAT Due (Est.)</div></div>
      </div>
    </div>
    <div class="card">
      <h5>Transactions</h5>
      <div class="metrics">
        <div class="met"><div class="met-v">${ms.length}</div><div class="met-l">Total</div></div>
        <div class="met"><div class="met-v">${ms.length?fc(rev/ms.length):'—'}</div><div class="met-l">Avg. Sale</div></div>
        <div class="met"><div class="met-v" style="color:var(--emerald)">${cashSales.length}</div><div class="met-l">💵 Cash</div></div>
        <div class="met"><div class="met-v" style="color:var(--blue)">${cardSales.length}</div><div class="met-l">💳 Card</div></div>
      </div>
      <div class="metrics" style="margin-top:8px">
        <div class="met"><div class="met-v" style="color:var(--purple)">${splitSales.length}</div><div class="met-l">⚡ Split</div></div>
        <div class="met"><div class="met-v" style="color:var(--rose)">${voidedM.length}</div><div class="met-l">🚫 Voided</div></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
      <button class="btn bp" onclick="exportCSV('sales')">📥 Sales CSV</button>
      <button class="btn bs" onclick="exportCSV('inventory')">📥 Inventory CSV</button>
      <button class="btn bw" onclick="exportExpensesCSV()">💸 Expenses CSV</button>
      <button class="btn bw" onclick="exportBIRReport()">🏛️ BIR Report CSV</button>
      <button class="btn bd" onclick="downloadBackup()">💾 Full Backup</button>
    </div>`;
}

// ════════════════════════════════════════════
// ACTIVITY LOG
// ════════════════════════════════════════════
function renderActLog(el){
  const logs=getMyData('activityLogs').slice(-100).reverse();
  el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <h4 style="margin:0">📝 Activity Log</h4><span class="bir-badge">Audit Trail</span>
  </div>
  <div class="card" style="padding:0;overflow:hidden">
    ${!logs.length?'<div class="empty-st"><div class="ei">📝</div><p>No activity yet</p></div>':
    logs.map(l=>`<div class="log-item">
      <div class="log-act">${l.action} — <span style="font-family:var(--fm);font-size:.88em;color:var(--text2)">${l.details||''}</span></div>
      <div class="log-meta">${l.userName||'?'} (${l.userRole||'?'}) · ${new Date(l.timestamp).toLocaleString('en-PH')}</div>
    </div>`).join('')}
  </div>`;
}

// ════════════════════════════════════════════
// FIREBASE SETUP
// ════════════════════════════════════════════
function renderFBSetup(el){
  const savedConfig=getSetting('firebase_config','');
  el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <h4 style="margin:0">☁️ Firebase Setup</h4>
    <span class="${storageMode==='firebase'?'fb-on':'fb-off'}">${storageMode==='firebase'?'☁️ Connected':'💾 Local Mode'}</span>
  </div>
  <div class="card" style="border:1px solid rgba(111,163,239,.3)">
    <p style="font-size:.82em;color:var(--text2);line-height:1.7;margin-bottom:12px">Firebase enables real-time sync across all devices. Your data is always mirrored locally too — the system works fully offline and syncs when reconnected.</p>
    <div style="font-size:.78em;color:var(--text2);line-height:1.9">
      1. Go to <strong style="color:var(--text)">console.firebase.google.com</strong><br>
      2. Create project → Firestore Database → Start in test mode<br>
      3. Project Settings → Your apps → Add web app → Copy config JSON<br>
      4. Paste config below and click Connect
    </div>
  </div>
  <div class="card">
    <h5>Firebase Config (JSON)</h5>
    <textarea id="fbConfig" rows="8" placeholder='{"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}'>${savedConfig}</textarea>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn bd" onclick="disconnectFB()">💾 Use Local</button>
      <button class="btn bp" onclick="connectFB()">☁️ Connect Firebase</button>
    </div>
  </div>
  <div class="card">
    <h5>📤 Migrate Local → Firebase</h5>
    <p style="font-size:.78em;color:var(--text2);margin-bottom:10px">After connecting, push all existing local data up to Firebase.</p>
    <button class="btn bs bbl" onclick="migrateToFB()">📤 Migrate All Local Data</button>
  </div>
  <div class="card" style="border:1px solid rgba(45,212,160,.2)">
    <h5 style="color:var(--emerald)">Current Mode</h5>
    <p style="font-size:.82em;color:${storageMode==='firebase'?'var(--emerald)':'var(--blue)'}">${storageMode==='firebase'?'☁️ Firebase Firestore — real-time cloud sync active':'💾 Local Storage — data lives on this device only'}</p>
    ${storageMode==='firebase'?`<p style="font-size:.72em;color:var(--text2);margin-top:6px">Network: ${isOnline?'✅ Online':'❌ Offline'} · Pending: ${offQ.length} operations</p>`:''}
  </div>`;
}
async function connectFB(){
  const input=(document.getElementById('fbConfig')?.value||'').trim();
  if(!input){toast('Paste your Firebase config JSON first','rose');return;}
  let config;
  try{config=JSON.parse(input);}catch(e){toast('Invalid JSON — check your config: '+e.message,'rose');return;}
  if(!config.apiKey||!config.projectId){toast('Config missing apiKey or projectId','rose');return;}
  toast('Connecting to Firebase…','gold',8000);
  saveSetting('firebase_config',input);
  const ok=await FirebaseDB.init(config);
  if(ok){storageMode='firebase';saveSetting('storageMode','firebase');updateSyncBar();renderSidebar();toast('Firebase connected ✓','emerald');sw('fbSetup');}
  else toast('Firebase connection failed. Check config and Firestore rules.','rose');
}
async function disconnectFB(){
  const ok=await confirm2('Switch to local storage? Firebase data stays intact — local copy will be used going forward.','💾');
  if(!ok)return;
  storageMode='local';saveSetting('storageMode','local');updateSyncBar();renderSidebar();toast('Switched to Local Storage','gold');sw('fbSetup');
}
async function migrateToFB(){
  if(storageMode!=='firebase'){toast('Connect Firebase first','rose');return;}
  const ok=await confirm2('Push all local data to Firebase? Existing Firebase records will be overwritten.','📤');
  if(!ok)return;
  toast('Migrating…','gold',15000);let count=0;
  for(const store of STORES){
    const items=LocalDB.getAll(store);
    for(const item of items){
      const did=store+'_'+item.id;item._did=did;
      await FirebaseDB._write(store,did,item);count++;
    }
  }
  toast('Migration complete! '+count+' records pushed ✓','emerald');
}

// ════════════════════════════════════════════
// BACKUP & EXPORT
// ════════════════════════════════════════════
function renderBackup(el){
  el.innerHTML=`<div class="card" style="border-left:3px solid var(--gold)">
    <h4>Backup & Export</h4>
    <p style="color:var(--text2);font-size:.8em">Protect your data with regular backups. Last backup: ${getSetting('last_backup_ts','0')!=='0'?new Date(parseInt(getSetting('last_backup_ts'))).toLocaleDateString():'Never'}</p>
  </div>
  <div class="card">
    <h5>📥 Export Options</h5>
    <button class="btn bp bbl" onclick="downloadBackup()">📦 Full System Backup (JSON)</button>
    <button class="btn bs bbl" onclick="exportCSV('sales')">📊 Sales Report CSV</button>
    <button class="btn bw bbl" onclick="exportCSV('inventory')">📋 Inventory CSV</button>
    <button class="btn bb bbl" onclick="exportBIRReport()">🏛️ BIR Monthly Report CSV</button>
  </div>
  <div class="card" style="border:1px solid rgba(240,101,119,.25)">
    <h5 style="color:var(--rose)">⚠ Restore from Backup</h5>
    <p style="font-size:.78em;color:var(--text2);margin-bottom:10px;line-height:1.5">This will replace ALL current data with the backup file. Make sure to export a current backup first.</p>
    <input type="file" id="restoreFile" accept=".json" style="margin-bottom:10px">
    <button class="btn bd bbl" onclick="restoreBackup()">🔄 Restore Data from File</button>
  </div>`;
}
function downloadBackup(){
  const data={};STORES.forEach(s=>data[s]=LocalDB.getAll(s));
  data.backupDate=new Date().toISOString();data.bir=getBIR();data.gat=getGAT();data.version='5.0';
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`mlea_backup_v5_${new Date().toISOString().split('T')[0]}.json`;a.click();
  saveSetting('last_backup_ts',String(Date.now()));
  toast('Backup downloaded ✓','emerald');
}
async function restoreBackup(){
  const file=document.getElementById('restoreFile').files[0];
  if(!file){toast('Select a backup file','rose');return;}
  const ok=await confirm2('This will REPLACE all current data with the backup. Make sure you have exported a current backup first.','⚠️',true);
  if(!ok)return;
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      const d=JSON.parse(e.target.result);
      if(!d.version)throw new Error('Invalid backup format');
      STORES.forEach(s=>{if(d[s])LocalDB.set(s,d[s]);});
      toast('Data restored ✓ Reloading…','emerald');
      setTimeout(()=>location.reload(),1500);
    }catch(err){toast('Invalid backup file: '+err.message,'rose');}
  };
  reader.readAsText(file);
}
function exportCSV(type){
  let csv='';const d=new Date().toISOString().split('T')[0];
  if(type==='sales'){
    csv='OR No.,Date,Total,VAT,VATable,Payment,Cash Tendered,Change,Cashier,Branch,Disc Type,Disc Amount\n';
    getMyData('sales').filter(s=>!s.voided).forEach(s=>csv+=`${s.orNumber||s.id},${s.date},${s.total},${s.tax||0},${s.vatableSales||0},${s.paymentMethod},${s.cashTendered||0},${s.changeGiven||0},"${s.cashierName||''}","${s.branchName||''}",${s.discountType||'none'},${s.discountAmount||0}\n`);
  }else{
    csv='SKU,Name,Price,Cost,Stock,Unit,Category,Barcode,VAT Status,Branch\n';
    getMyData('products').forEach(p=>{const b=p.branchId?DB.getById('branches',p.branchId):null;csv+=`${p.sku},"${p.name}",${p.price},${p.cost||0},${p.stock},${p.unit||'pcs'},"${p.category||''}",${p.barcode||''},${p.vatExempt?'VAT-Exempt':p.zeroRated?'Zero-Rated':'VAT'},"${b?b.name:'Global'}"\n`;});
  }
  const blob=new Blob([csv],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${type}_${d}.csv`;a.click();
  toast(type+' CSV downloaded ✓','emerald');
}
function exportBIRReport(){
  const m=new Date().toISOString().substring(0,7);const bir=getBIR();
  const ms=getMyData('sales').filter(s=>s.date.startsWith(m)&&!s.voided);
  let csv=`BIR SALES JOURNAL\n"Business: ${bir.name}"\n"TIN: ${bir.tin}"\n"Period: ${m}"\n"PTU: ${bir.ptu}"\n\n`;
  csv+='OR/SI No.,Date,Cashier,Branch,VATable Sales,VAT Amount,VAT-Exempt,Zero-Rated,Total,Disc Type,Disc Amount,Payment,Cash Tendered,Change\n';
  ms.forEach(s=>csv+=`${s.orNumber||s.id},${s.date},"${s.cashierName||''}","${s.branchName||''}",${(s.vatableSales||0).toFixed(2)},${(s.tax||0).toFixed(2)},${(s.vatExemptSales||0).toFixed(2)},${(s.zeroRatedSales||0).toFixed(2)},${s.total.toFixed(2)},${s.discountType||'none'},${(s.discountAmount||0).toFixed(2)},${s.paymentMethod},${s.cashTendered||0},${s.changeGiven||0}\n`);
  csv+=`\nVoided Transactions\nOR/SI No.,Date,Amount,Voided By,Reason\n`;
  getMyData('sales').filter(s=>s.date.startsWith(m)&&s.voided).forEach(s=>csv+=`${s.orNumber||s.id},${s.date},${s.total.toFixed(2)},"${s.voidedBy||''}","${s.voidReason||''}"\n`);
  const blob=new Blob([csv],{type:'text/csv'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`BIR_Report_${m}.csv`;a.click();
  toast('BIR report downloaded ✓','emerald');
}

// ════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════
function renderSettings(el){
  el.innerHTML=`<h4>Settings</h4>
    <div class="card">
      <h5>💱 Currency</h5>
      <input type="text" id="curSearch" placeholder="🔍 Search currency…" oninput="filterCur(this.value)" style="margin-bottom:8px">
      <select id="curSel" size="5" onchange="cur=this.value;saveSetting('currency',this.value);sw('settings')" style="height:130px;border-radius:var(--r2);padding:4px">
        ${Object.entries(CURR).map(([c,v])=>`<option value="${c}" ${cur===c?'selected':''}>${v.f} ${v.n} (${v.s})</option>`).join('')}
      </select>
      <p style="font-size:.72em;color:var(--gold);margin-top:6px;font-weight:600">Selected: ${CURR[cur]?.f||'?'} ${CURR[cur]?.n||cur} (${CURR[cur]?.s||'?'})</p>
    </div>
    <div class="card">
      <h5>💰 VAT / Tax Rate (%)</h5>
      <div style="display:flex;gap:10px;align-items:center">
        <input type="number" id="taxInp" value="${taxRate*100}" step="0.1" style="margin-bottom:0">
        <button class="btn bp bsm" onclick="taxRate=(parseFloat(document.getElementById('taxInp').value)||0)/100;saveSetting('taxRate',taxRate.toString());toast('Tax rate saved ✓','emerald')">Save</button>
      </div>
    </div>
    <div class="card">
      <h5>📦 Low Stock Threshold</h5>
      <div style="display:flex;gap:10px;align-items:center">
        <input type="number" id="lsInp" value="${lowStockThresh}" min="1" max="999" style="margin-bottom:0">
        <button class="btn bp bsm" onclick="lowStockThresh=parseInt(document.getElementById('lsInp').value)||10;saveSetting('lowStockThresh',lowStockThresh.toString());toast('Saved ✓','emerald')">Save</button>
      </div>
    </div>
    <div class="card">
      <h5>🔠 Font Size</h5>
      <p style="font-size:.75em;color:var(--text2);margin-bottom:10px">Adjust the text size across the whole app for easier reading.</p>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn bw bsm" onclick="adjFontSize(-1)" style="font-size:1.1em;min-width:44px">A−</button>
        <div style="flex:1;text-align:center">
          <div id="fsPreview" style="font-family:var(--ff);font-weight:700;color:var(--gold)">${getFontSize()}px</div>
          <div style="font-size:.68em;color:var(--text3)">${fontSizeLabel(getFontSize())}</div>
        </div>
        <button class="btn bw bsm" onclick="adjFontSize(1)" style="font-size:1.1em;min-width:44px">A+</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:10px">
        <button class="btn bd bxs" style="flex:1" onclick="setFontSize(14)">Small</button>
        <button class="btn bd bxs" style="flex:1" onclick="setFontSize(16)">Default</button>
        <button class="btn bd bxs" style="flex:1" onclick="setFontSize(18)">Large</button>
        <button class="btn bd bxs" style="flex:1" onclick="setFontSize(20)">XL</button>
      </div>
    </div>
    <div class="card">
      <h5>⏱ Session Timeout (minutes)</h5>
      <div style="display:flex;gap:10px;align-items:center">
        <input type="number" id="sesInp" value="${getSetting('ses_timeout','30')}" min="5" max="480" style="margin-bottom:0">
        <button class="btn bp bsm" onclick="saveSetting('ses_timeout',document.getElementById('sesInp').value);resetSesTimer();toast('Saved ✓','emerald')">Save</button>
      </div>
      <p style="font-size:.72em;color:var(--text2);margin-top:4px">Auto-logout after inactivity · PIN lockout: 5 fails = 60s lock</p>
    </div>
    <div class="card">
      <h5>🧾 Receipt Footer</h5>
      <input type="text" id="ftrInp" value="${rcptFooter}" placeholder="e.g. Thank you! Visit us again.">
      <button class="btn bp bsm" onclick="rcptFooter=document.getElementById('ftrInp').value;saveSetting('rcptFooter',rcptFooter);toast('Saved ✓','emerald')">Save</button>
    </div>
    <div class="card">
      <h5>🖨 Default Print Mode</h5>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px">
        ${[['ask','❓ Ask Every Time','gold'],['thermal','🧾 Auto Thermal','emerald'],['a4','📄 Auto A4','blue'],['none','✕ No Print','rose']].map(([m,l,c])=>`
        <button onclick="printMode='${m}';saveSetting('printMode','${m}');sw('settings')" style="padding:12px 8px;border-radius:var(--r2);border:2px solid ${printMode===m?'var(--'+c+')':'var(--border)'};background:${printMode===m?'var(--'+c+'-soft)':'var(--bg-glass)'};color:${printMode===m?'var(--'+c+')':'var(--text2)'};cursor:pointer;font-family:var(--ff);font-size:.8em;font-weight:700">${l}</button>`).join('')}
      </div>
      <p style="font-size:.7em;color:var(--gold);font-weight:600">Current: ${printMode==='ask'?'❓ Ask':printMode==='thermal'?'🧾 Thermal':printMode==='a4'?'📄 A4':'✕ No Print'}</p>
    </div>
    <div class="card" style="border:1px solid rgba(212,168,83,.3)">
      <h5 style="color:var(--gold)">Quick Links</h5>
      <button class="btn bp bbl" onclick="sw('birSetup')">🏛️ BIR Setup →</button>
      <button class="btn bs bbl" onclick="sw('fbSetup')" style="margin-top:0">☁️ Firebase Setup →</button>
    </div>`;
}
function filterCur(q){
  const sel=document.getElementById('curSel');if(!sel)return;
  sel.innerHTML=Object.entries(CURR).filter(([c,v])=>v.n.toLowerCase().includes(q.toLowerCase())||c.toLowerCase().includes(q.toLowerCase())).map(([c,v])=>`<option value="${c}" ${cur===c?'selected':''}>${v.f} ${v.n} (${v.s})</option>`).join('');
}

// ════════════════════════════════════════════
// LOW STOCK TOAST
// ════════════════════════════════════════════
function getLowStock(){return getMyData('products').filter(p=>p.active&&p.stock<=lowStockThresh);}
function showLowStockToast(){
  const low=getLowStock();if(!low.length)return;
  const ex=document.getElementById('lstoast');if(ex)ex.remove();
  const t=document.createElement('div');t.id='lstoast';
  t.style.cssText='position:fixed;bottom:48px;left:50%;transform:translateX(-50%);background:var(--bg-elevated);border:1px solid rgba(240,101,119,.4);border-radius:var(--r2);padding:14px 18px;z-index:9999;display:flex;align-items:center;gap:12px;box-shadow:0 8px 30px rgba(0,0,0,.5);animation:slideUp .4s cubic-bezier(.22,1,.36,1);max-width:320px;width:90%';
  t.innerHTML=`<span style="font-size:1.4em">⚠️</span>
    <div style="flex:1"><div style="font-family:var(--ff);font-weight:700;font-size:.88em;color:var(--rose)">${low.length} Low Stock Item${low.length>1?'s':''}</div>
    <div style="font-size:.72em;color:var(--text2);margin-top:2px">${low.slice(0,2).map(p=>p.name+' ('+p.stock+')').join(', ')}${low.length>2?' +more':''}</div></div>
    <button onclick="this.parentElement.remove();sw('${currentUser.role==='admin'?'allProducts':'inventory'}')" style="background:var(--rose-soft);border:1px solid rgba(240,101,119,.3);color:var(--rose);border-radius:var(--r1);padding:6px 10px;cursor:pointer;font-size:.7em;font-weight:700;white-space:nowrap">View →</button>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:1em;padding:2px 4px">✕</button>`;
  document.body.appendChild(t);
  setTimeout(()=>{if(t.parentElement){t.style.opacity='0';t.style.transition='opacity .4s';setTimeout(()=>t.remove(),400);}},7000);
}

// ════════════════════════════════════════════
// MODAL HELPERS
// ════════════════════════════════════════════
function openModal(html){
  document.getElementById('modalBox').innerHTML=html;
  document.getElementById('modal').classList.add('on');
}
function closeModal(){document.getElementById('modal').classList.remove('on');}
document.getElementById('modal').addEventListener('click',function(e){if(e.target===this)closeModal();});

// ════════════════════════════════════════════
// KEYBOARD SHORTCUTS
// ════════════════════════════════════════════
document.addEventListener('keydown',function(e){
  const loginVisible=document.getElementById('loginScreen').style.display!=='none';
  if(loginVisible&&!chkLock()){
    if(e.key>='0'&&e.key<='9')ePin(e.key);
    else if(e.key==='Enter')subPin();
    else if(e.key==='Backspace'){pinEntry=pinEntry.slice(0,-1);updPinDots();}
  }
  if(e.key==='Escape')closeModal();
});

document.addEventListener('keydown',function(e){
  const loginVisible=document.getElementById('loginScreen').style.display!=='none';
  if(loginVisible&&!chkLock()){
    if(e.key>='0'&&e.key<='9')ePin(e.key);
    else if(e.key==='Enter')subPin();
    else if(e.key==='Backspace'){pinEntry=pinEntry.slice(0,-1);updPinDots();}
  }
  if(e.key==='Escape')closeModal();
  // ── Developer backdoor sequence detector ──
  _devSeqDetect(e.key);
});

