/* ============================================================
   MLEA POS v6.0 — 10-users.js
   User management
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */

// ════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════
function renderUsers(el){
  const usrs=currentView==='allUsers'?DB.getAll('users'):getMyData('users');
  const branches=DB.getAll('branches');
  el.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h4 style="margin:0">👥 User Management</h4>
      <button class="btn bp bsm" onclick="showUserModal()">+ Add User</button>
    </div>
    <div class="card" style="border:1px solid rgba(212,168,83,.25);margin-bottom:12px">
      <p style="font-size:.78em;color:var(--text2);line-height:1.6">
        <strong style="color:var(--gold)">Roles:</strong>
        👑 Admin — full access &nbsp;|&nbsp;
        🎯 Manager — branch + staff &nbsp;|&nbsp;
        👤 Cashier — POS only
      </p>
    </div>
    ${usrs.map(u=>{
      const branch=u.branchId?branches.find(b=>b.id===u.branchId):null;
      const isSelf=u.id===currentUser.id;
      const canEdit=currentUser.role==='admin'||(currentUser.role==='manager'&&u.role==='cashier'&&u.branchId===currentUser.branchId);
      const canDel=canEdit&&!isSelf;
      return`<div class="card" style="border-left:3px solid ${u.role==='admin'?'var(--gold)':u.role==='manager'?'var(--emerald)':'var(--blue)'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
          <div style="display:flex;align-items:center;gap:12px;flex:1;min-width:0">
            <div style="width:42px;height:42px;border-radius:50%;background:${u.role==='admin'?'var(--gold-soft)':u.role==='manager'?'var(--emerald-soft)':'var(--blue-soft)'};display:flex;align-items:center;justify-content:center;font-size:1.3em;flex-shrink:0">${u.role==='admin'?'👑':u.role==='manager'?'🎯':'👤'}</div>
            <div style="min-width:0">
              <div style="font-family:var(--ff);font-weight:700;font-size:.95em">${u.name}${isSelf?'<span style="font-size:.65em;color:var(--gold);margin-left:6px">(You)</span>':''}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;align-items:center">
                <span class="rbadge rb-${u.role}">${u.role}</span>
                ${u.active?'<span style="font-size:.65em;color:var(--emerald);font-weight:600">● Active</span>':'<span style="font-size:.65em;color:var(--rose);font-weight:600">● Inactive</span>'}
                ${branch?`<span style="font-size:.65em;color:var(--blue);font-weight:600">🏢 ${branch.name}</span>`:'<span style="font-size:.65em;color:var(--text3)">🌐 Global</span>'}
              </div>
              <div style="font-size:.7em;color:var(--text3);margin-top:3px;font-family:var(--fm)">PIN: ${u.pin&&u.pin.includes(':')?'<span style="color:var(--emerald)">🔒 Hashed</span>':'<span style="color:var(--rose)">⚠ Plaintext (will upgrade on next login)</span>'} &nbsp;|&nbsp; ID #${u.id}</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0">
            ${canEdit?`<button class="btn bw bxs" onclick="showUserModal(${u.id})">✎ Edit</button>`:''}
            ${canEdit&&!isSelf?`<button class="btn ${u.active?'bd':'bs'} bxs" onclick="toggleUser(${u.id})">${u.active?'Deactivate':'Activate'}</button>`:''}
            ${canDel?`<button class="btn bd bxs" onclick="deleteUserSafe(${u.id},'${u.name.replace(/'/g,"\\'")}','${u.role}')">🗑 Delete</button>`:''}
          </div>
        </div>
      </div>`;
    }).join('')}
    ${!usrs.length?'<div class="empty-st"><div class="ei">👥</div><p>No users found</p></div>':''}`;
}

function showUserModal(id){
  const u=id?DB.getById('users',id):null;
  const branches=DB.getAll('branches');
  const isAdmin=currentUser.role==='admin';
  const isSelf=u&&u.id===currentUser.id;
  const roleOpts=isAdmin
    ?`<option value="cashier" ${u&&u.role==='cashier'?'selected':''}>👤 Cashier — POS terminal only</option>
       <option value="manager" ${u&&u.role==='manager'?'selected':''}>🎯 Manager — branch + staff access</option>
       <option value="admin" ${u&&u.role==='admin'?'selected':''}>👑 Admin — full system access</option>`
    :`<option value="cashier" selected>👤 Cashier</option>`;
  const branchOpts=isAdmin
    ?`<option value="" ${u&&!u.branchId?'selected':''}>🌐 Global (all branches)</option>`
     +branches.map(b=>`<option value="${b.id}" ${u&&u.branchId===b.id?'selected':''}>${b.name}</option>`).join('')
    :`<option value="${currentUser.branchId||''}">${branches.find(b=>b.id===currentUser.branchId)?.name||'My Branch'}</option>`;
  openModal(`
    <h4>${u?`${u.role==='admin'?'👑':u.role==='manager'?'🎯':'👤'} Edit User`:'👤 Add New User'}</h4>
    ${u?`<div style="background:var(--bg-elevated);border-radius:var(--r2);padding:10px 14px;margin-bottom:14px;font-size:.8em;color:var(--text2)">
      Editing <strong style="color:var(--text)">${u.name}</strong>${isSelf?' <span style="color:var(--gold)">(your account)</span>':''}
    </div>`:''}
    <label class="inp-label">Full Name *</label>
    <input type="text" id="uName" value="${u?u.name:''}" placeholder="e.g. Juan dela Cruz">
    <label class="inp-label">Role</label>
    <select id="uRole" ${!isAdmin&&u?'disabled':''}>${roleOpts}</select>
    ${!isAdmin&&u?'<p style="font-size:.72em;color:var(--text3);margin-top:-4px;margin-bottom:8px">Only admins can change roles</p>':''}
    <label class="inp-label">Branch Assignment</label>
    <select id="uBranch" ${!isAdmin?'disabled':''}>${branchOpts}</select>
    ${!isAdmin?'<p style="font-size:.72em;color:var(--text3);margin-top:-4px;margin-bottom:8px">Assigned to your branch</p>':''}
    <div style="background:var(--bg-elevated);border-radius:var(--r2);padding:12px 14px;margin-bottom:12px">
      <div style="font-size:.78em;font-weight:600;color:var(--text2);font-family:var(--ff);margin-bottom:8px">
        ${u?'🔐 Change PIN (leave blank to keep current)':'🔐 Set PIN *'}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label class="inp-label">New PIN (4 digits)</label>
          <input type="password" id="uPin" placeholder="••••" maxlength="4"
            style="margin-bottom:0;font-family:var(--fm);letter-spacing:6px;font-size:1.2em;text-align:center"
            oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4);validatePINMatch()">
        </div>
        <div>
          <label class="inp-label">Confirm PIN</label>
          <input type="password" id="uPinConfirm" placeholder="••••" maxlength="4"
            style="margin-bottom:0;font-family:var(--fm);letter-spacing:6px;font-size:1.2em;text-align:center"
            oninput="this.value=this.value.replace(/\\D/g,'').slice(0,4);validatePINMatch()">
        </div>
      </div>
      <div id="pinMatchMsg" style="font-size:.72em;min-height:16px;margin-top:6px;font-weight:600"></div>
    </div>
    <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:14px">
      <input type="checkbox" id="uActive" ${u?u.active?'checked':'':'checked'} style="width:auto;margin-bottom:0">
      <span style="font-size:.82em;color:var(--text2)">Account is <strong style="color:var(--text)">Active</strong></span>
    </label>
    <div id="uModalErr" style="color:var(--rose);font-size:.78em;min-height:18px;margin-bottom:10px;font-weight:600"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <button class="btn bd" onclick="closeModal()">Cancel</button>
      <button class="btn bp" onclick="saveUser(${id||'null'})" id="uSaveBtn">${u?'💾 Save Changes':'➕ Create User'}</button>
    </div>`);
  setTimeout(()=>document.getElementById('uName')?.focus(),100);
}

function validatePINMatch(){
  const p1=document.getElementById('uPin')?.value||'';
  const p2=document.getElementById('uPinConfirm')?.value||'';
  const msg=document.getElementById('pinMatchMsg');if(!msg)return;
  if(!p1&&!p2){msg.textContent='';return;}
  if(p1.length<4){msg.style.color='var(--text3)';msg.textContent='Enter 4 digits';return;}
  if(p1===p2){msg.style.color='var(--emerald)';msg.textContent='✓ PINs match';}
  else{msg.style.color='var(--rose)';msg.textContent='✗ PINs do not match';}
}

async function saveUser(id){
  const errEl=document.getElementById('uModalErr');
  const name=(document.getElementById('uName')?.value||'').trim();
  const role=document.getElementById('uRole')?.value||'cashier';
  const branchEl=document.getElementById('uBranch');
  const branchId=branchEl&&branchEl.value?parseInt(branchEl.value):currentUser.branchId||null;
  const pin1=document.getElementById('uPin')?.value||'';
  const pin2=document.getElementById('uPinConfirm')?.value||'';
  const active=document.getElementById('uActive')?.checked!==false;
  const isNew=!id||id==='null'||id===null;
  if(!name){errEl.textContent='Full name is required';return;}
  if(isNew&&!pin1){errEl.textContent='PIN is required for new users';return;}
  if(pin1){
    if(pin1.length!==4||!/^\d{4}$/.test(pin1)){errEl.textContent='PIN must be exactly 4 digits (numbers only)';return;}
    if(pin1!==pin2){errEl.textContent='PINs do not match';return;}
  }
  if(currentUser.role==='manager'&&role!=='cashier'){errEl.textContent='Managers can only create cashier accounts';return;}
  if(id&&parseInt(id)===currentUser.id&&role!==currentUser.role&&currentUser.role==='admin'&&role!=='admin'){errEl.textContent='Cannot demote your own admin account';return;}
  const btn=document.getElementById('uSaveBtn');if(btn)btn.disabled=true;
  if(isNew){
    // Hash PIN before storing
    const {stored}=await hashPIN(pin1);
    DB.add('users',{name,role,active,pin:stored,branchId});
    logAct('User Created',`${name} (${role}) by ${currentUser.name}`);
    closeModal();sw(currentView);renderLogin();
    toast(`✓ ${name} created as ${role}`,'emerald',5000);
  }else{
    const u=DB.getById('users',parseInt(id));
    if(!u){errEl.textContent='User not found';if(btn)btn.disabled=false;return;}
    const changes=[];
    if(u.name!==name)changes.push(`name → ${name}`);
    if(currentUser.role==='admin'&&u.role!==role)changes.push(`role → ${role}`);
    if(pin1)changes.push('PIN changed');
    if(u.active!==active)changes.push(active?'activated':'deactivated');
    u.name=name;
    if(currentUser.role==='admin'){u.role=role;u.branchId=branchId||null;}
    // Hash new PIN before storing
    if(pin1){const {stored}=await hashPIN(pin1);u.pin=stored;}
    u.active=active;
    DB.update('users',u);
    logAct('User Updated',`${name}: ${changes.join(', ')} by ${currentUser.name}`);
    closeModal();sw(currentView);renderLogin();
    toast(`✓ ${name} updated`,'emerald');
    if(parseInt(id)===currentUser.id&&pin1)
      setTimeout(()=>toast('Your PIN has been changed. Use the new PIN on next login.','gold',6000),600);
  }
}

async function showAddUserModal(){showUserModal();}

async function deleteUserSafe(id,name,role){
  if(id===currentUser.id){toast('You cannot delete your own account','rose');return;}
  if(currentUser.role==='manager'){
    const t=DB.getById('users',id);
    if(!t||t.role!=='cashier'||t.branchId!==currentUser.branchId){toast('You can only delete cashiers in your branch','rose');return;}
  }
  const ok=await confirm2(`Delete "${name}" (${role})?\n\nThis cannot be undone. Their sales history is preserved.`,'🗑️',true);
  if(!ok)return;
  DB.delete('users',id);
  logAct('User Deleted',`${name} (${role}) by ${currentUser.name}`);
  sw(currentView);renderLogin();toast('User deleted ✓','emerald');
}

async function toggleUser(id){
  const u=DB.getById('users',id);
  if(!u||u.id===currentUser.id){toast('You cannot deactivate yourself','rose');return;}
  const ok=await confirm2(`${u.active?'Deactivate':'Activate'} "${u.name}"?`,u.active?'🔒':'🔓');
  if(!ok)return;
  u.active=!u.active;DB.update('users',u);
  logAct('User '+(u.active?'Activated':'Deactivated'),u.name+' by '+currentUser.name);
  sw(currentView);renderLogin();
  toast(u.name+(u.active?' activated ✓':' deactivated'),'emerald');
}

