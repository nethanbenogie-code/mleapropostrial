/* ============================================================
   MLEA POS v6.0 — 18-features.js
   Receipt logo, customer DB, barcode, email receipts
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */


// ════════════════════════════════════════════
// PHASE 4A: RECEIPT LOGO
// ════════════════════════════════════════════
function getLogoDataURL() { return getSetting('receipt_logo', ''); }

function renderLogoSettings(containerId) {
  const el = document.getElementById(containerId); if (!el) return;
  const logo = getLogoDataURL();
  el.innerHTML = `
    <h5>🖼️ Receipt Logo</h5>
    <p style="font-size:.78em;color:var(--text2);margin-bottom:10px">Shown on A4 receipts. PNG or JPG, ideally 300×100px.</p>
    ${logo ? `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
      <img src="${logo}" style="height:60px;max-width:160px;object-fit:contain;border-radius:var(--r1);border:1px solid var(--border);background:white;padding:4px">
      <button class="btn bd bxs" onclick="removeLogo()">Remove</button>
    </div>` : '<div class="logo-prev" style="margin-bottom:10px">🏪</div>'}
    <input type="file" id="logoFile" accept="image/*" onchange="uploadLogo(this)" style="margin-bottom:8px">
    <p style="font-size:.7em;color:var(--text3)">Max 200KB recommended (stored as base64)</p>`;
}

