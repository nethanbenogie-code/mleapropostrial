/* ============================================================
   MLEA POS v6.0 — 09-inventory.js
   Branches, suppliers, purchase orders, products (search+pagination)
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */

// ════════════════════════════════════════════
// BRANCHES
// ════════════════════════════════════════════
function renderBranches(el){
  if(currentUser.role!=='admin'){el.innerHTML='<div class="empty-st"><div class="ei">🔒</div><p>Admin only</p></div>';return;}
  const branches=DB.getAll('branches');
  el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><h4 style="margin:0">Branches</h4><button class="btn bp bsm" onclick="showAddBranchModal()">+ Add Branch</button></div>
  ${branches.map(b=>{const bu=LocalDB.getByBranch('users',b.id);return`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><strong style="font-family:var(--ff)">${b.name}</strong>
      <p style="color:var(--text2);font-size:.78em;margin-top:4px">${b.address||'No address'}</p>
      <p style="color:var(--text2);font-size:.75em">${b.phone||'No phone'} · ${bu.length} user${bu.length!==1?'s':''}</p></div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        <button class="btn bs bxs" onclick="addBranchUser(${b.id})">+ User</button>
        <button class="btn bd bxs" onclick="deleteBranch(${b.id})">🗑</button>
      </div>
    </div>
  </div>`;}).join('')}`;
}
function showAddBranchModal(){
  openModal(`<h4>Add Branch</h4>
    <label class="inp-label">Branch Name *</label><input type="text" id="mi1" placeholder="e.g. South Branch">
    <label class="inp-label">Address</label><input type="text" id="mi2" placeholder="e.g. 456 South St">
    <label class="inp-label">Phone</label><input type="tel" id="mi3" placeholder="e.g. 555-1234">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
      <button class="btn bd" onclick="closeModal()">Cancel</button>
      <button class="btn bp" onclick="addBranch()">Create Branch</button>
    </div>`);
}
function addBranch(){
  const name=document.getElementById('mi1').value.trim();
  if(!name){toast('Branch name is required','rose');return;}
  DB.add('branches',{name,address:document.getElementById('mi2').value||'',phone:document.getElementById('mi3').value||''});
  closeModal();sw('branches');toast('Branch created ✓','emerald');
}
async function deleteBranch(id){
  const ok=await confirm2('Delete this branch? Users assigned to it will not be deleted.','🏢',true);
  if(ok){DB.delete('branches',id);sw('branches');}
}
async function addBranchUser(bid){
  const name=await prompt2('New user name:','e.g. Juan dela Cruz');if(!name)return;
  const pin=await prompt2('4-digit PIN:','e.g. 1234');if(!pin||pin.length!==4){toast('PIN must be exactly 4 digits','rose');return;}
  const role=await prompt2('Role (cashier or manager):','cashier','cashier');
  const finalRole=(role||'cashier').toLowerCase().includes('manager')?'manager':'cashier';
  DB.add('users',{name,role:finalRole,active:true,pin,branchId:bid});
  sw('branches');toast(name+' added as '+finalRole+' ✓','emerald');
}

// ════════════════════════════════════════════
// SUPPLIERS
// ════════════════════════════════════════════
function renderSuppliers(el){
  const suppliers=DB.getAll('suppliers');
  el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><h4 style="margin:0">Suppliers</h4><button class="btn bp bsm" onclick="showSupplierModal()">+ Add</button></div>
  ${suppliers.map(s=>`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><strong style="font-family:var(--ff)">${s.name}</strong>
      ${s.contact?`<p style="font-size:.78em;color:var(--text2);margin-top:3px">👤 ${s.contact}</p>`:''}
      ${s.phone?`<p style="font-size:.75em;color:var(--text2)">📞 ${s.phone}</p>`:''}
      ${s.email?`<p style="font-size:.72em;color:var(--text2)">✉ ${s.email}</p>`:''}</div>
      <div style="display:flex;gap:6px">
        <button class="btn bw bxs" onclick="showSupplierModal(${s.id})">✎</button>
        <button class="btn bd bxs" onclick="deleteSupplier(${s.id})">🗑</button>
      </div>
    </div>
  </div>`).join('')}
  ${!suppliers.length?'<div class="empty-st"><div class="ei">🚚</div><p>No suppliers yet</p></div>':''}`;
}
function showSupplierModal(id){
  const s=id?DB.getById('suppliers',id):null;
  openModal(`<h4>${s?'Edit':'Add'} Supplier</h4>
    <label class="inp-label">Supplier Name *</label><input type="text" id="mi1" value="${s?s.name:''}" placeholder="e.g. ABC Trading">
    <label class="inp-label">Contact Person</label><input type="text" id="mi2" value="${s?s.contact||'':''}" placeholder="e.g. Maria Santos">
    <label class="inp-label">Phone</label><input type="tel" id="mi3" value="${s?s.phone||'':''}" placeholder="555-0001">
    <label class="inp-label">Email</label><input type="email" id="mi4" value="${s?s.email||'':''}" placeholder="supplier@email.com">
    <label class="inp-label">Address</label><input type="text" id="mi5" value="${s?s.address||'':''}" placeholder="123 Supplier St">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
      <button class="btn bd" onclick="closeModal()">Cancel</button>
      <button class="btn bp" onclick="saveSupplier(${id||'null'})">Save</button>
    </div>`);
}
function saveSupplier(id){
  const name=document.getElementById('mi1').value.trim();if(!name){toast('Name required','rose');return;}
  const data={name,contact:document.getElementById('mi2').value||'',phone:document.getElementById('mi3').value||'',email:document.getElementById('mi4').value||'',address:document.getElementById('mi5').value||''};
  if(id){const s=DB.getById('suppliers',id);Object.assign(s,data);DB.update('suppliers',s);}
  else DB.add('suppliers',data);
  closeModal();sw('suppliers');toast('Saved ✓','emerald');
}
async function deleteSupplier(id){
  const ok=await confirm2('Delete this supplier?','🚚',true);
  if(ok){DB.delete('suppliers',id);sw('suppliers');}
}

