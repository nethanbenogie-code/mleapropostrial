/* ============================================================
   MLEA POS v6.0 — 19-patches.js
   All runtime patches (MUST LOAD LAST) + boot
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */


// ════════════════════════════════════════════
// PATCH: _finalizePay — add customer support,
// loyalty points, Cloud Function OR, barcode
// ════════════════════════════════════════════
// ════════════════════════════════════════════
// PHASE 4 + CLOUD OR: Replace _finalizePay with
// async version that uses Cloud Function OR number,
// attaches customer, awards loyalty points.
// We redefine the function directly instead of
// patching via override to avoid await issues.
// ════════════════════════════════════════════
_finalizePay = async function(method, cashTendered, secondAmt) {
  if (!cart.length) { toast('Cart is empty', 'rose'); return; }
  const bir = getBIR();
  const subBD = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
  const effDisc = Math.min(discAmt, subBD);
  const sub = subBD - effDisc;
  const discRatio = subBD > 0 ? (sub / subBD) : 1;
  const scaledItems = cart.map(i => ({ ...i, price: i.price * discRatio }));
  const vatD = computeVAT(sub, bir.vatType, taxRate, scaledItems);
  const total = vatD.grandTotal;
  let changeGiven = 0, splitCard = 0, actualCash = cashTendered;
  if (method === 'split') { splitCard = secondAmt; changeGiven = Math.max(0, cashTendered + splitCard - total); }
  else if (method === 'cash') { changeGiven = secondAmt; }
  else { actualCash = 0; changeGiven = 0; }

  // ── Cloud-first OR number (atomic, no duplicates) ──
  const orNum = await getORNumber();

  const branchObj = currentUser.branchId ? LocalDB.getById('branches', currentUser.branchId) : null;
  const gat = updateGAT(total);
  const sale = {
    date: new Date().toISOString().split('T')[0],
    timestamp: new Date().toISOString(),
    total, subtotal: sub, subtotalBeforeDiscount: subBD,
    discountAmount: effDisc, discountType: discType,
    tax: vatD.vatAmount, vatableSales: vatD.vatableSales,
    vatExemptSales: vatD.vatExempt, zeroRatedSales: vatD.zeroRated,
    paymentMethod: method, cashTendered: actualCash, changeGiven, splitCard,
    cashierId: currentUser.id, cashierName: currentUser.name,
    branchId: currentUser.branchId, branchName: branchObj ? branchObj.name : 'HQ',
    currency: cur, orNumber: orNum, vatType: bir.vatType, docType: bir.docType,
    grandAccumulatedTotal: gat, voided: false,
    // Customer attachment
    customerId: activeCustomer ? activeCustomer.id : null,
    customerName: activeCustomer ? activeCustomer.name : null,
    items: cart.map(i => ({
      productId: i.id, name: i.name, quantity: i.quantity,
      price: i.price, cost: i.cost || 0, unit: i.unit || 'pcs',
      vatExempt: i.vatExempt || false, zeroRated: i.zeroRated || false
    }))
  };

  const saleId = DB.add('sales', sale);
  // Attach receipt hash for tamper-evidence (async, non-blocking)
  attachReceiptHash(saleId).then(hash => {
    if (hash && lastSale) lastSale.receiptHash = hash;
  });
  cart.forEach(item => {
    const p = LocalDB.getById('products', item.id);
    if (p) { p.stock -= item.quantity; LocalDB.update('products', p); if (storageMode === 'firebase') FirebaseDB.update('products', p); }
  });
  logAct('Sale', orNum + ': ' + fc(total));
  lastSale = { ...sale, id: saleId };
  discAmt = 0; discType = 'none';

  // ── Award loyalty points ──
  if (activeCustomer) {
    const pts = awardLoyaltyPoints(activeCustomer.id, total);
    if (pts) setTimeout(() => toast(`⭐ ${pts} loyalty points awarded to ${activeCustomer.name}`, 'purple'), 1200);
  }
  activeCustomer = null;

  showSaleComplete(saleId, total, method, orNum, actualCash, changeGiven, splitCard);
  cart = [];
};

// ════════════════════════════════════════════
// PATCH: renderPOS — add customer chip
// ════════════════════════════════════════════
const _origRenderPOS = renderPOS;
renderPOS = function(el) {
  _origRenderPOS(el);
  // Inject customer chip below scan input
  const scanHint = el.querySelector('.scan-hint');
  if (scanHint) {
    const custDiv = document.createElement('div');
    custDiv.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0 10px';
    custDiv.innerHTML = activeCustomer
      ? `<span class="cust-chip" onclick="selectCustomerForSale()">👤 ${activeCustomer.name}${activeCustomer.points ? ' · ⭐' + activeCustomer.points + 'pts' : ''}</span><button class="btn bd bxs" onclick="attachCustomer(null)">✕</button>`
      : `<button class="btn bb bxs" onclick="selectCustomerForSale()">👤 Add Customer</button>`;
    scanHint.after(custDiv);
  }
};

