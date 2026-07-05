/* ============================================================
   MLEA POS v6.0 — 12-bir-readings.js
   X/Z readings, BIR setup
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */

// ════════════════════════════════════════════
// BIR X & Z READING
// ════════════════════════════════════════════
function getDayData(date){
  date=date||new Date().toISOString().split('T')[0];
  const sales=DB.getAll('sales').filter(s=>s.date===date&&!s.voided);
  const voided=DB.getAll('sales').filter(s=>s.date===date&&s.voided);
  return{
    sales,voided,
    total:sales.reduce((a,s)=>a+s.total,0),
    vat:sales.reduce((a,s)=>a+(s.tax||0),0),
    vs:sales.reduce((a,s)=>a+(s.vatableSales||0),0),
    ve:sales.reduce((a,s)=>a+(s.vatExemptSales||0),0),
    cash:sales.filter(s=>s.paymentMethod==='cash').reduce((a,s)=>a+s.total,0),
    card:sales.filter(s=>s.paymentMethod==='card').reduce((a,s)=>a+s.total,0),
    split:sales.filter(s=>s.paymentMethod==='split').reduce((a,s)=>a+s.total,0),
    sc:sales.filter(s=>s.discountType==='sc').reduce((a,s)=>a+(s.discountAmount||0),0),
    pwd:sales.filter(s=>s.discountType==='pwd').reduce((a,s)=>a+(s.discountAmount||0),0),
    promo:sales.filter(s=>s.discountType==='promo').reduce((a,s)=>a+(s.discountAmount||0),0),
  };
}
function renderXR(el){
  const today=new Date().toISOString().split('T')[0];const d=getDayData(today);const bir=getBIR();const gat=getGAT();
  el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <h4 style="margin:0">📑 X-Reading</h4><span class="bir-badge">Non-Reset</span>
  </div>
  <div class="card" style="border:1px solid rgba(212,168,83,.3)">
    <p style="font-size:.75em;color:var(--text2);margin-bottom:12px">Snapshot as of this moment. Does NOT reset any counters.</p>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:.8em;color:var(--text2)">Store</span><span style="font-size:.8em;font-weight:600">${bir.name}</span></div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:.8em;color:var(--text2)">TIN</span><span style="font-size:.8em;font-family:var(--fm)">${bir.tin}</span></div>
    <div style="display:flex;justify-content:space-between"><span style="font-size:.8em;color:var(--text2)">Date / Time</span><span style="font-size:.8em">${today} ${new Date().toLocaleTimeString('en-PH')}</span></div>
  </div>
  <div class="reading-card">
    <div class="rrow"><span>Transactions Today</span><span>${d.sales.length}</span></div>
    <div class="rrow"><span>Voided Today</span><span style="color:var(--rose)">${d.voided.length}</span></div>
    <div class="rrow"><span>VATable Sales</span><span style="font-family:var(--fm)">${fc(d.vs)}</span></div>
    <div class="rrow"><span>VAT Amount (12%)</span><span style="font-family:var(--fm)">${fc(d.vat)}</span></div>
    <div class="rrow"><span>VAT-Exempt Sales</span><span style="font-family:var(--fm)">${fc(d.ve)}</span></div>
    <div class="rrow tot"><span>GROSS TOTAL</span><span>${fc(d.total)}</span></div>
  </div>
  <div class="reading-card">
    <div class="rrow"><span>👴 SC Discount</span><span>${fc(d.sc)}</span></div>
    <div class="rrow"><span>♿ PWD Discount</span><span>${fc(d.pwd)}</span></div>
    <div class="rrow"><span>🏷️ Promo Discount</span><span>${fc(d.promo)}</span></div>
    <div class="rrow tot"><span>TOTAL DISCOUNTS</span><span>${fc(d.sc+d.pwd+d.promo)}</span></div>
  </div>
  <div class="reading-card">
    <div class="rrow"><span>💵 Cash</span><span>${fc(d.cash)}</span></div>
    <div class="rrow"><span>💳 Card</span><span>${fc(d.card)}</span></div>
    <div class="rrow"><span>⚡ Split</span><span>${fc(d.split)}</span></div>
    <div class="rrow" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      <span style="color:var(--gold)">Grand Accum. Total (GAT)</span>
      <span style="color:var(--gold);font-weight:700;font-family:var(--fm)">${fc(gat)}</span>
    </div>
  </div>
  <button class="btn bp bbl" onclick="printXZ('x')">🖨 Print X-Reading</button>`;
}
function renderZR(el){
  const today=new Date().toISOString().split('T')[0];const d=getDayData(today);const bir=getBIR();const gat=getGAT();
  const done=localStorage.getItem('mlea_last_z')===today;
  const firstOR=d.sales.length?d.sales[0].orNumber:'—';const lastOR=d.sales.length?d.sales[d.sales.length-1].orNumber:'—';
  el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <h4 style="margin:0">📋 Z-Reading</h4>
    <span class="bir-badge" style="${done?'background:rgba(240,101,119,.15);border-color:rgba(240,101,119,.4);color:var(--rose)':''}">End of Day</span>
  </div>
  ${done?'<div class="card" style="border:1px solid rgba(240,101,119,.3)"><p style="font-size:.82em;color:var(--rose)">⚠️ Z-Reading already performed today. Only proceed if closing a second shift.</p></div>':''}
  <div class="reading-card">
    <div class="rrow"><span>Date</span><span>${today}</span></div>
    <div class="rrow"><span>Beginning OR</span><span style="font-family:var(--fm);font-size:.8em">${firstOR}</span></div>
    <div class="rrow"><span>Ending OR</span><span style="font-family:var(--fm);font-size:.8em">${lastOR}</span></div>
    <div class="rrow"><span>Transactions</span><span>${d.sales.length}</span></div>
    <div class="rrow"><span>Voided</span><span style="color:var(--rose)">${d.voided.length}</span></div>
    <div class="rrow"><span>VATable Sales</span><span>${fc(d.vs)}</span></div>
    <div class="rrow"><span>VAT Amount (12%)</span><span>${fc(d.vat)}</span></div>
    <div class="rrow"><span>Total Discounts</span><span>${fc(d.sc+d.pwd+d.promo)}</span></div>
    <div class="rrow tot"><span>GROSS TOTAL</span><span>${fc(d.total)}</span></div>
    <div class="rrow" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      <span style="color:var(--gold)">Grand Accum. Total (GAT)</span>
      <span style="color:var(--gold);font-weight:700;font-family:var(--fm)">${fc(gat)}</span>
    </div>
  </div>
  <button class="btn bp bbl" onclick="doZReading()">📋 Perform Z-Reading & Print</button>
  <p style="font-size:.7em;color:var(--text2);text-align:center;margin-top:8px">This action is permanent and logged for BIR audit.</p>`;
}
async function doZReading(){
  const today=new Date().toISOString().split('T')[0];
  const ok=await confirm2('Perform Z-Reading for '+today+'?\nThis marks the end of your business day and is logged permanently.','📋');
  if(!ok)return;
  localStorage.setItem('mlea_last_z',today);
  logAct('Z-Reading','EOD: '+today+' | GAT: '+fc(getGAT()));
  printXZ('z');toast('Z-Reading complete ✓','emerald');
}
function printXZ(type){
  const today=new Date().toISOString().split('T')[0];const d=getDayData(today);const bir=getBIR();const gat=getGAT();
  const firstOR=d.sales.length?d.sales[0].orNumber:'—';const lastOR=d.sales.length?d.sales[d.sales.length-1].orNumber:'—';
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @page{margin:8mm;size:80mm auto}*{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Courier New',Courier,monospace;font-size:10px;width:76mm;color:#000;background:#fff}
    .c{text-align:center}.b{font-weight:bold}.dv{border:none;border-top:1px dashed #000;margin:4px 0}
    .rw{display:flex;justify-content:space-between;margin:2px 0}
  </style></head><body>
  <div class="c b" style="font-size:13px">${bir.name}</div>
  <div class="c">${bir.address}</div><div class="c">TIN: ${bir.tin}</div>
  <hr class="dv">
  <div class="c b" style="font-size:12px">${type==='x'?'X - READING REPORT':'Z - READING REPORT'}</div>
  <div class="c">${type==='x'?'(NON-RESET)':'(END OF DAY)'}</div>
  <div class="c">${today} ${new Date().toLocaleTimeString('en-PH')}</div>
  <hr class="dv">
  ${type==='z'?`<div class="rw"><span>Beginning OR</span><span>${firstOR}</span></div><div class="rw"><span>Ending OR</span><span>${lastOR}</span></div>`:''}
  <div class="rw"><span>Transactions</span><span>${d.sales.length}</span></div>
  <div class="rw"><span>Voided</span><span>${d.voided.length}</span></div>
  <hr class="dv">
  <div class="b">SALES</div>
  <div class="rw"><span>VATable Sales</span><span>${fc(d.vs)}</span></div>
  <div class="rw"><span>VAT Amount (12%)</span><span>${fc(d.vat)}</span></div>
  <div class="rw"><span>VAT-Exempt</span><span>${fc(d.ve)}</span></div>
  <hr class="dv"><div class="rw b"><span>GROSS TOTAL</span><span>${fc(d.total)}</span></div>
  <hr class="dv">
  <div class="b">DISCOUNTS</div>
  <div class="rw"><span>SC</span><span>${fc(d.sc)}</span></div>
  <div class="rw"><span>PWD</span><span>${fc(d.pwd)}</span></div>
  <div class="rw"><span>Promo</span><span>${fc(d.promo)}</span></div>
  <hr class="dv">
  <div class="b">PAYMENTS</div>
  <div class="rw"><span>Cash</span><span>${fc(d.cash)}</span></div>
  <div class="rw"><span>Card</span><span>${fc(d.card)}</span></div>
  <div class="rw"><span>Split</span><span>${fc(d.split)}</span></div>
  <hr class="dv">
  <div class="rw b"><span>GRAND ACCUM. TOTAL</span><span>${fc(gat)}</span></div>
  <hr class="dv">
  <div class="c" style="font-size:8px;margin-top:4px">PTU: ${bir.ptu}<br>Accred: ${bir.accNo}<br>MLEA POS v6.0</div>
  <div style="height:8mm"></div></body></html>`;
  const frame=document.getElementById('printFrame');const doc=frame.contentDocument||frame.contentWindow.document;doc.open();doc.write(html);doc.close();
  setTimeout(()=>{frame.contentWindow.focus();frame.contentWindow.print();},350);
}

// ════════════════════════════════════════════
// BIR SETUP
// ════════════════════════════════════════════
function renderBIRSetup(el){
  if(currentUser.role!=='admin'){el.innerHTML='<div class="empty-st"><div class="ei">🔒</div><p>Admin only</p></div>';return;}
  const bir=getBIR();
  el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <h4 style="margin:0">🏛️ BIR Setup</h4><span class="bir-badge">Compliance</span>
  </div>
  <div class="card">
    <h5>🏢 Business Registration</h5>
    <label class="inp-label">Registered Business Name</label><input type="text" id="birN" value="${bir.name}" placeholder="e.g. MLEA Trading Corporation">
    <label class="inp-label">Registered Address</label><input type="text" id="birA" value="${bir.address}" placeholder="e.g. 123 Main St, Cebu City">
    <label class="inp-label">TIN (Tax Identification Number)</label><input type="text" id="birT" value="${bir.tin}" placeholder="000-000-000-000">
  </div>
  <div class="card">
    <h5>📋 BIR Accreditation</h5>
    <label class="inp-label">Accreditation Number</label><input type="text" id="birAn" value="${bir.accNo}" placeholder="e.g. FP082010-033-2019-0">
    <label class="inp-label">Date Issued (YYYY-MM-DD)</label><input type="text" id="birAd" value="${bir.accDate}" placeholder="2019-01-01">
    <label class="inp-label">Expiry Date (YYYY-MM-DD)</label><input type="text" id="birAe" value="${bir.accExp}" placeholder="2024-12-31">
    <label class="inp-label">PTU (Permit to Use) Number</label><input type="text" id="birP" value="${bir.ptu}" placeholder="e.g. PTU-123456">
  </div>
  <div class="card">
    <h5>🧾 OR/SI Series</h5>
    <label class="inp-label">Document Type</label>
    <select id="birDt"><option value="or" ${bir.docType==='or'?'selected':''}>Official Receipt (OR) — for Services</option><option value="si" ${bir.docType==='si'?'selected':''}>Sales Invoice (SI) — for Goods</option></select>
    <label class="inp-label">Series Prefix</label><input type="text" id="birPfx" value="${bir.prefix}" placeholder="OR">
    <label class="inp-label">Series From</label><input type="text" id="birSf" value="${bir.serFrom}" placeholder="0000001">
    <label class="inp-label">Series To</label><input type="text" id="birSt" value="${bir.serTo}" placeholder="9999999">
  </div>
  <div class="card">
    <h5>💰 VAT Classification</h5>
    <select id="birVt"><option value="vat" ${bir.vatType==='vat'?'selected':''}>VAT-Registered (12%)</option><option value="nonvat" ${bir.vatType==='nonvat'?'selected':''}>Non-VAT</option></select>
  </div>
  <div class="card">
    <h5>📊 Grand Accumulated Total (GAT)</h5>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
      <span style="font-size:.82em;color:var(--text2)">Current GAT</span>
      <span style="font-family:var(--ff);font-size:1.2em;font-weight:700;color:var(--gold)">${fc(getGAT())}</span>
    </div>
    <p style="font-size:.72em;color:var(--text2);margin-bottom:10px">GAT is never reset unless instructed by BIR.</p>
    <button class="btn bd bsm" onclick="resetGAT()">⚠️ Reset GAT (BIR Order Only)</button>
  </div>
  <button class="btn bp bbl" onclick="saveBIRSetup()">💾 Save BIR Settings</button>`;
}
function saveBIRSetup(){
  saveSetting('bir_name',document.getElementById('birN').value);
  saveSetting('bir_address',document.getElementById('birA').value);
  saveSetting('bir_tin',document.getElementById('birT').value);
  saveSetting('bir_accno',document.getElementById('birAn').value);
  saveSetting('bir_accdate',document.getElementById('birAd').value);
  saveSetting('bir_accexp',document.getElementById('birAe').value);
  saveSetting('bir_ptu',document.getElementById('birP').value);
  saveSetting('bir_doctype',document.getElementById('birDt').value);
  saveSetting('bir_prefix',document.getElementById('birPfx').value);
  saveSetting('bir_serfrom',document.getElementById('birSf').value);
  saveSetting('bir_serto',document.getElementById('birSt').value);
  saveSetting('bir_vattype',document.getElementById('birVt').value);
  toast('BIR settings saved ✓','emerald');sw('birSetup');
}
async function resetGAT(){
  const ok1=await confirm2(
    '⚠️ RESET Grand Accumulated Total?\n\nThis should ONLY be done when:\n• BIR explicitly orders a reset in writing\n• A new PTU/Permit to Use has been issued\n\nResetting without a new PTU will cause duplicate OR numbers — a serious BIR violation.',
    '⚠️',true
  );
  if(!ok1)return;
  const ok2=await confirm2(
    'FINAL CONFIRMATION\n\nHave you received a new PTU (Permit to Use) from BIR?\n\nIf NO — do not proceed. Duplicate OR numbers are a BIR violation.',
    '🏛️',true
  );
  if(!ok2)return;
  saveSetting('bir_gat','0');
  saveSetting('bir_counter','0');
  logAct('GAT RESET','⚠️ GAT and OR counter reset to zero by '+currentUser.name+' — requires new PTU');
  toast('⚠️ GAT and OR counter reset. Ensure new PTU is configured in BIR Setup.','rose',7000);
  sw('birSetup');
}

