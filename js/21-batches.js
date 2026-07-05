/* ============================================================
   MLEA POS v6.0 — 21-batches.js
   Batch / lot tracking with expiry dates + FEFO consumption
   (pharmacy-grade inventory).

   MUST LOAD LAST (after 19-patches.js AND 20-trial.js) — it
   wraps the final versions of _finalizePay, receivePO,
   processReturn, addToCart, adjStock and renderSidebar.

   Data model — new collection `batches`:
     { id, productId, lot, expiry (YYYY-MM-DD or null),
       qtyReceived, qtyRemaining, cost, receivedDate,
       poId (or null), branchId, source }
   `source`: 'po' | 'opening' | 'adjustment' | 'return'

   Sales record which lots were consumed on each sale item:
     sale.items[n].lots = [{batchId, lot, expiry, qty}]
   so returns can restore stock to the correct batch.
   ============================================================ */

// ════════════════════════════════════════════
// 0. REGISTER COLLECTION
// ════════════════════════════════════════════
if (!STORES.includes('batches')) STORES.push('batches');
LocalDB.init(); // idempotent — only creates missing keys

// Expiry warning window (days). Stored in settings like lowStockThresh.
var expiryWarnDays = parseInt(getSetting('expiryWarnDays', '30')) || 30;

// ════════════════════════════════════════════
// 1. HELPERS
// ════════════════════════════════════════════
function _batToday() { return new Date().toISOString().split('T')[0]; }

function batchIsExpired(b) { return !!b.expiry && b.expiry < _batToday(); }

function batchDaysLeft(b) {
  if (!b.expiry) return null;
  return Math.ceil((new Date(b.expiry + 'T00:00:00') - new Date(_batToday() + 'T00:00:00')) / 86400000);
}

// All batches with remaining qty for a product, FEFO order:
// earliest expiry first, no-expiry batches last.
function getProductBatches(pid) {
  return DB.getAll('batches')
    .filter(b => b.productId === pid && (b.qtyRemaining || 0) > 0)
    .sort((a, b2) => {
      if (!a.expiry && !b2.expiry) return (a.id || 0) - (b2.id || 0);
      if (!a.expiry) return 1;
      if (!b2.expiry) return -1;
      return a.expiry < b2.expiry ? -1 : a.expiry > b2.expiry ? 1 : 0;
    });
}

function batchTotalFor(pid) {
  return getProductBatches(pid).reduce((s, b) => s + (b.qtyRemaining || 0), 0);
}

function createBatch(data) {
  return DB.add('batches', {
    productId: data.productId,
    lot: data.lot || '',
    expiry: data.expiry || null,          // null = unknown / non-perishable
    qtyReceived: data.qty,
    qtyRemaining: data.qty,
    cost: data.cost || 0,
    receivedDate: data.receivedDate || _batToday(),
    poId: data.poId || null,
    branchId: data.branchId != null ? data.branchId : (currentUser ? currentUser.branchId : null),
    source: data.source || 'po'
  });
}

// FEFO consumption. Deducts qty across batches (fresh first, then
// expired as last resort so batch totals stay in sync with p.stock,
// which _finalizePay already decremented). Returns:
//   { lots:[{batchId,lot,expiry,qty}], usedExpired, shortfall }
function consumeFEFO(productId, qty) {
  let remaining = qty;
  const lots = [];
  let usedExpired = false;
  const batches = getProductBatches(productId);
  const passes = [batches.filter(b => !batchIsExpired(b)), batches.filter(b => batchIsExpired(b))];
  for (let pass = 0; pass < 2 && remaining > 0; pass++) {
    for (const b of passes[pass]) {
      if (remaining <= 0) break;
      const take = Math.min(b.qtyRemaining, remaining);
      if (take <= 0) continue;
      b.qtyRemaining -= take;
      DB.update('batches', b);
      lots.push({ batchId: b.id, lot: b.lot, expiry: b.expiry, qty: take });
      if (pass === 1) usedExpired = true;
      remaining -= take;
    }
  }
  return { lots, usedExpired, shortfall: remaining }; // shortfall>0 = untracked stock was sold
}

// Restore quantities to the exact lots a sale consumed (for returns).
// Items without lot info go into a 'return' batch (expiry unknown → review).
function restoreLots(items) {
  (items || []).forEach(item => {
    if (item.lots && item.lots.length) {
      item.lots.forEach(l => {
        const b = DB.getById('batches', l.batchId);
        if (b) { b.qtyRemaining += l.qty; DB.update('batches', b); }
        else createBatch({ productId: item.productId, lot: l.lot, expiry: l.expiry, qty: l.qty, source: 'return' });
      });
    } else if (item.productId) {
      createBatch({ productId: item.productId, lot: 'RETURN', expiry: null, qty: item.quantity, source: 'return' });
    }
  });
}

