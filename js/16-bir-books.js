/* ============================================================
   MLEA POS v6.0 — 16-bir-books.js
   Sales Book, 2550M, expenses, purchases book, audit export, OR reservation
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */

// ════════════════════════════════════════════
// PHASE 2: BIR SALES BOOK + 2550M
// ════════════════════════════════════════════
function renderSalesBook(el) {
  const m = new Date().toISOString().substring(0, 7);
  const bir = getBIR();
  const sales = getMyData('sales').filter(s => s.date.startsWith(m) && !s.voided)
    .sort((a, b) => a.orNumber?.localeCompare(b.orNumber));

  let runningTotal = 0;
  const rows = sales.map((s, i) => {
    runningTotal += s.total;
    return `<tr>
      <td>${s.date}</td>
      <td style="font-family:var(--fm);font-size:.9em">${s.orNumber || s.id}</td>
      <td>${s.cashierName || '—'}</td>
      <td>${fc(s.vatableSales || 0)}</td>
      <td>${fc(s.tax || 0)}</td>
      <td>${fc(s.vatExemptSales || 0)}</td>
      <td>${fc(s.zeroRatedSales || 0)}</td>
      <td>${fc(s.total)}</td>
      <td>${fc(runningTotal)}</td>
    </tr>`;
  }).join('');

  const totVat = sales.reduce((a, s) => a + (s.vatableSales || 0), 0);
  const totTax = sales.reduce((a, s) => a + (s.tax || 0), 0);
  const totExempt = sales.reduce((a, s) => a + (s.vatExemptSales || 0), 0);
  const totZero = sales.reduce((a, s) => a + (s.zeroRatedSales || 0), 0);
  const totGross = sales.reduce((a, s) => a + s.total, 0);

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h4 style="margin:0">📒 BIR Sales Book</h4>
      <span class="bir-badge">RR 9-2009</span>
    </div>
    <div class="card" style="border-left:3px solid var(--gold);margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:.8em;margin-bottom:4px"><span style="color:var(--text2)">Business</span><span style="font-weight:600">${bir.name}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:.8em;margin-bottom:4px"><span style="color:var(--text2)">TIN</span><span style="font-family:var(--fm)">${bir.tin}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:.8em"><span style="color:var(--text2)">Period</span><span>${m}</span></div>
    </div>
    <div style="overflow-x:auto">
      <table class="bir-tbl">
        <thead><tr>
          <th>Date</th><th>OR/SI No.</th><th>Cashier</th>
          <th>VATable Sales</th><th>VAT Amount</th><th>VAT-Exempt</th><th>Zero-Rated</th>
          <th>Gross Amount</th><th>Running Total</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text3)">No sales this month</td></tr>'}</tbody>
        <tfoot><tr>
          <td colspan="3"><strong>TOTAL</strong></td>
          <td>${fc(totVat)}</td><td>${fc(totTax)}</td>
          <td>${fc(totExempt)}</td><td>${fc(totZero)}</td>
          <td>${fc(totGross)}</td><td>${fc(runningTotal)}</td>
        </tr></tfoot>
      </table>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
      <button class="btn bp" onclick="exportSalesBook()">📥 Export CSV</button>
      <button class="btn bw" onclick="printSalesBook()">🖨 Print</button>
    </div>`;
}

function exportSalesBook() {
  const m = new Date().toISOString().substring(0, 7);
  const bir = getBIR();
  const sales = getMyData('sales').filter(s => s.date.startsWith(m) && !s.voided)
    .sort((a, b) => (a.orNumber || '').localeCompare(b.orNumber || ''));
  let runTotal = 0;
  let csv = `SALES JOURNAL / SALES BOOK\n`;
  csv += `"Business: ${bir.name}"\n"TIN: ${bir.tin}"\n"Period: ${m}"\n\n`;
  csv += `Date,OR/SI No.,Cashier,VATable Sales,VAT Amount,VAT-Exempt,Zero-Rated,Gross Amount,Running Total\n`;
  sales.forEach(s => {
    runTotal += s.total;
    csv += `${s.date},${s.orNumber || s.id},"${s.cashierName || ''}",${(s.vatableSales || 0).toFixed(2)},${(s.tax || 0).toFixed(2)},${(s.vatExemptSales || 0).toFixed(2)},${(s.zeroRatedSales || 0).toFixed(2)},${s.total.toFixed(2)},${runTotal.toFixed(2)}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `SalesBook_${m}.csv`; a.click();
  toast('Sales Book exported ✓', 'emerald');
}