// printRcpt is now async with logo, barcode, and customer built in.
// Email offer is handled inside showSaleComplete modal.

// ════════════════════════════════════════════
// PATCH: showSaleComplete — add email button
// ════════════════════════════════════════════
const _origShowSaleComplete = showSaleComplete;
showSaleComplete = function(saleId, total, method, orNum, cashTendered, changeGiven, splitCard) {
  _origShowSaleComplete(saleId, total, method, orNum, cashTendered, changeGiven, splitCard);
  // Inject email button into modal if it's showing
  setTimeout(() => {
    const modalBox = document.getElementById('modalBox');
    if (!modalBox || !lastSale) return;
    const printGrid = modalBox.querySelector('.print-grid');
    if (printGrid && (activeCustomer?.email || true)) {
      const emailBtn = document.createElement('button');
      emailBtn.className = 'btn bb bbl';
      emailBtn.style.marginTop = '4px';
      emailBtn.innerHTML = '📧 Email Receipt';
      emailBtn.onclick = () => promptEmailReceipt(lastSale);
      printGrid.after(emailBtn);
    }
  }, 100);
};

// ════════════════════════════════════════════
// PATCH: renderSidebar — add new menu items
// ════════════════════════════════════════════
const _origRenderSidebar = renderSidebar;
renderSidebar = function() {
  _origRenderSidebar();
  const nav = document.getElementById('sbNav');
  if (!nav || !currentUser) return;
  if (currentUser.role === 'admin' || currentUser.role === 'manager') {
    // Add customer + BIR books items if not already present
    if (!nav.innerHTML.includes('sw(\'customers\')')) {
      const custItem = `<div class="sb-item" onclick="sw('customers')"><span class="sb-icon">👤</span>Customers</div>`
        + `<div class="sb-item" onclick="sw('expenses')"><span class="sb-icon">💸</span>Expenses</div>`;
      const bookItems = `<div class="sb-item" onclick="sw('salesBook')"><span class="sb-icon">📒</span>Sales Book</div>`
        + `<div class="sb-item" onclick="sw('purchasesBook')"><span class="sb-icon">📗</span>Purchases Book</div>`
        + `<div class="sb-item" onclick="sw('form2550M')"><span class="sb-icon">🏛️</span>Form 2550M</div>`
        + `<div class="sb-item" onclick="sw('auditExport')"><span class="sb-icon">📋</span>Audit Export</div>`
        + (currentUser.role === 'admin' ? `<div class="sb-item" onclick="sw('orReservation')"><span class="sb-icon">📶</span>OR Reservation</div>` : '');
      // Append BIR book items after BIR Setup section
      nav.innerHTML = nav.innerHTML + bookItems;
      // Insert customers after users
      nav.innerHTML = nav.innerHTML.replace(
        /(<div class="sb-item" onclick="sw\('(allUsers|myUsers)'\)">[\s\S]*?<\/div>)/,
        `$1${custItem}`
      );
    }
  }
};

// ════════════════════════════════════════════
// PATCH: viewMap — populate base + add new views
// (Moved here from 05 for the modular build: every
//  render* function below is now defined, since this
//  file loads last.)
// ════════════════════════════════════════════
Object.assign(viewMap, {
  dashboard:renderDashboard, pos:renderPOS, branches:renderBranches,
  suppliers:renderSuppliers, purchaseOrders:renderPOs,
  allProducts:renderProducts, inventory:renderProducts,
  allUsers:renderUsers, myUsers:renderUsers,
  allSales:renderSales, branchSales:renderSales,
  voidedSales:renderVoided, returns:renderReturns,
  settings:renderSettings, reports:renderReports, backup:renderBackup,
  xReading:renderXR, zReading:renderZR, birSetup:renderBIRSetup,
  actLog:renderActLog, fbSetup:renderFBSetup,
});
viewMap.customers = renderCustomers;
viewMap.salesBook = renderSalesBook;
viewMap.form2550M = render2550M;
viewMap.purchasesBook = renderPurchasesBook;
viewMap.auditExport = renderAuditExport;
viewMap.orReservation = renderORReservation;
viewMap.expenses = renderExpenses;