function getExpiringBatches(days) {
  const d = days == null ? expiryWarnDays : days;
  return DB.getAll('batches').filter(b => {
    if ((b.qtyRemaining || 0) <= 0 || !b.expiry) return false;
    const left = batchDaysLeft(b);
    return left >= 0 && left <= d;
  });
}
function getExpiredBatches() {
  return DB.getAll('batches').filter(b => (b.qtyRemaining || 0) > 0 && batchIsExpired(b));
}

// ════════════════════════════════════════════
// 2. SALES → FEFO DEDUCTION
//    Wrap whatever _finalizePay currently is
//    (19-patches' version, possibly already
//    wrapped by 20-trial's guard).
// ════════════════════════════════════════════
(function () {
  const _origFinalizePay = _finalizePay;
  _finalizePay = async function (method, cashTendered, secondAmt) {
    const cartSnapshot = cart.map(i => ({ id: i.id, quantity: i.quantity }));
    const prevSaleId = lastSale ? lastSale.id : null;
    await _origFinalizePay.apply(this, arguments);
    // Only proceed if a NEW sale was actually recorded
    if (!lastSale || lastSale.id === prevSaleId) return;
    let warnedExpired = false;
    const lotsByProduct = {};
    cartSnapshot.forEach(ci => {
      const res = consumeFEFO(ci.id, ci.quantity);
      lotsByProduct[ci.id] = res.lots;
      if (res.usedExpired && !warnedExpired) {
        warnedExpired = true;
        toast('⚠️ Sale included stock from an EXPIRED lot — check Batches view', 'rose', 6000);
      }
    });
    // Attach consumed lots to the stored sale for return traceability
    const saleRec = DB.getById('sales', lastSale.id);
    if (saleRec && saleRec.items) {
      saleRec.items.forEach(it => { if (lotsByProduct[it.productId]) it.lots = lotsByProduct[it.productId]; });
      DB.update('sales', saleRec);
    }
  };
})();

// ════════════════════════════════════════════
// 3. PO RECEIVING → CAPTURE LOT + EXPIRY
// ════════════════════════════════════════════
(function () {
  const _origReceivePO = receivePO;
  receivePO = async function (id) {
    const before = DB.getById('purchaseOrders', id);
    const wasReceived = before && before.status === 'received';
    await _origReceivePO.apply(this, arguments);
    const after = DB.getById('purchaseOrders', id);
    if (!after || after.status !== 'received' || wasReceived) return; // cancelled or already done
    showBatchIntakeModal(after);
  };
})();

function showBatchIntakeModal(po) {
  const items = (po.items || []).map((item, i) => {
    let product = item.productId ? DB.getById('products', item.productId) : null;
    if (!product) product = getMyData('products').find(p => p.name.toLowerCase() === item.name.toLowerCase());
    return { item, product, i };
  }).filter(x => x.product);
  if (!items.length) return;
  openModal(`<h4>📦 Lot & Expiry Intake — PO #${po.id}</h4>
    <p style="font-size:.78em;color:var(--text2);margin-bottom:12px">Record the lot number and expiry date printed on each received item. Leave expiry blank for non-perishables.</p>
    ${items.map(x => `
      <div style="border:1px solid var(--border);border-radius:var(--r1);padding:10px;margin-bottom:8px">
        <div style="font-weight:600;font-size:.85em;margin-bottom:6px">${x.product.name} <span style="color:var(--text3)">× ${x.item.quantity}</span></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div><label class="inp-label">Lot / Batch No.</label><input type="text" id="batLot${x.i}" placeholder="e.g. LOT-2412A" style="margin-bottom:0"></div>
          <div><label class="inp-label">Expiry Date</label><input type="date" id="batExp${x.i}" style="margin-bottom:0"></div>
        </div>
      </div>`).join('')}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
      <button class="btn bd" onclick="saveBatchIntake(${po.id},true)">Skip (track without expiry)</button>
      <button class="btn bp" onclick="saveBatchIntake(${po.id},false)">Save Batches</button>
    </div>`);
}