function printSalesBook() {
  const m = new Date().toISOString().substring(0, 7);
  const bir = getBIR();
  const sales = getMyData('sales').filter(s => s.date.startsWith(m) && !s.voided)
    .sort((a, b) => (a.orNumber || '').localeCompare(b.orNumber || ''));
  let runTotal = 0;
  const rows = sales.map(s => {
    runTotal += s.total;
    return `<tr><td>${s.date}</td><td>${s.orNumber || s.id}</td><td>${s.cashierName || ''}</td>
      <td>${fc(s.vatableSales || 0)}</td><td>${fc(s.tax || 0)}</td>
      <td>${fc(s.vatExemptSales || 0)}</td><td>${fc(s.zeroRatedSales || 0)}</td>
      <td>${fc(s.total)}</td><td>${fc(runTotal)}</td></tr>`;
  }).join('');
  const totVat = sales.reduce((a, s) => a + (s.vatableSales || 0), 0);
  const totTax = sales.reduce((a, s) => a + (s.tax || 0), 0);
  const totEx = sales.reduce((a, s) => a + (s.vatExemptSales || 0), 0);
  const totZr = sales.reduce((a, s) => a + (s.zeroRatedSales || 0), 0);
  const totG = sales.reduce((a, s) => a + s.total, 0);
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @page{margin:15mm 10mm;size:A4 landscape}*{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#222}
    h2{font-size:14px;margin-bottom:4px}.sub{font-size:10px;color:#666;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th{background:#1a2744;color:#d4a853;padding:7px 8px;text-align:center;font-size:9px;letter-spacing:.5px;text-transform:uppercase;border:1px solid #2a3a5a}
    td{padding:6px 8px;border:1px solid #ddd;font-size:10px}td:not(:first-child):not(:nth-child(2)):not(:nth-child(3)){text-align:right}
    tfoot td{font-weight:bold;background:#f5f5f5;border-top:2px solid #222}
    </style></head><body>
    <h2>SALES JOURNAL / SALES BOOK</h2>
    <div class="sub">Business: ${bir.name} &nbsp;|&nbsp; TIN: ${bir.tin} &nbsp;|&nbsp; Period: ${m}</div>
    <table>
      <thead><tr><th>Date</th><th>OR/SI No.</th><th>Cashier</th><th>VATable Sales</th><th>VAT Amount</th><th>VAT-Exempt</th><th>Zero-Rated</th><th>Gross Amount</th><th>Running Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="3">TOTAL</td><td>${fc(totVat)}</td><td>${fc(totTax)}</td><td>${fc(totEx)}</td><td>${fc(totZr)}</td><td>${fc(totG)}</td><td>${fc(runTotal)}</td></tr></tfoot>
    </table></body></html>`;
  const frame = document.getElementById('printFrame');
  const doc = frame.contentDocument || frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); }, 350);
}

// ── 2550M VAT Return Summary ──────────────────────────────────────────────────
function render2550M(el) {
  const m = new Date().toISOString().substring(0, 7);
  const bir = getBIR();
  const sales = getMyData('sales').filter(s => s.date.startsWith(m) && !s.voided);
  const returns = getMyData('returns').filter(r => r.date && r.date.startsWith(m));

  const grossSales = sales.reduce((a, s) => a + s.total, 0);
  const vatableSales = sales.reduce((a, s) => a + (s.vatableSales || 0), 0);
  const outputVAT = sales.reduce((a, s) => a + (s.tax || 0), 0);
  const vatExempt = sales.reduce((a, s) => a + (s.vatExemptSales || 0), 0);
  const zeroRated = sales.reduce((a, s) => a + (s.zeroRatedSales || 0), 0);
  const scDisc = sales.filter(s => s.discountType === 'sc').reduce((a, s) => a + (s.discountAmount || 0), 0);
  const pwdDisc = sales.filter(s => s.discountType === 'pwd').reduce((a, s) => a + (s.discountAmount || 0), 0);
  const refunds = returns.reduce((a, r) => a + (r.refundAmount || 0), 0);
  const vatOnRefunds = refunds * (taxRate / (1 + taxRate));
  const netVATDue = outputVAT - vatOnRefunds;

  const row = (label, amount, highlight = false) => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.05);${highlight ? 'background:rgba(212,168,83,.08);' : ''}">
      <span style="font-size:.8em;color:${highlight ? 'var(--gold)' : 'var(--text2)'}">${label}</span>
      <span style="font-family:var(--fm);font-size:.85em;color:${highlight ? 'var(--gold)' : 'var(--text)'};">${fc(amount)}</span>
    </div>`;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h4 style="margin:0">🏛️ BIR Form 2550M</h4>
      <span class="bir-badge">Monthly VAT</span>
    </div>
    <div class="card" style="border-left:3px solid var(--gold);margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:.8em;margin-bottom:4px"><span style="color:var(--text2)">Business</span><span>${bir.name}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:.8em;margin-bottom:4px"><span style="color:var(--text2)">TIN</span><span style="font-family:var(--fm)">${bir.tin}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:.8em"><span style="color:var(--text2)">Taxable Month</span><span>${m}</span></div>
    </div>
    <div class="card" style="padding:0;overflow:hidden">
      <div style="background:var(--bg-elevated);padding:10px 12px;font-family:var(--ff);font-size:.78em;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em">Part I — Output Tax</div>
      ${row('Gross Sales / Receipts', grossSales)}
      ${row('Less: Sales Returns & Allowances', refunds)}
      ${row('Less: Discounts (SC + PWD)', scDisc + pwdDisc)}
      ${row('Net Sales', grossSales - refunds - scDisc - pwdDisc)}
      ${row('VATable Sales (Net of VAT)', vatableSales)}
      ${row('VAT-Exempt Sales', vatExempt)}
      ${row('Zero-Rated Sales', zeroRated)}
      ${row('Output VAT (12% × VATable Sales)', outputVAT, true)}
      <div style="background:var(--bg-elevated);padding:10px 12px;font-family:var(--ff);font-size:.78em;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-top:4px">Part II — VAT Adjustments</div>
      ${row('VAT on Sales Returns', vatOnRefunds)}
      <div style="background:var(--bg-elevated);padding:10px 12px;font-family:var(--ff);font-size:.78em;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:.06em;margin-top:4px">Part III — Net VAT Payable</div>
      ${row('Net VAT Due (Estimated)', netVATDue, true)}
    </div>
    <div class="card" style="border:1px solid rgba(240,101,119,.2);margin-top:4px">
      <p style="font-size:.75em;color:var(--text2);line-height:1.6">⚠️ This is a <strong style="color:var(--text)">summary estimate only</strong>. The actual BIR Form 2550M must be filed via the BIR eFPS or eBIRForms system. Input VAT (purchases) is not included here. Consult your accountant for the official filing.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">
      <button class="btn bp" onclick="export2550M()">📥 Export Summary</button>
      <button class="btn bw" onclick="sw('salesBook')">📒 Sales Book</button>
    </div>`;
}

function export2550M() {
  const m = new Date().toISOString().substring(0, 7);
  const bir = getBIR();
  const sales = getMyData('sales').filter(s => s.date.startsWith(m) && !s.voided);
  const returns = getMyData('returns').filter(r => r.date && r.date.startsWith(m));
  const grossSales = sales.reduce((a, s) => a + s.total, 0);
  const vatableSales = sales.reduce((a, s) => a + (s.vatableSales || 0), 0);
  const outputVAT = sales.reduce((a, s) => a + (s.tax || 0), 0);
  const vatExempt = sales.reduce((a, s) => a + (s.vatExemptSales || 0), 0);
  const zeroRated = sales.reduce((a, s) => a + (s.zeroRatedSales || 0), 0);
  const scDisc = sales.filter(s => s.discountType === 'sc').reduce((a, s) => a + (s.discountAmount || 0), 0);
  const pwdDisc = sales.filter(s => s.discountType === 'pwd').reduce((a, s) => a + (s.discountAmount || 0), 0);
  const refunds = returns.reduce((a, r) => a + (r.refundAmount || 0), 0);
  const vatOnRefunds = refunds * (taxRate / (1 + taxRate));
  const netVATDue = outputVAT - vatOnRefunds;
  let csv = `BIR FORM 2550M SUMMARY (ESTIMATE)\n"Business: ${bir.name}"\n"TIN: ${bir.tin}"\n"Period: ${m}"\n\n`;
  csv += `Description,Amount\n`;
  csv += `Gross Sales,${grossSales.toFixed(2)}\nSales Returns,${refunds.toFixed(2)}\n`;
  csv += `SC+PWD Discounts,${(scDisc+pwdDisc).toFixed(2)}\n`;
  csv += `VATable Sales (net of VAT),${vatableSales.toFixed(2)}\nOutput VAT (12%),${outputVAT.toFixed(2)}\n`;
  csv += `VAT-Exempt Sales,${vatExempt.toFixed(2)}\nZero-Rated Sales,${zeroRated.toFixed(2)}\n`;
  csv += `VAT on Returns,${vatOnRefunds.toFixed(2)}\nEstimated Net VAT Due,${netVATDue.toFixed(2)}\n`;
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `2550M_Summary_${m}.csv`; a.click();
  toast('2550M summary exported ✓', 'emerald');
}

// ════════════════════════════════════════════
// EXPENSES MODULE
// Tracks operating expenses (snacks, supplies, etc.)
// Categorized, date-filtered, with monthly totals.
// ════════════════════════════════════════════
const EXPENSE_CATEGORIES = ['Supplies','Food/Meals','Utilities','Rent','Salaries','Transport','Maintenance','Marketing','Permits/Fees','Other'];

function renderExpenses(el){
  const all=getMyData('expenses').slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  // Current-month filter context
  const month=el._expMonth||new Date().toISOString().substring(0,7);
  const monthExp=all.filter(e=>(e.date||'').startsWith(month));
  const monthTotal=monthExp.reduce((s,e)=>s+(e.amount||0),0);
  const allTotal=all.reduce((s,e)=>s+(e.amount||0),0);
  // Category breakdown for the month
  const byCat={};
  monthExp.forEach(e=>{const c=e.category||'Other';byCat[c]=(byCat[c]||0)+(e.amount||0);});
  const catRows=Object.entries(byCat).sort((a,b)=>b[1]-a[1])
    .map(([c,v])=>`<div style="display:flex;justify-content:space-between;font-size:.8em;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.04)"><span style="color:var(--text2)">${c}</span><span style="font-family:var(--fm)">${fc(v)}</span></div>`).join('');

  el.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h4 style="margin:0">💸 Expenses</h4>
      <button class="btn bp bsm" onclick="showExpenseModal()">+ Add Expense</button>
    </div>
    <div class="metrics" style="margin-bottom:12px">
      <div class="met"><div class="met-v" style="color:var(--rose)">${fc(monthTotal)}</div><div class="met-l">This Month</div></div>
      <div class="met"><div class="met-v">${monthExp.length}</div><div class="met-l">Entries</div></div>
      <div class="met"><div class="met-v" style="color:var(--gold)">${fc(allTotal)}</div><div class="met-l">All-Time</div></div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <label style="font-size:.78em;color:var(--text2)">Month:</label>
        <input type="month" id="expMonth" value="${month}" onchange="(function(){const el=document.getElementById('mainContent');el._expMonth=document.getElementById('expMonth').value;renderExpenses(el);})()" style="margin-bottom:0;width:auto;font-family:var(--fm);font-size:.85em">
        <button class="btn bw bxs" style="margin-left:auto" onclick="exportExpensesCSV()">📥 CSV</button>
      </div>
      ${catRows?`<div style="margin-top:8px"><div style="font-size:.72em;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">By Category</div>${catRows}</div>`:''}
    </div>
    ${monthExp.length?monthExp.map(e=>`
      <div class="card" style="padding:12px 14px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="min-width:0;flex:1">
            <div style="font-family:var(--ff);font-weight:600;font-size:.9em">${e.description||'(no description)'}</div>
            <div style="display:flex;gap:8px;align-items:center;margin-top:3px">
              <span class="rbadge rb-cashier" style="font-size:.62em">${e.category||'Other'}</span>
              <span style="font-size:.72em;color:var(--text3)">${e.date||''}</span>
            </div>
          </div>
          <div style="text-align:right;display:flex;align-items:center;gap:8px">
            <span style="font-family:var(--fm);font-weight:700;color:var(--rose)">${fc(e.amount||0)}</span>
            <button class="btn bw bxs" onclick="showExpenseModal(${e.id})">✎</button>
            <button class="btn bd bxs" onclick="deleteExpense(${e.id})">🗑</button>
          </div>
        </div>
      </div>`).join(''):'<div class="empty-st"><div class="ei">💸</div><p>No expenses for this month</p></div>'}`;
}

function showExpenseModal(id){
  const e=id?DB.getById('expenses',id):null;
  const today=new Date().toISOString().split('T')[0];
  openModal(`<h4>${e?'✎ Edit':'💸 Add'} Expense</h4>
    <label class="inp-label">Description *</label>
    <input type="text" id="expDesc" value="${e?(e.description||'').replace(/"/g,'&quot;'):''}" placeholder="e.g. Office supplies">
    <label class="inp-label">Amount (₱) *</label>
    <input type="number" id="expAmt" value="${e?e.amount:''}" placeholder="0.00" step="0.01" min="0">
    <label class="inp-label">Category</label>
    <select id="expCat">${EXPENSE_CATEGORIES.map(c=>`<option value="${c}" ${e&&e.category===c?'selected':''}>${c}</option>`).join('')}</select>
    <label class="inp-label">Date</label>
    <input type="date" id="expDate" value="${e?e.date:today}">
    <div id="expErr" style="color:var(--rose);font-size:.78em;min-height:16px;margin:6px 0;font-weight:600"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn bd" onclick="closeModal()">Cancel</button>
      <button class="btn bp" onclick="saveExpense(${id||'null'})">${e?'Save Changes':'Add Expense'}</button>
    </div>`);
  setTimeout(()=>document.getElementById('expDesc')?.focus(),100);
}

function saveExpense(id){
  const desc=(document.getElementById('expDesc')?.value||'').trim();
  const amt=parseFloat(document.getElementById('expAmt')?.value)||0;
  const cat=document.getElementById('expCat')?.value||'Other';
  const date=document.getElementById('expDate')?.value||new Date().toISOString().split('T')[0];
  const err=document.getElementById('expErr');
  if(!desc){if(err)err.textContent='Description is required';return;}
  if(amt<=0){if(err)err.textContent='Amount must be greater than zero';return;}
  if(id&&id!=='null'){
    const e=DB.getById('expenses',parseInt(id));
    if(e){e.description=desc;e.amount=amt;e.category=cat;e.date=date;DB.update('expenses',e);}
    logAct('Expense Updated',`${desc}: ${fc(amt)}`);
  }else{
    DB.add('expenses',{description:desc,amount:amt,category:cat,date,branchId:currentUser.branchId,recordedBy:currentUser.name});
    logAct('Expense Added',`${desc}: ${fc(amt)}`);
  }
  closeModal();sw('expenses');toast('Expense saved ✓','emerald');
}

async function deleteExpense(id){
  const e=DB.getById('expenses',id);if(!e)return;
  const ok=await confirm2(`Delete expense "${e.description}" (${fc(e.amount)})?`,'🗑️',true);
  if(!ok)return;
  DB.delete('expenses',id);
  logAct('Expense Deleted',`${e.description}: ${fc(e.amount)}`);
  sw('expenses');toast('Expense deleted','gold');
}

function exportExpensesCSV(){
  const all=getMyData('expenses').slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  let csv='Date,Description,Category,Amount\n';
  all.forEach(e=>csv+=`${e.date||''},"${(e.description||'').replace(/"/g,"'")}",${e.category||'Other'},${(e.amount||0).toFixed(2)}\n`);
  const tot=all.reduce((s,e)=>s+(e.amount||0),0);
  csv+=`,,TOTAL,${tot.toFixed(2)}\n`;
  const blob=new Blob([csv],{type:'text/csv'});const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=`expenses_${new Date().toISOString().split('T')[0]}.csv`;a.click();
  toast('Expenses exported ✓','emerald');
}

// ════════════════════════════════════════════
// FEATURE 2: PURCHASES BOOK (RR 9-2009)
// Records all purchase transactions from
// purchase orders and supplier invoices.
// ════════════════════════════════════════════
function renderPurchasesBook(el) {
  const m = new Date().toISOString().substring(0, 7);
  const bir = getBIR();
  const pos = getMyData('purchaseOrders')
    .filter(po => po.status === 'received' && po.date && po.date.startsWith(m))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const suppliers = DB.getAll('suppliers');

  let runTotal = 0;
  const rows = pos.map((po, i) => {
    const supplier = suppliers.find(s => s.id === po.supplierId);
    const itemsTotal = (po.items || []).reduce((a, it) => a + (it.total || 0), 0);
    const vatAmt = bir.vatType === 'vat' ? (itemsTotal / (1 + taxRate) * taxRate) : 0;
    const netOfVat = itemsTotal - vatAmt;
    runTotal += itemsTotal;
    return `<tr>
      <td>${po.date || ''}</td>
      <td style="font-family:var(--fm);font-size:.9em">PO-${String(po.id).padStart(7,'0')}</td>
      <td>${supplier ? supplier.name : 'N/A'}</td>
      <td>${supplier ? (supplier.tin || '—') : '—'}</td>
      <td>${fc(netOfVat)}</td>
      <td>${fc(vatAmt)}</td>
      <td>${fc(itemsTotal)}</td>
      <td>${fc(runTotal)}</td>
    </tr>`;
  }).join('');

  const totPurchases = pos.reduce((a, po) => a + (po.items||[]).reduce((b,it)=>b+(it.total||0),0), 0);
  const totVat = bir.vatType === 'vat' ? totPurchases / (1 + taxRate) * taxRate : 0;
  const totNet = totPurchases - totVat;

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h4 style="margin:0">📗 BIR Purchases Book</h4>
      <span class="bir-badge">RR 9-2009</span>
    </div>
    <div class="card" style="border-left:3px solid var(--emerald);margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;font-size:.8em;margin-bottom:4px"><span style="color:var(--text2)">Business</span><span>${bir.name}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:.8em;margin-bottom:4px"><span style="color:var(--text2)">TIN</span><span style="font-family:var(--fm)">${bir.tin}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:.8em"><span style="color:var(--text2)">Period</span><span>${m}</span></div>
    </div>
    <div class="card" style="border:1px solid rgba(240,101,119,.2);margin-bottom:12px">
      <p style="font-size:.78em;color:var(--text2);line-height:1.6">⚠️ Only received Purchase Orders are included. Ensure all supplier invoices are entered as POs before export.</p>
    </div>
    <div style="overflow-x:auto">
      <table class="bir-tbl">
        <thead><tr>
          <th>Date</th><th>PO No.</th><th>Supplier</th><th>Supplier TIN</th>
          <th>Net of VAT</th><th>Input VAT</th><th>Total</th><th>Running Total</th>
        </tr></thead>
        <tbody>${rows || '<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--text3)">No received POs this month</td></tr>'}</tbody>
        <tfoot><tr>
          <td colspan="4"><strong>TOTAL</strong></td>
          <td>${fc(totNet)}</td><td>${fc(totVat)}</td>
          <td>${fc(totPurchases)}</td><td>${fc(runTotal)}</td>
        </tr></tfoot>
      </table>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
      <button class="btn bp" onclick="exportPurchasesBook()">📥 Export CSV</button>
      <button class="btn bw" onclick="printPurchasesBook()">🖨 Print</button>
    </div>`;
}

function exportPurchasesBook() {
  const m = new Date().toISOString().substring(0, 7);
  const bir = getBIR();
  const pos = getMyData('purchaseOrders')
    .filter(po => po.status === 'received' && po.date && po.date.startsWith(m))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const suppliers = DB.getAll('suppliers');
  let runTotal = 0;
  let csv = `PURCHASES BOOK / PURCHASES JOURNAL\n"Business: ${bir.name}"\n"TIN: ${bir.tin}"\n"Period: ${m}"\n\n`;
  csv += `Date,PO No.,Supplier,Supplier TIN,Net of VAT,Input VAT (12%),Total,Running Total\n`;
  pos.forEach(po => {
    const supplier = suppliers.find(s => s.id === po.supplierId);
    const total = (po.items || []).reduce((a, it) => a + (it.total || 0), 0);
    const vatAmt = bir.vatType === 'vat' ? total / (1 + taxRate) * taxRate : 0;
    const net = total - vatAmt;
    runTotal += total;
    csv += `${po.date||''},${'PO-'+String(po.id).padStart(7,'0')},"${supplier?supplier.name:'N/A'}","${supplier?supplier.tin||'—':'—'}",${net.toFixed(2)},${vatAmt.toFixed(2)},${total.toFixed(2)},${runTotal.toFixed(2)}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `PurchasesBook_${m}.csv`; a.click();
  toast('Purchases Book exported ✓', 'emerald');
}

function printPurchasesBook() {
  const m = new Date().toISOString().substring(0, 7);
  const bir = getBIR();
  const pos = getMyData('purchaseOrders')
    .filter(po => po.status === 'received' && po.date && po.date.startsWith(m))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const suppliers = DB.getAll('suppliers');
  let runTotal = 0;
  const rows = pos.map(po => {
    const sup = suppliers.find(s => s.id === po.supplierId);
    const total = (po.items || []).reduce((a, it) => a + (it.total || 0), 0);
    const vatAmt = bir.vatType === 'vat' ? total / (1 + taxRate) * taxRate : 0;
    const net = total - vatAmt;
    runTotal += total;
    return `<tr><td>${po.date||''}</td><td>PO-${String(po.id).padStart(7,'0')}</td><td>${sup?sup.name:'N/A'}</td><td>${sup?sup.tin||'—':'—'}</td><td>${fc(net)}</td><td>${fc(vatAmt)}</td><td>${fc(total)}</td><td>${fc(runTotal)}</td></tr>`;
  }).join('');
  const totP = pos.reduce((a, po) => a + (po.items||[]).reduce((b,it)=>b+(it.total||0),0), 0);
  const totV = bir.vatType === 'vat' ? totP / (1 + taxRate) * taxRate : 0;
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    @page{margin:15mm 10mm;size:A4 landscape}*{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:10px;color:#222}
    h2{font-size:14px;margin-bottom:4px}.sub{font-size:10px;color:#666;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-top:10px}
    th{background:#1a4d2e;color:#fff;padding:7px 8px;text-align:center;font-size:9px;text-transform:uppercase}
    td{padding:6px 8px;border:1px solid #ddd;font-size:10px}td:not(:first-child):not(:nth-child(2)):not(:nth-child(3)):not(:nth-child(4)){text-align:right}
    tfoot td{font-weight:bold;background:#f5f5f5;border-top:2px solid #222}
    </style></head><body>
    <h2>PURCHASES JOURNAL / PURCHASES BOOK</h2>
    <div class="sub">Business: ${bir.name} &nbsp;|&nbsp; TIN: ${bir.tin} &nbsp;|&nbsp; Period: ${m}</div>
    <table>
      <thead><tr><th>Date</th><th>PO No.</th><th>Supplier</th><th>Supplier TIN</th><th>Net of VAT</th><th>Input VAT</th><th>Total</th><th>Running Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="4">TOTAL</td><td>${fc(totP-totV)}</td><td>${fc(totV)}</td><td>${fc(totP)}</td><td>${fc(runTotal)}</td></tr></tfoot>
    </table></body></html>`;
  const frame = document.getElementById('printFrame');
  const doc = frame.contentDocument || frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(() => { frame.contentWindow.focus(); frame.contentWindow.print(); }, 350);
}

// ════════════════════════════════════════════
// FEATURE 3: AUDIT LOG BIR EXPORT
// Formatted audit trail export for BIR inspection.
// Covers all system events with timestamps.
// ════════════════════════════════════════════
function exportAuditLog() {
  const bir = getBIR();
  const logs = getMyData('activityLogs').sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const dateRange = logs.length
    ? `${logs[0].timestamp.split('T')[0]} to ${logs[logs.length-1].timestamp.split('T')[0]}`
    : 'No records';

  let csv = `BIR AUDIT TRAIL REPORT\n`;
  csv += `"Business: ${bir.name}"\n"TIN: ${bir.tin}"\n"PTU: ${bir.ptu}"\n`;
  csv += `"Period: ${dateRange}"\n"Generated: ${new Date().toLocaleString('en-PH')}"\n\n`;
  csv += `Timestamp,User,Role,Branch,Action,Details\n`;
  logs.forEach(l => {
    csv += `"${new Date(l.timestamp).toLocaleString('en-PH')}","${l.userName||'System'}","${l.userRole||'—'}","${l.branchId?'Branch '+l.branchId:'Global'}","${l.action||''}","${(l.details||'').replace(/"/g,"'")}"\n`;
  });
  // Summary section
  const actions = {};
  logs.forEach(l => { actions[l.action] = (actions[l.action] || 0) + 1; });
  csv += `\nAUDIT SUMMARY\nAction,Count\n`;
  Object.entries(actions).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => { csv += `"${k}",${v}\n`; });

  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `AuditLog_${new Date().toISOString().split('T')[0]}.csv`; a.click();
  toast('Audit log exported ✓', 'emerald');
  logAct('Audit Log Exported', `${logs.length} records exported`);
}

function renderAuditExport(el) {
  const logs = getMyData('activityLogs');
  const devLogs = logs.filter(l => l.action && l.action.includes('DEV'));
  const voidLogs = logs.filter(l => l.action === 'VOID');
  const saleLogs = logs.filter(l => l.action === 'Sale');
  const pinLogs = logs.filter(l => l.action && l.action.includes('PIN'));

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h4 style="margin:0">📋 BIR Audit Trail Export</h4>
      <span class="bir-badge">RMO 9-2009</span>
    </div>
    <div class="card" style="border-left:3px solid var(--blue);margin-bottom:12px">
      <h5>Audit Summary</h5>
      <div class="metrics">
        <div class="met"><div class="met-v">${logs.length}</div><div class="met-l">Total Events</div></div>
        <div class="met"><div class="met-v" style="color:var(--gold)">${saleLogs.length}</div><div class="met-l">Sales</div></div>
        <div class="met"><div class="met-v" style="color:var(--rose)">${voidLogs.length}</div><div class="met-l">Voids</div></div>
        <div class="met"><div class="met-v" style="color:var(--purple)">${devLogs.length}</div><div class="met-l">Dev Access</div></div>
      </div>
    </div>
    <div class="card" style="margin-bottom:12px">
      <h5>Recent Events (last 20)</h5>
      <div style="max-height:300px;overflow-y:auto">
        ${logs.slice(-20).reverse().map(l=>`
          <div style="padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.78em">
            <div style="font-weight:700;color:${l.action&&l.action.includes('DEV')?'var(--rose)':l.action==='VOID'?'var(--rose)':'var(--text)'}">
              ${l.action}
            </div>
            <div style="color:var(--text2);font-size:.88em">${l.details||''}</div>
            <div style="color:var(--text3);font-size:.82em;margin-top:2px">
              ${l.userName||'System'} · ${new Date(l.timestamp).toLocaleString('en-PH')}
            </div>
          </div>`).join('')}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn bp" onclick="exportAuditLog()">📥 Export Full Audit CSV</button>
      <button class="btn bw" onclick="sw('actLog')">📝 View Activity Log</button>
    </div>`;
}

// ════════════════════════════════════════════
// FEATURE 4: OFFLINE OR RESERVATION SYSTEM
// Reserves a block of OR numbers for offline use.
// Prevents duplicates when device goes offline.
// Each device gets a unique non-overlapping block.
// ════════════════════════════════════════════
const OR_BLOCK_SIZE = 50; // reserve 50 ORs at a time

async function reserveORBlock() {
  // Only works when Firebase + Cloud Functions are available
  if (!_fbFunctions || !isOnline) return null;
  try {
    const bir = getBIR();
    const fn = _fbFunctions.httpsCallable(_fbFunctions.functions, 'getNextORNumber');
    // Request a block by calling OR function OR_BLOCK_SIZE times would be wasteful
    // Instead call once to get current counter, then reserve the block
    const result = await fn({ prefix: bir.prefix, seriesTo: bir.serTo, blockSize: OR_BLOCK_SIZE });
    const blockStart = result.data.counter - OR_BLOCK_SIZE + 1;
    const blockEnd = result.data.counter;
    const block = { start: blockStart, end: blockEnd, current: blockStart, prefix: bir.prefix, reservedAt: new Date().toISOString() };
    saveSetting('or_reserved_block', JSON.stringify(block));
    logAct('OR Block Reserved', `Block ${bir.prefix}-${String(blockStart).padStart(7,'0')} to ${bir.prefix}-${String(blockEnd).padStart(7,'0')}`);
    toast(`✓ Reserved ${OR_BLOCK_SIZE} OR numbers for offline use`, 'emerald');
    return block;
  } catch(e) {
    console.warn('OR block reservation failed:', e);
    return null;
  }
}

function getReservedBlock() {
  try {
    const raw = getSetting('or_reserved_block', '');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function useReservedOR() {
  const block = getReservedBlock();
  if (!block || block.current > block.end) return null; // block exhausted
  const orNum = block.prefix + '-' + String(block.current).padStart(7, '0');
  block.current++;
  saveSetting('or_reserved_block', JSON.stringify(block));
  // Log when block is running low
  const remaining = block.end - block.current + 1;
  if (remaining <= 5) toast(`⚠️ Offline OR block almost exhausted (${remaining} left). Go online to reserve more.`, 'rose', 7000);
  return orNum;
}

function clearReservedBlock() {
  saveSetting('or_reserved_block', '');
  toast('OR reservation block cleared', 'gold');
}

// Patch getORNumber to use reserved block when offline
const _origGetORNumber = getORNumber;
getORNumber = async function() {
  // If online — use cloud function (original)
  if (isOnline && _fbFunctions) return _origGetORNumber();
  // If offline — try reserved block first
  const reservedOR = useReservedOR();
  if (reservedOR) {
    console.log('Using reserved OR:', reservedOR);
    return reservedOR;
  }
  // If no block available — fall back to local counter + warn
  toast('⚠️ No OR block reserved. Using local counter. Sync when online to verify no duplicates.', 'rose', 8000);
  return getNextOR();
};

// Auto-reserve block when coming back online
window.addEventListener('online', async () => {
  const block = getReservedBlock();
  if (!block || block.current > block.end - 10) {
    // Block exhausted or almost — reserve a new one
    setTimeout(reserveORBlock, 2000);
  }
});

function renderORReservation(el) {
  const block = getReservedBlock();
  const bir = getBIR();
  const remaining = block ? block.end - block.current + 1 : 0;
  const statusColor = !block ? 'var(--rose)' : remaining <= 5 ? 'var(--rose)' : remaining <= 20 ? '#fbb923' : 'var(--emerald)';

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h4 style="margin:0">📶 Offline OR Reservation</h4>
      <span class="bir-badge">Multi-Device Safe</span>
    </div>
    <div class="card" style="border-left:3px solid ${statusColor}">
      <h5 style="color:${statusColor}">Current Block Status</h5>
      ${block
        ? `<div style="font-size:.82em;line-height:2">
            <div><span style="color:var(--text2)">Reserved Range:</span> <span style="font-family:var(--fm)">${bir.prefix}-${String(block.start).padStart(7,'0')} → ${bir.prefix}-${String(block.end).padStart(7,'0')}</span></div>
            <div><span style="color:var(--text2)">Next OR:</span> <span style="font-family:var(--fm)">${bir.prefix}-${String(block.current).padStart(7,'0')}</span></div>
            <div><span style="color:var(--text2)">Remaining:</span> <span style="color:${statusColor};font-weight:700">${remaining} of ${OR_BLOCK_SIZE}</span></div>
            <div><span style="color:var(--text2)">Reserved at:</span> ${new Date(block.reservedAt).toLocaleString('en-PH')}</div>
           </div>`
        : `<p style="font-size:.82em;color:var(--rose)">No OR block reserved. Device will use local counter when offline.</p>`
      }
    </div>
    <div class="card" style="border:1px solid rgba(111,163,239,.2)">
      <h5>How It Works</h5>
      <p style="font-size:.78em;color:var(--text2);line-height:1.7">When online, the system uses the Firebase Cloud Function for atomic OR numbers (no duplicates). When offline, it uses a pre-reserved block of ${OR_BLOCK_SIZE} ORs unique to this device. Reserve a block while online — it lasts until exhausted.</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
      <button class="btn bp" onclick="reserveORBlock().then(()=>sw('orReservation'))" ${!isOnline?'disabled':''}>
        📶 Reserve New Block ${!isOnline?'(Offline)':''}
      </button>
      <button class="btn bd" onclick="confirm2('Clear OR reservation block?','📶',true).then(ok=>{if(ok){clearReservedBlock();sw('orReservation');}})" ${!block?'disabled':''}>
        🗑 Clear Block
      </button>
    </div>
    <p style="font-size:.7em;color:var(--text3);text-align:center;margin-top:8px">Network: ${isOnline?'🟢 Online':'🔴 Offline'} · Firebase: ${_fbFunctions?'✓':'✗'}</p>`;
}