// ════════════════════════════════════════════
// PATCH: renderSettings — add Phase 3/4 settings
// ════════════════════════════════════════════
const _origRenderSettings = renderSettings;
renderSettings = function(el) {
  _origRenderSettings(el);
  // Inject storage quota + logo + email settings
  const content = el.innerHTML;
  el.innerHTML = content + `
    <div class="card">
      <h5>💾 Storage</h5>
      <div id="storageQuotaEl"></div>
      <p style="font-size:.72em;color:var(--text2);margin-top:4px">MLEA POS uses IndexedDB (unlimited) with localStorage as fallback.</p>
    </div>
    <div class="card">
      <div id="logoSettingsWrap"></div>
    </div>
    <div class="card">
      <h5>📧 Email Receipts (EmailJS)</h5>
      <p style="font-size:.78em;color:var(--text2);margin-bottom:10px">Sign up free at <a href="https://emailjs.com" target="_blank" style="color:var(--blue)">emailjs.com</a> then paste your keys below.</p>
      <label class="inp-label">Service ID</label><input type="text" id="ejSvc" value="${getSetting('emailjs_service','')}" placeholder="service_xxxxxxx">
      <label class="inp-label">Template ID</label><input type="text" id="ejTpl" value="${getSetting('emailjs_template','')}" placeholder="template_xxxxxxx">
      <label class="inp-label">Public Key</label><input type="text" id="ejKey" value="${getSetting('emailjs_pubkey','')}" placeholder="your_public_key">
      <button class="btn bp bsm" onclick="saveEmailJSSettings()">Save Email Settings</button>
    </div>`;
  renderStorageQuota('storageQuotaEl');
  renderLogoSettings('logoSettingsWrap');
};

function saveEmailJSSettings() {
  saveSetting('emailjs_service', document.getElementById('ejSvc').value.trim());
  saveSetting('emailjs_template', document.getElementById('ejTpl').value.trim());
  saveSetting('emailjs_pubkey', document.getElementById('ejKey').value.trim());
  toast('Email settings saved ✓', 'emerald');
}

// ════════════════════════════════════════════
// PATCH: renderBackup — add storage quota + IDB
// ════════════════════════════════════════════
const _origRenderBackup = renderBackup;
renderBackup = function(el) {
  _origRenderBackup(el);
  // Prepend storage info
  const first = el.querySelector('.card');
  if (first) {
    const storageDiv = document.createElement('div');
    storageDiv.className = 'card';
    storageDiv.innerHTML = `<h5>💾 Storage Health</h5><div id="backupQuotaEl"></div>
      <button class="btn bs bsm" style="margin-top:8px" onclick="migrateToIDB()">📦 Migrate to IndexedDB</button>`;
    el.insertBefore(storageDiv, first);
    renderStorageQuota('backupQuotaEl');
  }
};

async function migrateToIDB() {
  if (!_idb) { toast('IndexedDB not available', 'rose'); return; }
  const ok = await confirm2('Migrate all data to IndexedDB for better performance and storage?', '📦');
  if (!ok) return;
  const count = await IDB.migrateFromLocal();
  saveSetting('storage_backend', 'idb');
  toast(`Migrated ${count} records to IndexedDB ✓`, 'emerald');
}

// ════════════════════════════════════════════
// PATCH: initApp — add Phase 1/3/4 init
// ════════════════════════════════════════════
const _origInitApp2 = initApp;
initApp = async function() {
  await _origInitApp2();
  // Phase 1: PWA
  initPWA();
  // Phase 3: IndexedDB
  await initIDB();
  // Phase 3: Restore crash cart
  restoreCrashCart();
  // Phase 3: Check storage on login
  setTimeout(checkStorageQuota, 3000);
};

// ════════════════════════════════════════════
// PATCH: FirebaseDB.init — add Auth + Functions
// ════════════════════════════════════════════
const _origFBInit = FirebaseDB.init.bind(FirebaseDB);
FirebaseDB.init = async function(config) {
  const result = await _origFBInit(config);
  if (result && _fb) {
    // Init Auth
    await initFBAuth(_fb.db.app);
    // Init Functions
    await initFBFunctions(_fb.db.app);
    // Show auth gate if not authenticated
    if (!_authUser && storageMode === 'firebase') {
      setTimeout(showAuthGate, 500);
    }
  }
  return result;
};

// ── CRITICAL: patch initApp BEFORE showLicGate ──
// showLicGate() → initApp(), so patch must come first
const _baseInit = initApp;
initApp = async function() {
  _baseInit();          // sync DB + localStorage setup
  await bootFirebase(); // reconnect Firebase if configured
  updateSyncBar();
};

// Apply saved font size immediately (before any screen renders)
try{applyFontSize(getFontSize());}catch(e){}
showLicGate(); // ✓ now calls the fully patched initApp