function saveBatchIntake(poId, skip) {
  const po = DB.getById('purchaseOrders', poId);
  if (!po) { closeModal(); return; }
  (po.items || []).forEach((item, i) => {
    let product = item.productId ? DB.getById('products', item.productId) : null;
    if (!product) product = getMyData('products').find(p => p.name.toLowerCase() === item.name.toLowerCase());
    if (!product) return;
    const lotEl = document.getElementById('batLot' + i), expEl = document.getElementById('batExp' + i);
    createBatch({
      productId: product.id,
      lot: skip ? '' : (lotEl ? lotEl.value.trim() : ''),
      expiry: skip ? null : (expEl && expEl.value ? expEl.value : null),
      qty: item.quantity, cost: item.cost || 0, poId, source: 'po',
      branchId: product.branchId
    });
  });
  logAct('Batch Intake', 'PO #' + poId);
  closeModal(); toast('Batches recorded ✓', 'emerald');
}

// ════════════════════════════════════════════
// 4. RETURNS → RESTORE THE RIGHT LOTS
// ════════════════════════════════════════════
(function () {
  const _origProcessReturn = processReturn;
  processReturn = async function () {
    const beforeCount = DB.getAll('returns').length;
    await _origProcessReturn.apply(this, arguments);
    const all = DB.getAll('returns');
    if (all.length <= beforeCount) return; // return didn't go through
    const rec = all.reduce((a, b) => ((a.id || 0) > (b.id || 0) ? a : b));
    restoreLots(rec.items);
  };
})();

// ════════════════════════════════════════════
// 5. POS GUARD — WARN WHEN ONLY EXPIRED STOCK
// ════════════════════════════════════════════
(function () {
  const _origAddToCart = addToCart;
  addToCart = function (sku) {
    _origAddToCart.apply(this, arguments);
    if (!sku) return;
    const p = getMyData('products').find(pr => (pr.sku === sku || pr.barcode === sku) && pr.active);
    if (!p || p.stock <= 0) return;
    const batches = getProductBatches(p.id);
    if (!batches.length) return; // untracked legacy stock — no expiry info
    const fresh = batches.filter(b => !batchIsExpired(b)).reduce((s, b) => s + b.qtyRemaining, 0);
    const inCart = (cart.find(i => i.id === p.id) || {}).quantity || 0;
    if (fresh <= 0) toast(`⛔ All remaining stock of "${p.name}" is EXPIRED`, 'rose', 5000);
    else if (inCart > fresh) toast(`⚠️ Only ${fresh} non-expired unit(s) of "${p.name}" left`, 'gold', 4000);
  };
})();

// ════════════════════════════════════════════
// 6. MANUAL STOCK ADJUST → KEEP BATCHES IN SYNC
// ════════════════════════════════════════════
(function () {
  const _origAdjStock = adjStock;
  adjStock = async function (id) {
    await _origAdjStock.apply(this, arguments);
    const p = DB.getById('products', id);
    if (p) syncBatchesToStock(p);
  };
})();

// Reconcile batch totals with p.stock. Increase → 'adjustment' batch
// (unknown expiry, flagged for review). Decrease → FEFO write-down.
function syncBatchesToStock(p) {
  const total = batchTotalFor(p.id);
  const diff = (p.stock || 0) - total;
  if (diff === 0) return;
  if (diff > 0) {
    createBatch({ productId: p.id, lot: 'ADJ', expiry: null, qty: diff, source: 'adjustment', branchId: p.branchId });
  } else {
    consumeFEFO(p.id, -diff);
  }
}

// ════════════════════════════════════════════
// 7. BATCHES / EXPIRY VIEW
// ════════════════════════════════════════════
let _batFilter = 'all'; // all | warn | expired | mismatch