function uploadLogo(input) {
  const file = input.files[0]; if (!file) return;
  if (file.size > 500000) { toast('Image too large — max 500KB', 'rose'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    saveSetting('receipt_logo', e.target.result);
    toast('Logo saved ✓', 'emerald');
    renderLogoSettings('logoSettingsWrap');
  };
  reader.readAsDataURL(file);
}

function removeLogo() {
  saveSetting('receipt_logo', '');
  toast('Logo removed', 'gold');
  renderLogoSettings('logoSettingsWrap');
}

// ════════════════════════════════════════════
// PHASE 4B: CUSTOMER DATABASE
// ════════════════════════════════════════════
// customers is already in STORES array — no push needed

let activeCustomer = null; // currently selected customer for the sale

function renderCustomers(el) {
  const customers = DB.getAll('customers');
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h4 style="margin:0">👤 Customers</h4>
      <button class="btn bp bsm" onclick="showCustomerModal()">+ Add Customer</button>
    </div>
    <div class="pos-search" style="margin-bottom:12px"><input type="text" id="custSearch" placeholder="Search customers…" oninput="renderCustomers(document.getElementById('mainContent'))"></div>
    ${(() => {
      const q = document.getElementById('custSearch')?.value?.toLowerCase() || '';
      const filtered = customers.filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone||'').includes(q) || (c.email||'').toLowerCase().includes(q));
      if (!filtered.length) return '<div class="empty-st"><div class="ei">👤</div><p>No customers yet</p></div>';
      return filtered.map(c => `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong style="font-family:var(--ff)">${c.name}</strong>
            ${c.phone ? `<p style="font-size:.78em;color:var(--text2);margin-top:3px">📞 ${c.phone}</p>` : ''}
            ${c.email ? `<p style="font-size:.75em;color:var(--text2)">✉ ${c.email}</p>` : ''}
            <div style="margin-top:6px;display:flex;gap:8px;align-items:center">
              <span class="loyalty-pts">⭐ ${c.points || 0} pts</span>
              ${c.scPwd ? '<span class="rbadge rb-admin">SC/PWD</span>' : ''}
              ${c.tin ? `<span style="font-size:.65em;color:var(--text3);font-family:var(--fm)">TIN: ${c.tin}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn bw bxs" onclick="showCustomerModal(${c.id})">✎</button>
            <button class="btn bd bxs" onclick="deleteCustomer(${c.id})">🗑</button>
          </div>
        </div>
      </div>`).join('');
    })()}`;
}

function showCustomerModal(id) {
  const c = id ? DB.getById('customers', id) : null;
  openModal(`<h4>${c ? 'Edit' : 'Add'} Customer</h4>
    <label class="inp-label">Full Name *</label><input type="text" id="custN" value="${c ? c.name : ''}" placeholder="e.g. Maria Santos">
    <label class="inp-label">Phone</label><input type="tel" id="custP" value="${c ? c.phone || '' : ''}" placeholder="09XX-XXX-XXXX">
    <label class="inp-label">Email</label><input type="email" id="custE" value="${c ? c.email || '' : ''}" placeholder="maria@email.com">
    <label class="inp-label">TIN (for SC/PWD receipts)</label><input type="text" id="custTIN" value="${c ? c.tin || '' : ''}" placeholder="000-000-000-000">
    <label class="inp-label">Address</label><input type="text" id="custA" value="${c ? c.address || '' : ''}" placeholder="123 Main St">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <input type="checkbox" id="custSC" ${c && c.scPwd ? 'checked' : ''} style="width:auto;margin-bottom:0">
      <label style="font-size:.82em;color:var(--text2)">Senior Citizen / PWD (auto-apply 20% discount)</label>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn bd" onclick="closeModal()">Cancel</button>
      <button class="btn bp" onclick="saveCustomer(${id || 'null'})">Save Customer</button>
    </div>`);
}

function saveCustomer(id) {
  const name = document.getElementById('custN').value.trim();
  if (!name) { toast('Name is required', 'rose'); return; }
  const data = {
    name,
    phone: document.getElementById('custP').value || '',
    email: document.getElementById('custE').value || '',
    tin: document.getElementById('custTIN').value || '',
    address: document.getElementById('custA').value || '',
    scPwd: document.getElementById('custSC').checked,
    points: id ? (DB.getById('customers', id)?.points || 0) : 0,
  };
  if (id) { const c = DB.getById('customers', id); Object.assign(c, data); DB.update('customers', c); }
  else DB.add('customers', data);
  closeModal(); sw('customers'); toast('Customer saved ✓', 'emerald');
}

async function deleteCustomer(id) {
  const ok = await confirm2('Delete this customer record?', '👤', true);
  if (ok) { DB.delete('customers', id); sw('customers'); }
}

// Select customer for current sale
function selectCustomerForSale() {
  const customers = DB.getAll('customers');
  openModal(`<h4>👤 Select Customer</h4>
    <div class="pos-search" style="margin-bottom:10px"><input type="text" id="custSrch" placeholder="Search by name or phone…" oninput="filterCustomerList()"></div>
    <div id="custList" style="max-height:300px;overflow-y:auto">
      ${customers.map(c => `<div class="card" style="cursor:pointer;margin:6px 0;padding:12px" onclick="attachCustomer(${c.id})">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong style="font-family:var(--ff)">${c.name}</strong>${c.phone ? `<span style="font-size:.75em;color:var(--text2);margin-left:8px">${c.phone}</span>` : ''}
          <div style="margin-top:4px"><span class="loyalty-pts">⭐ ${c.points || 0} pts</span>${c.scPwd ? ' <span class="rbadge rb-admin" style="font-size:.6em">SC/PWD</span>' : ''}</div>
          </div>
          <span style="color:var(--gold);font-size:1.2em">→</span>
        </div>
      </div>`).join('') || '<div class="empty-st" style="padding:20px"><div class="ei">👤</div><p>No customers</p></div>'}
    </div>
    ${activeCustomer ? `<button class="btn bd bbl" onclick="attachCustomer(null)" style="margin-top:8px">✕ Remove Customer</button>` : ''}
    <button class="btn bw bbl" onclick="closeModal();showCustomerModal()" style="margin-top:0">+ Add New Customer</button>
    <button class="btn bd bbl" onclick="closeModal()" style="margin-top:0">Cancel</button>`);
}

function filterCustomerList() {
  const q = document.getElementById('custSrch')?.value?.toLowerCase() || '';
  const customers = DB.getAll('customers').filter(c => !q || c.name.toLowerCase().includes(q) || (c.phone || '').includes(q));
  const list = document.getElementById('custList');
  if (!list) return;
  list.innerHTML = customers.map(c => `<div class="card" style="cursor:pointer;margin:6px 0;padding:12px" onclick="attachCustomer(${c.id})">
    <strong style="font-family:var(--ff)">${c.name}</strong>${c.phone ? `<span style="font-size:.75em;color:var(--text2);margin-left:8px">${c.phone}</span>` : ''}
    <div style="margin-top:4px"><span class="loyalty-pts">⭐ ${c.points || 0} pts</span>${c.scPwd ? ' <span class="rbadge rb-admin" style="font-size:.6em">SC/PWD</span>' : ''}</div>
  </div>`).join('') || '<p style="text-align:center;color:var(--text3);padding:16px;font-size:.82em">No customers found</p>';
}

function attachCustomer(id) {
  closeModal();
  if (!id) { activeCustomer = null; renderPOS(document.getElementById('mainContent')); return; }
  activeCustomer = DB.getById('customers', id);
  // Auto-apply SC/PWD discount if customer is flagged
  if (activeCustomer?.scPwd && discType === 'none') {
    const sub = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
    discType = 'sc'; discAmt = sub * 0.20;
    toast(`👴 SC/PWD discount applied for ${activeCustomer.name}`, 'gold');
  }
  renderPOS(document.getElementById('mainContent'));
}

// Award loyalty points after sale
function awardLoyaltyPoints(customerId, saleTotal) {
  if (!customerId) return;
  const pts = Math.floor(saleTotal); // 1 point per peso
  const c = DB.getById('customers', customerId);
  if (c) { c.points = (c.points || 0) + pts; DB.update('customers', c); }
  return pts;
}

// ════════════════════════════════════════════
// PHASE 4C: BARCODE GENERATION ON RECEIPT
// ════════════════════════════════════════════
// Uses bwip-js CDN (offline-capable after first load via service worker)
async function loadBwipJS() {
  if (window.bwipjs) return true;
  return new Promise(resolve => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/bwip-js@3/dist/bwip-js-min.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

async function generateBarcodeDataURL(text, type = 'code128') {
  const loaded = await loadBwipJS();
  if (!loaded) return '';
  try {
    const canvas = document.createElement('canvas');
    bwipjs.toCanvas(canvas, { bcid: type, text: String(text), scale: 2, height: 8, includetext: false });
    return canvas.toDataURL('image/png');
  } catch (e) { return ''; }
}

// ════════════════════════════════════════════
// PHASE 4D: EMAIL RECEIPT (EmailJS)
// ════════════════════════════════════════════
async function sendEmailReceipt(sale, email) {
  const svcId = getSetting('emailjs_service', '');
  const tplId = getSetting('emailjs_template', '');
  const pubKey = getSetting('emailjs_pubkey', '');
  if (!svcId || !tplId || !pubKey) {
    toast('Email not configured. Set up EmailJS in Settings.', 'rose', 5000);
    return false;
  }
  // Load EmailJS on demand
  if (!window.emailjs) {
    await new Promise(resolve => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
      s.onload = resolve; document.head.appendChild(s);
    });
    emailjs.init(pubKey);
  }
  const bir = getBIR();
  try {
    await emailjs.send(svcId, tplId, {
      to_email: email,
      to_name: activeCustomer?.name || 'Valued Customer',
      store_name: bir.name,
      store_address: bir.address,
      store_tin: bir.tin,
      or_number: sale.orNumber || '#' + sale.id,
      sale_date: sale.date,
      cashier: sale.cashierName,
      total: fc(sale.total),
      payment_method: sale.paymentMethod.toUpperCase(),
      items_list: (sale.items || []).map(i => `${i.name} x${i.quantity} @ ${fc(i.price)} = ${fc(i.price * i.quantity)}`).join('\n'),
    });
    toast('Receipt emailed to ' + email + ' ✓', 'emerald');
    return true;
  } catch (e) {
    toast('Email failed: ' + e.text, 'rose');
    return false;
  }
}

async function promptEmailReceipt(sale) {
  const defaultEmail = activeCustomer?.email || '';
  const email = await prompt2('Send receipt to email:', 'customer@email.com', defaultEmail, 'email');
  if (!email) return;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast('Invalid email address', 'rose'); return; }
  await sendEmailReceipt(sale, email);
}
