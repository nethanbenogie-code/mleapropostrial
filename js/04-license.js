/* ============================================================
   MLEA POS v6.0 — 04-license.js
   License gate + activation
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */

// ════════════════════════════════════════════
// LICENSE
// ════════════════════════════════════════════
const LIC_SRV='https://script.google.com/macros/s/AKfycby1QlCg9jzpXmxtE1N-5w7b4CuGa0TT5gcfwYrx-0yetL4iI5s86ZX8NyLhDwo4tLJX/exec';
const DEMO_KEY='MLEA-DEMO-UNLOCK-KEY1';
function devId(){return btoa(navigator.userAgent.slice(-15)+screen.width+'x'+screen.height+new Date().getTimezoneOffset()).replace(/[^a-zA-Z0-9]/g,'').slice(0,16);}
function fmtLic(inp){let v=inp.value.replace(/[^a-zA-Z0-9]/g,'').toUpperCase();if(v.length>20)v=v.slice(0,20);let p=[];for(let i=0;i<v.length;i+=4)p.push(v.slice(i,i+4));inp.value=p.join('-');}
function isActiv(){try{return localStorage.getItem('mlea_activated')==='true';}catch(e){return false;}}
function setActiv(key,info){try{localStorage.setItem('mlea_activated','true');localStorage.setItem('mlea_lic',key);if(info)localStorage.setItem('mlea_lic_info',JSON.stringify(info));}catch(e){}showLicGate();}
function clrActiv(){try{localStorage.removeItem('mlea_activated');localStorage.removeItem('mlea_lic');localStorage.removeItem('mlea_lic_info');}catch(e){}currentUser=null;cart=[];showLicGate();}
function getStoredLic(){try{return localStorage.getItem('mlea_lic')||'';}catch(e){return '';}}

function showLicGate(){
  if(isActiv()){
    document.getElementById('licenseGate').style.display='none';
    document.getElementById('loginScreen').style.display='flex';
    document.getElementById('mainApp').style.display='none';
    document.getElementById('licenseInput').value=getStoredLic();
    document.getElementById('activateBtn').style.display='none';
    document.getElementById('deactivateBtn').style.display='block';
    document.getElementById('validateBtn').style.display='block';
    const info=localStorage.getItem('mlea_lic_info');
    const s=document.getElementById('licStatus');
    try{const i=info?JSON.parse(info):null;s.textContent=i?'✓ Activated · Device '+i.d+' of '+i.m:'✓ System Activated';}catch{s.textContent='✓ Activated';}
    s.className='lic-status ok';
    initApp();
  }else{
    document.getElementById('licenseGate').style.display='flex';
    document.getElementById('loginScreen').style.display='none';
    document.getElementById('mainApp').style.display='none';
    document.getElementById('activateBtn').style.display='block';
    document.getElementById('deactivateBtn').style.display='none';
    document.getElementById('validateBtn').style.display='none';
    document.getElementById('licStatus').textContent='';
    document.getElementById('licenseInput').value='';
  }
}
async function doActivate(){
  const inp=document.getElementById('licenseInput'),s=document.getElementById('licStatus'),btn=document.getElementById('activateBtn');
  const key=inp.value.trim();if(!key){s.textContent='⚠ Enter license key';s.className='lic-status err';return;}
  // Demo key activates instantly, no server needed
  if(key===DEMO_KEY){setActiv(key);s.textContent='✓ Demo activated';s.className='lic-status ok';return;}
  btn.disabled=true;s.innerHTML='<span class="spinner"></span> Verifying…';s.className='lic-status';
  try{
    const r=await fetch(LIC_SRV+'?action=activate&licenseKey='+encodeURIComponent(key)+'&deviceId='+encodeURIComponent(devId()));
    const d=await r.json();
    if(d.success)setActiv(key,{d:d.deviceCount,m:d.maxDevices});
    else{s.textContent='✗ '+d.message;s.className='lic-status err';}
  }catch(e){
    s.textContent='✗ Cannot reach license server. Check your internet connection, or use the demo key.';s.className='lic-status err';
  }
  btn.disabled=false;
}
async function doValidate(){
  const s=document.getElementById('licStatus'),key=getStoredLic();
  if(!key){s.textContent='No license';s.className='lic-status err';return;}
  s.innerHTML='<span class="spinner"></span> Checking…';
  try{
    const r=await fetch(LIC_SRV+'?action=validate&licenseKey='+encodeURIComponent(key)+'&deviceId='+encodeURIComponent(devId()));
    const d=await r.json();
    s.textContent=d.success?'✓ Valid · Device '+(d.deviceCount||'?')+' of '+(d.maxDevices||'?'):'✗ '+d.message;
    s.className='lic-status '+(d.success?'ok':'err');
  }catch{s.textContent='Cannot reach server';s.className='lic-status err';}
}
async function doDeactivate(){
  const ok=await confirm2('Deactivate this license on this device?','🔑');
  if(!ok)return;
  try{await fetch(LIC_SRV+'?action=deactivate&licenseKey='+encodeURIComponent(getStoredLic())+'&deviceId='+encodeURIComponent(devId()));}catch{}
  clrActiv();
}