// ════════════════════════════════════════════
// PURCHASE ORDERS
// ════════════════════════════════════════════
function renderPOs(el){
  const pos=currentUser.role==='admin'?DB.getAll('purchaseOrders'):getMyData('purchaseOrders');
  const suppliers=DB.getAll('suppliers');
  const sc={draft:'var(--text2)',ordered:'var(--gold)',received:'var(--emerald)'};
  el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px"><h4 style="margin:0">Purchase Orders</h4><button class="btn bp bsm" onclick="showPOModal()">+ New PO</button></div>
  ${pos.slice().reverse().map(po=>{const s=suppliers.find(sp=>sp.id===po.supplierId);return`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><strong style="font-family:var(--ff)">PO #${po.id}</strong>
      <p style="font-size:.76em;color:var(--text2);margin-top:3px">${s?s.name:'N/A'} · ${po.date||po.createdAt?.split('T')[0]}</p>
      <p style="font-size:.72em;margin-top:2px">${(po.items||[]).length} items</p></div>
      <div style="text-align:right">
        <div style="font-family:var(--ff);color:var(--gold);font-weight:700">${fc(po.total||0)}</div>
        <div style="font-size:.7em;color:${sc[po.status]||'var(--text2)'};font-weight:600;text-transform:uppercase">${po.status||'draft'}</div>
      </div>
    </div>
    <div style="margin-top:10px;display:flex;gap:6px">
      ${po.status!=='received'?`<button class="btn bs bxs" onclick="receivePO(${po.id})">✓ Receive</button>`:''}
      <button class="btn bd bxs" onclick="deletePO(${po.id})">🗑</button>
    </div>
  </div>`;}).join('')}
  ${!pos.length?'<div class="empty-st"><div class="ei">📋</div><p>No purchase orders</p></div>':''}`;
}
function showPOModal(){
  const suppliers=DB.getAll('suppliers');
  openModal(`<h4>New Purchase Order</h4>
    <label class="inp-label">Supplier</label>
    <select id="mi0"><option value="">Select Supplier</option>${suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select>
    <label class="inp-label">Item Name</label><input type="text" id="mi1" placeholder="e.g. Rice 50kg">
    <label class="inp-label">Quantity</label><input type="number" id="mi2" value="1" min="1">
    <label class="inp-label">Cost per Unit</label><input type="number" id="mi3" step="0.01" placeholder="0.00">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
      <button class="btn bd" onclick="closeModal()">Cancel</button>
      <button class="btn bp" onclick="savePO()">Create Order</button>
    </div>`);
}
function savePO(){
  const supplierId=parseInt(document.getElementById('mi0').value)||null;
  const n=document.getElementById('mi1').value,q=parseInt(document.getElementById('mi2').value)||0,c=parseFloat(document.getElementById('mi3').value)||0;
  // Try to match existing product for productId linkage
  const matchedProd=getMyData('products').find(p=>p.name.toLowerCase()===n.toLowerCase());
  const items=n&&q>0?[{name:n,quantity:q,cost:c,total:q*c,productId:matchedProd?matchedProd.id:null}]:[];
  const total=items.reduce((s,i)=>s+i.total,0);
  DB.add('purchaseOrders',{supplierId,items,total,status:'ordered',date:new Date().toISOString().split('T')[0],branchId:currentUser.branchId});
  closeModal();sw('purchaseOrders');toast('Purchase order created ✓','emerald');
}
async function receivePO(id){
  const po=DB.getById('purchaseOrders',id);if(!po)return;
  const ok=await confirm2('Mark PO #'+id+' as received? This will add stock to matching products.','📦');
  if(!ok)return;
  po.status='received';DB.update('purchaseOrders',po);
  (po.items||[]).forEach(item=>{
    // Match by productId first (accurate), fall back to name (legacy)
    let product=item.productId?DB.getById('products',item.productId):null;
    if(!product)product=getMyData('products').find(p=>p.name.toLowerCase()===item.name.toLowerCase());
    if(product){product.stock+=item.quantity;product.cost=item.cost;DB.update('products',product);}
    else toast('⚠️ Product not found for PO item: '+item.name,'rose',5000);
  });
  logAct('PO Received','#'+id);sw('purchaseOrders');toast('PO received — stock updated ✓','emerald');
}
async function deletePO(id){
  const ok=await confirm2('Delete this purchase order?','📋',true);
  if(ok){DB.delete('purchaseOrders',id);sw('purchaseOrders');}
}

// ════════════════════════════════════════════
// PRODUCTS
// ════════════════════════════════════════════
// Product list view state (persists across re-renders within a session)
let _prodSearch='', _prodCat='all', _prodStock='all', _prodSort='name', _prodPage=1;
const PROD_PAGE_SIZE=25;

function renderProducts(el){
  const allProds=currentView==='allProducts'?DB.getAll('products'):getMyData('products');
  const lowItems=getLowStock();
  // Build category list
  const cats=[...new Set(allProds.map(p=>p.category||'General'))].sort();

  // Apply filters
  let prods=allProds.slice();
  if(_prodSearch){
    const q=_prodSearch.toLowerCase();
    prods=prods.filter(p=>
      (p.name||'').toLowerCase().includes(q)||
      (p.sku||'').toLowerCase().includes(q)||
      (p.barcode||'').toLowerCase().includes(q)||
      (p.category||'').toLowerCase().includes(q)
    );
  }
  if(_prodCat!=='all')prods=prods.filter(p=>(p.category||'General')===_prodCat);
  if(_prodStock==='low')prods=prods.filter(p=>p.stock<=lowStockThresh&&p.stock>0);
  else if(_prodStock==='out')prods=prods.filter(p=>p.stock<=0);
  else if(_prodStock==='in')prods=prods.filter(p=>p.stock>lowStockThresh);
  // Sort
  prods.sort((a,b)=>{
    if(_prodSort==='name')return (a.name||'').localeCompare(b.name||'');
    if(_prodSort==='name_desc')return (b.name||'').localeCompare(a.name||'');
    if(_prodSort==='price')return (b.price||0)-(a.price||0);
    if(_prodSort==='price_asc')return (a.price||0)-(b.price||0);
    if(_prodSort==='stock')return (a.stock||0)-(b.stock||0);
    if(_prodSort==='stock_desc')return (b.stock||0)-(a.stock||0);
    return 0;
  });

  const totalFiltered=prods.length;
  const totalPages=Math.max(1,Math.ceil(totalFiltered/PROD_PAGE_SIZE));
  if(_prodPage>totalPages)_prodPage=totalPages;
  if(_prodPage<1)_prodPage=1;
  const pageStart=(_prodPage-1)*PROD_PAGE_SIZE;
  const pageProds=prods.slice(pageStart,pageStart+PROD_PAGE_SIZE);

  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
    <h4 style="margin:0">Products <span style="font-size:.6em;color:var(--text3);font-weight:400">(${allProds.length})</span></h4>
    <button class="btn bp bsm" onclick="showProductModal()">+ Add</button>
  </div>`;

  // ── Search + filter bar ──
  html+=`<div class="card" style="padding:12px 14px;margin-bottom:12px">
    <div class="pos-search" style="margin-bottom:8px">
      <input type="text" id="prodSearch" placeholder="🔍 Search name, SKU, barcode, category…" value="${_prodSearch.replace(/"/g,'&quot;')}"
        oninput="_prodSearch=this.value;_prodPage=1;_reRenderProducts(this)">
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
      <select id="prodCat" onchange="_prodCat=this.value;_prodPage=1;_reRenderProducts()" style="margin-bottom:0;flex:1;min-width:110px;font-size:.8em">
        <option value="all" ${_prodCat==='all'?'selected':''}>All Categories</option>
        ${cats.map(c=>`<option value="${c}" ${_prodCat===c?'selected':''}>${c}</option>`).join('')}
      </select>
      <select id="prodStock" onchange="_prodStock=this.value;_prodPage=1;_reRenderProducts()" style="margin-bottom:0;flex:1;min-width:100px;font-size:.8em">
        <option value="all" ${_prodStock==='all'?'selected':''}>All Stock</option>
        <option value="in" ${_prodStock==='in'?'selected':''}>In Stock</option>
        <option value="low" ${_prodStock==='low'?'selected':''}>Low Stock</option>
        <option value="out" ${_prodStock==='out'?'selected':''}>Out of Stock</option>
      </select>
      <select id="prodSort" onchange="_prodSort=this.value;_reRenderProducts()" style="margin-bottom:0;flex:1;min-width:110px;font-size:.8em">
        <option value="name" ${_prodSort==='name'?'selected':''}>Name A→Z</option>
        <option value="name_desc" ${_prodSort==='name_desc'?'selected':''}>Name Z→A</option>
        <option value="price" ${_prodSort==='price'?'selected':''}>Price High→Low</option>
        <option value="price_asc" ${_prodSort==='price_asc'?'selected':''}>Price Low→High</option>
        <option value="stock" ${_prodSort==='stock'?'selected':''}>Stock Low→High</option>
        <option value="stock_desc" ${_prodSort==='stock_desc'?'selected':''}>Stock High→Low</option>
      </select>
    </div>
    ${(_prodSearch||_prodCat!=='all'||_prodStock!=='all')?`<div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-size:.74em;color:var(--text2)">${totalFiltered} match${totalFiltered===1?'':'es'}</span>
      <button class="btn bd bxs" onclick="_prodSearch='';_prodCat='all';_prodStock='all';_prodPage=1;sw('${currentView}')">✕ Clear filters</button>
    </div>`:''}
  </div>`;

  if(lowItems.length&&!_prodSearch&&_prodStock==='all')html+=`<div style="background:rgba(240,101,119,.08);border:1px solid rgba(240,101,119,.25);border-radius:var(--r2);padding:10px 14px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <span style="font-family:var(--ff);font-weight:700;font-size:.82em;color:var(--rose)">⚠️ ${lowItems.length} item(s) low/out of stock</span>
      <button class="btn bd bxs" onclick="_prodStock='low';_prodPage=1;sw('${currentView}')">View</button>
    </div>
  </div>`;

  // ── Table ──
  if(pageProds.length){
    html+=`<div class="tbl-wrap"><table><thead><tr>
      <th>Name</th><th>Price</th><th>Stock</th><th>Unit</th><th>Cat.</th><th>VAT</th>
      ${currentUser.role==='admin'?'<th>Branch</th>':''}
      <th></th>
    </tr></thead><tbody>
    ${pageProds.map(p=>{
      const bn=p.branchId?(DB.getById('branches',p.branchId)||{name:'?'}).name:'🌐';
      const vl=p.vatExempt?'<span style="color:var(--blue);font-size:.72em">VE</span>':p.zeroRated?'<span style="color:var(--emerald);font-size:.72em">0%</span>':'<span style="color:var(--text2);font-size:.72em">VAT</span>';
      return`<tr>
        <td><strong style="color:var(--text)">${p.name}</strong>${p.sku?`<br><span style="font-size:.65em;color:var(--text3);font-family:var(--fm)">${p.sku}</span>`:''}</td>
        <td style="color:var(--gold);font-family:var(--fm)">${fc(p.price)}</td>
        <td class="${p.stock<=lowStockThresh?'stock-low':''}">${p.stock}</td>
        <td style="font-size:.75em">${p.unit||'pcs'}</td>
        <td style="font-size:.78em">${p.category||'—'}</td>
        <td>${vl}</td>
        ${currentUser.role==='admin'?`<td style="font-size:.72em">${bn}</td>`:''}
        <td style="white-space:nowrap">
          <button class="btn bs bxs" onclick="adjStock(${p.id})">+</button>
          <button class="btn bw bxs" onclick="showProductModal(${p.id})">✎</button>
          <button class="btn bd bxs" onclick="deleteProduct(${p.id})">🗑</button>
        </td>
      </tr>`;}).join('')}
    </tbody></table></div>`;

    // ── Pagination ──
    if(totalPages>1){
      html+=`<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;flex-wrap:wrap">
        <button class="btn bw bsm" ${_prodPage<=1?'disabled':''} onclick="_prodPage=1;sw('${currentView}')">« First</button>
        <button class="btn bw bsm" ${_prodPage<=1?'disabled':''} onclick="_prodPage--;sw('${currentView}')">‹ Prev</button>
        <span style="font-size:.82em;color:var(--text2);font-family:var(--fm);padding:0 6px">Page ${_prodPage} / ${totalPages}</span>
        <button class="btn bw bsm" ${_prodPage>=totalPages?'disabled':''} onclick="_prodPage++;sw('${currentView}')">Next ›</button>
        <button class="btn bw bsm" ${_prodPage>=totalPages?'disabled':''} onclick="_prodPage=${totalPages};sw('${currentView}')">Last »</button>
      </div>
      <p style="text-align:center;font-size:.72em;color:var(--text3);margin-top:6px">Showing ${pageStart+1}–${Math.min(pageStart+PROD_PAGE_SIZE,totalFiltered)} of ${totalFiltered}</p>`;
    }
  }else{
    html+=`<div class="empty-st"><div class="ei">🔍</div><p>${allProds.length?'No products match your filters':'No products yet'}</p>${allProds.length?'<button class="btn bd bsm" style="margin-top:8px" onclick="_prodSearch=\'\';_prodCat=\'all\';_prodStock=\'all\';sw(\''+currentView+'\')">Clear filters</button>':''}</div>`;
  }

  el.innerHTML=html;
}

// Re-render product list in place without losing search-input focus
function _reRenderProducts(inputEl){
  const el=document.getElementById('mainContent');
  if(!el)return;
  const hadFocus=inputEl&&document.activeElement===inputEl;
  const caret=inputEl?inputEl.selectionStart:null;
  renderProducts(el);
  if(hadFocus){
    const ns=document.getElementById('prodSearch');
    if(ns){ns.focus();if(caret!=null)try{ns.setSelectionRange(caret,caret);}catch(e){}}
  }
}
function showProductModal(id){
  const p=id?DB.getById('products',id):null;
  const suppliers=DB.getAll('suppliers');
  const cv=p?(p.vatExempt?'exempt':p.zeroRated?'zero':'vat'):'vat';
  const bSel=currentUser.role==='admin'?`<label class="inp-label">Branch</label><select id="miBranch"><option value="">🌐 All Branches (Global)</option>${DB.getAll('branches').map(b=>`<option value="${b.id}" ${p&&p.branchId===b.id?'selected':''}>${b.name}</option>`).join('')}</select>`:'';
  openModal(`<h4>${p?'Edit':'Add'} Product</h4>
    <label class="inp-label">Product Name *</label><input type="text" id="mi1" value="${p?p.name:''}" placeholder="e.g. White Rice">
    <label class="inp-label">Selling Price *</label><input type="number" id="mi2" value="${p?p.price:''}" step="0.01" placeholder="0.00">
    <label class="inp-label">Cost Price</label><input type="number" id="mi3" value="${p?p.cost||0:0}" step="0.01" placeholder="0.00">
    <label class="inp-label">Stock Quantity</label><input type="number" id="mi4" value="${p?p.stock:0}" placeholder="0">
    <label class="inp-label">Category</label><input type="text" id="mi5" value="${p?p.category||'':'General'}" placeholder="General">
    <label class="inp-label">Barcode (for scanner)</label><input type="text" id="mi6" value="${p?p.barcode||'':''}" placeholder="e.g. 123456789">
    <label class="inp-label">Unit of Measure</label><input type="text" id="mi7" value="${p?p.unit||'pcs':'pcs'}" placeholder="pcs / kg / box">
    ${bSel}
    <label class="inp-label">VAT Classification</label>
    <select id="miVat"><option value="vat" ${cv==='vat'?'selected':''}>VAT (12%)</option><option value="exempt" ${cv==='exempt'?'selected':''}>VAT-Exempt</option><option value="zero" ${cv==='zero'?'selected':''}>Zero-Rated</option></select>
    <label class="inp-label">Supplier</label>
    <select id="miSup"><option value="">No Supplier</option>${suppliers.map(s=>`<option value="${s.id}" ${p&&p.supplierId===s.id?'selected':''}>${s.name}</option>`).join('')}</select>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px">
      <button class="btn bd" onclick="closeModal()">Cancel</button>
      <button class="btn bp" onclick="saveProduct(${id||'null'})">Save Product</button>
    </div>`);
}
function saveProduct(id){
  const name=document.getElementById('mi1').value.trim(),price=parseFloat(document.getElementById('mi2').value);
  if(!name||isNaN(price)){toast('Name and price are required','rose');return;}
  const vt=document.getElementById('miVat')?.value||'vat';
  const bEl=document.getElementById('miBranch');
  const branchId=bEl?(bEl.value?parseInt(bEl.value):null):currentUser.branchId;
  const data={name,price,cost:parseFloat(document.getElementById('mi3').value)||0,stock:parseInt(document.getElementById('mi4').value)||0,category:document.getElementById('mi5').value||'General',barcode:document.getElementById('mi6').value||'',unit:document.getElementById('mi7').value||'pcs',vatExempt:vt==='exempt',zeroRated:vt==='zero',supplierId:document.getElementById('miSup').value?parseInt(document.getElementById('miSup').value):null,active:true,branchId};
  if(id){const p=DB.getById('products',id);Object.assign(p,data);DB.update('products',p);}
  else{data.sku='SKU'+Date.now();DB.add('products',data);}
  closeModal();sw(currentView);toast('Product saved ✓','emerald');
}
async function adjStock(id){
  const p=DB.getById('products',id);
  const val=await prompt2(`Update stock for "${p.name}" (current: ${p.stock}):`,String(p.stock),String(p.stock),'number');
  const qty=parseInt(val);if(isNaN(qty))return;
  p.stock=Math.max(0,qty);DB.update('products',p);sw(currentView);toast('Stock updated ✓','emerald');
}
async function deleteProduct(id){
  const ok=await confirm2('Delete this product? This cannot be undone.','📦',true);
  if(ok){DB.delete('products',id);sw(currentView);}
}

