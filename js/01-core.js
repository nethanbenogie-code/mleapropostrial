/* ============================================================
   MLEA POS v6.0 — 01-core.js
   Storage polyfill, dialogs, toast, settings & font-size helpers, currencies, globals, BIR helpers
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */


// ════════════════════════════════════════════
// STORAGE SAFETY POLYFILL  (MUST RUN FIRST)
// Some browsers block localStorage on file:// origins
// or in private mode. Without this guard, the very
// first localStorage call throws and the app appears
// frozen (e.g. license button does nothing).
// This installs an in-memory fallback so the app
// always loads and remains usable.
// ════════════════════════════════════════════
(function(){
  let ok=false;
  try{
    const k='__mlea_test__';
    window.localStorage.setItem(k,'1');
    window.localStorage.removeItem(k);
    ok=true;
  }catch(e){ ok=false; }
  if(!ok){
    const mem={};
    const shim={
      getItem(k){return Object.prototype.hasOwnProperty.call(mem,k)?mem[k]:null;},
      setItem(k,v){mem[k]=String(v);},
      removeItem(k){delete mem[k];},
      clear(){for(const k in mem)delete mem[k];},
      key(i){return Object.keys(mem)[i]??null;},
      get length(){return Object.keys(mem).length;}
    };
    try{
      Object.defineProperty(window,'localStorage',{value:shim,configurable:true,writable:false});
    }catch(e){
      window._memLS=shim;
    }
    window.addEventListener('DOMContentLoaded',function(){
      try{
        const d=document.createElement('div');
        d.style.cssText='position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#3a2a00;color:#f0c060;border:1px solid #d4a853;border-radius:10px;padding:10px 16px;font:13px system-ui;z-index:99999;max-width:90%;text-align:center';
        d.textContent='\u26a0 Browser storage is blocked. The app will run, but data will NOT be saved when you close it. For full functionality, open via a web server (http://) rather than a file, and disable private browsing.';
        document.body.appendChild(d);
        setTimeout(()=>d.remove(),12000);
      }catch(e){}
    });
  }
})();

// ════════════════════════════════════════════
// DIALOG SYSTEM (replaces all alert/prompt/confirm)
// ════════════════════════════════════════════
function dlg(opts){
  return new Promise(resolve=>{
    const el=document.createElement('div');
    el.className='dlg-overlay';
    const icon=opts.icon||'💬';
    const type=opts.type||'alert'; // alert | confirm | prompt
    const color=opts.color||'var(--gold)';
    el.innerHTML=`<div class="dlg-box">
      <div class="dlg-icon">${icon}</div>
      <div class="dlg-title" style="color:${color}">${opts.title||''}</div>
      <div class="dlg-msg">${opts.msg||''}</div>
      ${type==='prompt'?`<div class="dlg-input"><input type="${opts.inputType||'text'}" id="dlgInput" placeholder="${opts.placeholder||''}" value="${opts.defaultVal||''}" style="margin-bottom:0"></div>`:''}
      <div class="dlg-btns">
        ${type!=='alert'?`<button class="btn bd" id="dlgCancel">${opts.cancelLabel||'Cancel'}</button>`:''}
        <button class="btn ${type==='confirm'&&opts.danger?'bd':'bp'}" id="dlgOk">${opts.okLabel||'OK'}</button>
      </div>
    </div>`;
    document.body.appendChild(el);
    setTimeout(()=>{
      const inp=el.querySelector('#dlgInput');if(inp)inp.focus();
      const ok=el.querySelector('#dlgOk');
      const cancel=el.querySelector('#dlgCancel');
      const finish=val=>{el.remove();resolve(val);};
      ok.onclick=()=>{
        if(type==='prompt'){const v=el.querySelector('#dlgInput').value;finish(v);}
        else finish(true);
      };
      if(cancel)cancel.onclick=()=>finish(type==='prompt'?null:false);
      el.addEventListener('keydown',e=>{if(e.key==='Enter')ok.click();if(e.key==='Escape'&&cancel)cancel.click();});
    },50);
  });
}
const alert2=(msg,icon='ℹ️',color='var(--blue)')=>dlg({type:'alert',icon,msg,color,okLabel:'OK'});
const confirm2=(msg,icon='⚠️',danger=false)=>dlg({type:'confirm',icon,msg,color:danger?'var(--rose)':'var(--gold)',danger,okLabel:'Confirm',cancelLabel:'Cancel'});
const prompt2=(msg,placeholder='',defaultVal='',inputType='text')=>dlg({type:'prompt',icon:'✏️',msg,placeholder,defaultVal,inputType,okLabel:'Save',cancelLabel:'Cancel',color:'var(--gold)'});

// ════════════════════════════════════════════
// TOAST SYSTEM
// ════════════════════════════════════════════
function toast(msg,color='gold',dur=3200){
  const wrap=document.getElementById('toastWrap');
  const t=document.createElement('div');t.className='toast';
  const c={gold:'var(--gold)',rose:'var(--rose)',emerald:'var(--emerald)',blue:'var(--blue)',purple:'var(--purple)'}[color]||'var(--gold)';
  t.style.cssText=`background:var(--bg-elevated);border:1px solid ${c};color:${c}`;
  t.textContent=msg;wrap.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity .4s';setTimeout(()=>t.remove(),400);},dur);
}