function renderBatches(el) {
  const prods = getMyData('products');
  const prodById = {}; prods.forEach(p => prodById[p.id] = p);
  let batches = DB.getAll('batches').filter(b => (b.qtyRemaining || 0) > 0 && prodById[b.productId]);
  if (currentUser.role !== 'admin' && currentUser.branchId)
    batches = batches.filter(b => !b.branchId || b.branchId === currentUser.branchId);

  const expired = batches.filter(batchIsExpired);
  const warn = batches.filter(b => !batchIsExpired(b) && b.expiry && batchDaysLeft(b) <= expiryWarnDays);
  const mismatches = prods.filter(p => p.active && (p.stock || 0) !== batchTotalFor(p.id));

  let show = batches;
  if (_batFilter === 'warn') show = warn;
  else if (_batFilter === 'expired') show = expired;
  show = [...show].sort((a, b) => {
    if (!a.expiry && !b.expiry) return 0;
    if (!a.expiry) return 1; if (!b.expiry) return -1;
    return a.expiry < b.expiry ? -1 : 1;
  });

  const tab = (key, label, cnt, color) => `<button onclick="_batFilter='${key}';sw('batches')" style="padding:6px 12px;border-radius:8px;border:1px solid ${_batFilter === key ? 'var(--gold)' : 'var(--border)'};background:${_batFilter === key ? 'var(--gold-soft)' : 'var(--bg-glass)'};color:${_batFilter === key ? 'var(--gold)' : 'var(--text2)'};cursor:pointer;font-size:.72em;font-weight:600;font-family:var(--ff)">${label}${cnt ? ` <span style="color:${color}">(${cnt})</span>` : ''}</button>`;

  let html = `<div class="pg-hdr"><div><h2>🧪 Batches & Expiry</h2><p>Lot-level stock with FEFO tracking · warning window: ${expiryWarnDays} days
    <span style="cursor:pointer;color:var(--gold)" onclick="editExpiryWarnDays()">✏️ change</span></p></div></div>`;

  if (mismatches.length) {
    html += `<div style="border:1px solid rgba(240,101,119,.4);background:var(--bg-elevated);border-radius:var(--r2);padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <span style="font-size:1.2em">⚠️</span>
      <div style="flex:1;min-width:200px"><strong style="font-size:.85em;color:var(--rose)">${mismatches.length} product(s) out of sync with batches</strong>
      <div style="font-size:.72em;color:var(--text2)">Stock changed outside batch tracking (legacy data, direct edits). Reconcile creates adjustment lots / FEFO write-downs.</div></div>
      <button class="btn bp bsm" onclick="reconcileAllBatches()">Reconcile All</button></div>`;
  }

  html += `<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
    ${tab('all', 'All Lots', batches.length, 'var(--text2)')}
    ${tab('warn', '⏳ Expiring ≤' + expiryWarnDays + 'd', warn.length, 'var(--gold)')}
    ${tab('expired', '⛔ Expired', expired.length, 'var(--rose)')}
  </div>`;

  if (show.length) {
    html += `<div class="card" style="overflow-x:auto"><table><thead><tr>
      <th>Product</th><th>Lot</th><th>Expiry</th><th>Days</th><th>Remaining</th><th>Received</th><th>Source</th><th></th>
    </tr></thead><tbody>
    ${show.map(b => {
      const p = prodById[b.productId];
      const left = batchDaysLeft(b);
      const exp = batchIsExpired(b);
      const col = exp ? 'var(--rose)' : (left != null && left <= expiryWarnDays ? 'var(--gold)' : 'var(--text2)');
      return `<tr>
        <td>${p.name}</td>
        <td style="font-family:var(--fm);font-size:.85em">${b.lot || '—'}</td>
        <td style="color:${col}">${b.expiry || '—'}</td>
        <td style="color:${col}">${left == null ? '—' : exp ? 'EXPIRED' : left + 'd'}</td>
        <td>${b.qtyRemaining}</td>
        <td style="font-size:.8em;color:var(--text3)">${b.receivedDate || ''}</td>
        <td style="font-size:.75em;color:${b.source === 'adjustment' || b.source === 'return' ? 'var(--gold)' : 'var(--text3)'}">${b.source || 'po'}</td>
        <td style="white-space:nowrap">
          <button class="btn bw bxs" onclick="editBatch(${b.id})" title="Edit lot/expiry">✏️</button>
          ${exp ? `<button class="btn bd bxs" onclick="writeOffBatch(${b.id})" title="Write off expired stock">🗑 Write off</button>` : ''}
        </td></tr>`;
    }).join('')}
    </tbody></table></div>`;
  } else {
    html += `<div class="empty-st"><div class="ei">🧪</div><p>${batches.length ? 'No lots match this filter' : 'No batches yet — they are created when you receive Purchase Orders, or via Reconcile.'}</p></div>`;
  }
  el.innerHTML = html;
}

async function editExpiryWarnDays() {
  const v = await prompt2('Warn when stock expires within how many days?', String(expiryWarnDays), String(expiryWarnDays), 'number');
  const n = parseInt(v);
  if (isNaN(n) || n < 1) return;
  expiryWarnDays = n; saveSetting('expiryWarnDays', String(n));
  sw('batches'); toast('Saved ✓', 'emerald');
}

function editBatch(id) {
  const b = DB.getById('batches', id); if (!b) return;
  const p = DB.getById('products', b.productId);
  openModal(`<h4>Edit Lot — ${p ? p.name : ''}</h4>
    <label class="inp-label">Lot / Batch No.</label><input type="text" id="ebLot" value="${(b.lot || '').replace(/"/g, '&quot;')}">
    <label class="inp-label">Expiry Date</label><input type="date" id="ebExp" value="${b.expiry || ''}">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
      <button class="btn bd" onclick="closeModal()">Cancel</button>
      <button class="btn bp" onclick="saveBatchEdit(${id})">Save</button>
    </div>`);
}
function saveBatchEdit(id) {
  const b = DB.getById('batches', id); if (!b) { closeModal(); return; }
  b.lot = document.getElementById('ebLot').value.trim();
  b.expiry = document.getElementById('ebExp').value || null;
  DB.update('batches', b);
  logAct('Batch Edit', (b.lot || '#' + id));
  closeModal(); sw('batches'); toast('Lot updated ✓', 'emerald');
}

async function writeOffBatch(id) {
  const b = DB.getById('batches', id); if (!b) return;
  const p = DB.getById('products', b.productId);
  const ok = await confirm2(`Write off ${b.qtyRemaining} unit(s) of "${p ? p.name : '?'}" (lot ${b.lot || '—'}, expired ${b.expiry})?\nThis removes them from sellable stock.`, '🗑', true);
  if (!ok) return;
  const qty = b.qtyRemaining;
  b.qtyRemaining = 0; DB.update('batches', b);
  if (p) { p.stock = Math.max(0, (p.stock || 0) - qty); DB.update('products', p); }
  logAct('Expired Write-off', (p ? p.name : '?') + ' × ' + qty + ' (lot ' + (b.lot || '—') + ')');
  sw('batches'); toast('Written off — stock reduced by ' + qty, 'emerald');
}

async function reconcileAllBatches() {
  const prods = getMyData('products').filter(p => p.active && (p.stock || 0) !== batchTotalFor(p.id));
  const ok = await confirm2(`Reconcile ${prods.length} product(s)? Missing quantities become 'ADJ' lots without expiry (edit them after); surpluses are written down FEFO.`, '🔄');
  if (!ok) return;
  prods.forEach(syncBatchesToStock);
  logAct('Batch Reconcile', prods.length + ' products');
  sw('batches'); toast('Reconciled ✓ — review ADJ lots and set expiry dates', 'emerald');
}

// ════════════════════════════════════════════
// 8. REGISTER VIEW + SIDEBAR + STARTUP TOAST
// ════════════════════════════════════════════
viewMap.batches = renderBatches;

(function () {
  const _origRenderSidebar2 = renderSidebar;
  renderSidebar = function () {
    _origRenderSidebar2();
    const nav = document.getElementById('sbNav');
    if (!nav || !currentUser) return;
    if ((currentUser.role === 'admin' || currentUser.role === 'manager') && !nav.innerHTML.includes("sw('batches')")) {
      const expCnt = getExpiredBatches().length + getExpiringBatches().length;
      const badge = expCnt ? `<span class="nb" style="background:var(--rose-soft);color:var(--rose)">${expCnt}</span>` : '';
      const item = `<div class="sb-item" onclick="sw('batches')"><span class="sb-icon">🧪</span>Batches & Expiry${badge}</div>`;
      // Insert right after Purchase Orders when possible, else append
      if (nav.innerHTML.includes("sw('purchaseOrders')")) {
        nav.innerHTML = nav.innerHTML.replace(
          /(<div class="sb-item" onclick="sw\('purchaseOrders'\)">.*?<\/div>)/,
          '$1' + item
        );
      } else nav.innerHTML += item;
    }
    showExpiryToastOnce();
  };
})();

let _expiryToastShown = false;
function showExpiryToastOnce() {
  if (_expiryToastShown || !currentUser) return;
  if (currentUser.role !== 'admin' && currentUser.role !== 'manager') return;
  _expiryToastShown = true;
  setTimeout(() => {
    const expired = getExpiredBatches(), warn = getExpiringBatches();
    if (!expired.length && !warn.length) return;
    const parts = [];
    if (expired.length) parts.push(expired.length + ' expired lot' + (expired.length > 1 ? 's' : ''));
    if (warn.length) parts.push(warn.length + ' expiring ≤' + expiryWarnDays + 'd');
    toast('🧪 ' + parts.join(' · ') + ' — see Batches & Expiry', expired.length ? 'rose' : 'gold', 7000);
  }, 2500);
}
