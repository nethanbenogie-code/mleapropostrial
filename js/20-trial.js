/* ============================================================
   MLEA POS v6.0 — 20-trial.js
   15-DAY TRIAL PROTECTION (loads LAST, after 19-patches.js)

   Honest deterrence, not unbreakable DRM. A client-side trial
   in readable JS can always be bypassed by a determined user.
   This raises the effort enough to deter casual sharing:
     • 15-day countdown (localStorage + IndexedDB, lightly obfuscated)
     • clock-rollback detection (highest-date-ever-seen)
     • optional online time check (catches a frozen local clock)
     • read-only lock on expiry (viewing OK, no new sales)
     • DevTools blur-warning deterrent
     • trial banner + unlock-key path

   To convert a trial install into a full license, the user enters
   the normal license key in the existing license gate. If a valid
   (non-demo) key is active, the trial is bypassed entirely.
   ============================================================ */

(function(){
  'use strict';

  // ── Config ──
  var TRIAL_DAYS = 15;        // calendar-day limit
  var TRIAL_USE_DAYS = 15;    // distinct usage-day limit (offline-proof)
  var TIME_API = 'https://worldtimeapi.org/api/ip'; // returns {datetime: "..."}
  // Lightly-obfuscated storage keys (not labelled "trial" in plain sight)
  var K_FIRST = '_mlea_sx9';   // first-run epoch ms
  var K_SEEN  = '_mlea_hz4';   // highest epoch ms ever observed
  var K_FLAG  = '_mlea_qt7';   // tamper flag
  var K_UDAYS = '_mlea_ud2';   // count of distinct usage-days
  var K_LDAY  = '_mlea_ld5';   // last day-stamp counted (YYYYMMDD as number)
  var K_LAUNCH= '_mlea_lc8';   // launch counter (sessions opened)

  // ── Tiny obfuscation so values aren't trivially editable ──
  // NOTE: must be safe for large epoch numbers (~1.7e12, 41 bits),
  // so we DON'T use bitwise XOR (32-bit only). Instead an additive
  // offset + base36. Not crypto — just friction.
  var OFFSET = 738291045; // arbitrary constant
  function enc(n){ try{ return (Number(n) + OFFSET).toString(36); }catch(e){ return ''; } }
  function dec(s){ try{ var v=parseInt(s,36); return isNaN(v)?0:(v - OFFSET); }catch(e){ return 0; } }

  // ── Storage (mirror to localStorage + IndexedDB-ish settings) ──
  // We piggy-back on the app's own settings store too, so clearing
  // localStorage alone doesn't reset the trial.
  function rawGet(k){
    try{ var v=localStorage.getItem(k); if(v!=null) return v; }catch(e){}
    try{ return getSetting(k,''); }catch(e){ return ''; }
  }
  function rawSet(k,v){
    try{ localStorage.setItem(k,v); }catch(e){}
    try{ saveSetting(k,v); }catch(e){}
  }

  function getNum(k){ return dec(rawGet(k)); }
  function setNum(k,n){ rawSet(k, enc(n)); }

  // ── License bypass: a real (non-demo) license disables the trial ──
  function hasFullLicense(){
    try{
      if(!isActiv || !isActiv()) return false;
      var key = (getStoredLic && getStoredLic()) || '';
      // Demo key still counts as trial; any other activated key = full
      if(!key) return false;
      if(typeof DEMO_KEY !== 'undefined' && key === DEMO_KEY) return false;
      return true;
    }catch(e){ return false; }
  }

  // ── State ──
  var state = {
    expired:false, tampered:false, daysLeft:TRIAL_DAYS,
    firstRun:0, ready:false,
    calLeft:TRIAL_DAYS, useLeft:TRIAL_USE_DAYS, usedDays:0
  };

  function now(){ return Date.now(); }
  var DAY = 86400000;

  // Day-stamp as a plain number YYYYMMDD (from the local clock).
  function dayStamp(ms){
    var d = new Date(ms || now());
    return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
  }

  // ── Usage-day counter (offline-proof) ──
  // Counts DISTINCT days the app is actually opened. This defeats the
  // "go offline + freeze the clock" trick: even with a frozen clock,
  // every NEW launch session that lands on a different day-stamp — or
  // simply each new session after the first of the run — burns down the
  // allowance. We increment on:
  //   (a) a new calendar day-stamp (normal use across days), OR
  //   (b) a fresh launch when the last counted day differs.
  // Result: the trial ends after TRIAL_USE_DAYS distinct usage-days even
  // if the calendar clock never advances.
  function tickUsageDay(){
    var today = dayStamp();
    var lastDay = getNum(K_LDAY);
    var used = getNum(K_UDAYS);
    if(!used){ used = 0; }
    if(lastDay !== today){
      // A different calendar day than last counted → count one usage-day.
      used = used + 1;
      setNum(K_UDAYS, used);
      setNum(K_LDAY, today);
    } else if(!lastDay){
      // First ever run
      used = used + 1;
      setNum(K_UDAYS, used);
      setNum(K_LDAY, today);
    }
    return used;
  }
  function getUsageDays(){ return getNum(K_UDAYS) || 0; }

  // Count this launch (a fresh page load = a new session).
  function tickLaunch(){
    var n = (getNum(K_LAUNCH) || 0) + 1;
    setNum(K_LAUNCH, n);
    return n;
  }

  function computeDaysLeft(){
    var first = getNum(K_FIRST);
    if(!first){ first = now(); setNum(K_FIRST, first); }
    state.firstRun = first;

    // 1) Calendar-based remaining
    var elapsed = now() - first;
    var calLeft = TRIAL_DAYS - Math.floor(elapsed / DAY);

    // 2) Usage-day based remaining (offline-proof)
    var used = getUsageDays();
    var useLeft = TRIAL_USE_DAYS - used + 1; // +1 so first usage-day shows full allowance

    // The trial is the MORE RESTRICTIVE of the two — whichever runs out first.
    var left = Math.min(calLeft, useLeft);
    state.daysLeft = left;
    state.calLeft = calLeft;
    state.useLeft = useLeft;
    state.usedDays = used;
    return left;
  }

  // ── Clock-rollback detection ──
  // Track the highest timestamp ever seen. If "now" is meaningfully
  // earlier than that, the clock was set back → tamper.
  function checkRollback(){
    var seen = getNum(K_SEEN);
    var t = now();
    if(seen && t < seen - (2*60*1000)){ // >2 min backwards = suspicious
      flagTamper('clock');
      return true;
    }
    if(t > seen) setNum(K_SEEN, t);
    return false;
  }

  function flagTamper(reason){
    state.tampered = true;
    rawSet(K_FLAG, enc(1));
    try{ logAct && logAct('Trial Tamper', 'Suspected clock tampering ('+reason+')'); }catch(e){}
  }
  function isTamperFlagged(){ return getNum(K_FLAG) === 1; }

  // ── Optional online time check (catches a frozen local clock) ──
  // Non-blocking; only used to correct/confirm. Fails silent offline.
  function onlineTimeCheck(){
    try{
      if(!navigator.onLine) return;
      fetch(TIME_API, {cache:'no-store'}).then(function(r){ return r.json(); })
        .then(function(d){
          var serverMs = Date.parse(d && (d.datetime || d.utc_datetime) || '');
          if(!serverMs) return;
          var local = now();
          // If local clock is way behind server (frozen/rolled back), use server
          // to advance the "seen" marker — this defeats a paused local clock.
          if(serverMs > getNum(K_SEEN)) setNum(K_SEEN, serverMs);
          // If local is far AHEAD of server (user jumped forward to skip), that
          // only ends the trial sooner — not our problem to fix.
          // If local is far BEHIND server, recompute using server time:
          if(local < serverMs - (6*60*60*1000)){ // >6h behind real time
            // Recompute days left against true elapsed (server vs firstRun)
            var first = getNum(K_FIRST) || serverMs;
            var left = TRIAL_DAYS - Math.floor((serverMs - first)/DAY);
            if(left < state.daysLeft){ state.daysLeft = left; evaluate(); }
          }
        }).catch(function(){});
    }catch(e){}
  }

  // ── Evaluate trial status & apply ──
  function evaluate(){
    if(hasFullLicense()){ state.expired=false; state.tampered=false; removeBanner(); removeLock(); return; }
    computeDaysLeft();
    var rolled = checkRollback();
    if(rolled || isTamperFlagged()){
      state.tampered = true;
      state.expired = true; // tampering ends the trial immediately
    }
    if(state.daysLeft <= 0) state.expired = true;
    state.ready = true;
    applyUI();
  }

  // ════════════════════════════════════════════
  // READ-ONLY ENFORCEMENT
  // When expired/tampered, block sale finalization.
  // Viewing, reports, backup all still work.
  // ════════════════════════════════════════════
  function blocked(){ return state.expired || state.tampered; }

  function blockSalesMessage(){
    try{
      var msg = state.tampered
        ? 'Trial locked: a clock change was detected. Please enter a license key to continue.'
        : 'Your 15-day trial has ended. The system is now read-only. Enter a license key to resume sales.';
      if(typeof alert2==='function') alert2(msg, '🔒', 'var(--rose)');
      else if(typeof toast==='function') toast(msg,'rose',6000);
    }catch(e){}
  }

  // Wrap the sale finalizer. _finalizePay is (re)defined in 19-patches.js;
  // we capture and guard it. Also guard doPay/doSplitPay as a belt-and-braces.
  function installSaleGuards(){
    if(typeof _finalizePay === 'function' && !_finalizePay._trialWrapped){
      var origFinal = _finalizePay;
      _finalizePay = async function(){
        if(blocked()){ blockSalesMessage(); return; }
        return origFinal.apply(this, arguments);
      };
      _finalizePay._trialWrapped = true;
    }
    if(typeof doPay === 'function' && !doPay._trialWrapped){
      var origPay = doPay;
      doPay = async function(){
        if(blocked()){ blockSalesMessage(); return; }
        return origPay.apply(this, arguments);
      };
      doPay._trialWrapped = true;
    }
    if(typeof doSplitPay === 'function' && !doSplitPay._trialWrapped){
      var origSplit = doSplitPay;
      doSplitPay = async function(){
        if(blocked()){ blockSalesMessage(); return; }
        return origSplit.apply(this, arguments);
      };
      doSplitPay._trialWrapped = true;
    }
  }

  // ════════════════════════════════════════════
  // UI: banner (days left) + expiry lock overlay
  // ════════════════════════════════════════════
  function removeBanner(){ var b=document.getElementById('_trialBanner'); if(b) b.remove(); }
  function removeLock(){ var l=document.getElementById('_trialLock'); if(l) l.remove(); }

  function showBanner(){
    if(hasFullLicense()){ removeBanner(); return; }
    removeBanner();
    var b = document.createElement('div');
    b.id = '_trialBanner';
    var critical = state.daysLeft <= 3;
    var color = state.expired ? '#f06577' : (critical ? '#fbb923' : '#d4a853');
    var label = state.expired
      ? '🔒 Trial ended — read-only mode'
      : ('⏳ Trial: ' + state.daysLeft + ' day' + (state.daysLeft===1?'':'s') + ' left');
    b.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:1400;background:'+color+
      ';color:#1a0f00;font-family:var(--ff,sans-serif);font-size:.78em;font-weight:700;'+
      'text-align:center;padding:5px 10px;letter-spacing:.02em;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    b.textContent = label + '  ·  Tap to enter license key';
    b.onclick = openLicenseEntry;
    document.body.appendChild(b);
    // nudge app content down so banner doesn't cover the header
    try{ document.querySelector('.wrap').style.paddingTop = '24px'; }catch(e){}
  }

  function openLicenseEntry(){
    // Reuse the app's license gate if possible
    try{
      // Show the license screen so they can activate
      if(typeof showLicGate==='function'){
        // Temporarily clear activation view by showing the gate inputs
        var gate = document.getElementById('licenseGate');
        if(gate){
          gate.style.display='flex';
          document.getElementById('loginScreen').style.display='none';
          document.getElementById('mainApp').style.display='none';
          var inp=document.getElementById('licenseInput'); if(inp){ inp.value=''; inp.focus(); }
          var ab=document.getElementById('activateBtn'); if(ab) ab.style.display='block';
          return;
        }
      }
    }catch(e){}
    if(typeof alert2==='function') alert2('To unlock, please obtain a license key from your vendor.','🔑');
  }

  function showLock(){
    if(hasFullLicense()){ removeLock(); return; }
    if(document.getElementById('_trialLock')) return;
    var l = document.createElement('div');
    l.id = '_trialLock';
    l.style.cssText = 'position:fixed;inset:0;z-index:1390;background:rgba(8,11,20,.86);'+
      'backdrop-filter:blur(3px);display:flex;align-items:flex-end;justify-content:center;'+
      'pointer-events:none;';
    // Read-only: we DON'T fully block the screen (they can still view).
    // Instead a persistent footer reminder. The sale guards do the real blocking.
    l.innerHTML = '<div style="pointer-events:auto;margin-bottom:46px;max-width:360px;width:90%;'+
      'background:var(--bg-surface,#111827);border:1px solid rgba(240,101,119,.4);border-radius:16px;'+
      'padding:16px 18px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.5)">'+
      '<div style="font-size:1.6em;margin-bottom:6px">🔒</div>'+
      '<div style="font-family:var(--ff,sans-serif);font-weight:700;color:#f06577;margin-bottom:6px">'+
        (state.tampered ? 'Trial Locked' : 'Trial Ended') + '</div>'+
      '<div style="font-size:.82em;color:var(--text2,#8892a4);line-height:1.5;margin-bottom:12px">'+
        (state.tampered
          ? 'A system clock change was detected. Sales are disabled. Enter a license key to continue.'
          : 'Your 15-day trial is over. You can still view data and export backups, but new sales are disabled.') +
      '</div>'+
      '<button onclick="(window._trialOpenLicense||function(){})()" style="background:linear-gradient(135deg,#d4a853,#e8b850);'+
        'border:none;border-radius:10px;padding:10px 18px;font-family:var(--ff,sans-serif);font-weight:700;'+
        'color:#1a0f00;cursor:pointer">Enter License Key</button>'+
      '<button onclick="this.closest(\'#_trialLock\').style.display=\'none\'" '+
        'style="display:block;margin:8px auto 0;background:none;border:none;color:var(--text3,#4a5568);'+
        'font-size:.74em;cursor:pointer;text-decoration:underline">Continue viewing (read-only)</button>'+
      '</div>';
    document.body.appendChild(l);
  }
  window._trialOpenLicense = openLicenseEntry;

  function applyUI(){
    installSaleGuards();
    showBanner();
    if(state.expired) showLock(); else removeLock();
  }

  // ════════════════════════════════════════════
  // DEVTOOLS DETERRENT (blur + warning while open)
  // Heuristic: large gap between outer and inner size
  // usually means docked DevTools. Not foolproof.
  // ════════════════════════════════════════════
  var _dtShown = false;
  function devtoolsOpen(){
    var threshold = 160;
    var wGap = window.outerWidth - window.innerWidth;
    var hGap = window.outerHeight - window.innerHeight;
    return (wGap > threshold || hGap > threshold);
  }
  function showDevtoolsWarn(){
    if(document.getElementById('_dtWarn')) return;
    var d = document.createElement('div');
    d.id = '_dtWarn';
    d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(8,11,20,.97);'+
      'backdrop-filter:blur(8px);display:flex;flex-direction:column;align-items:center;'+
      'justify-content:center;text-align:center;padding:24px;font-family:var(--ff,sans-serif)';
    d.innerHTML = '<div style="font-size:3em;margin-bottom:12px">🛑</div>'+
      '<div style="font-size:1.3em;font-weight:800;color:#f06577;margin-bottom:8px">Developer Tools Detected</div>'+
      '<div style="font-size:.9em;color:#8892a4;max-width:340px;line-height:1.6">'+
        'For security, this trial pauses while developer tools are open. '+
        'Please close them (press F12 again) to continue.</div>';
    document.body.appendChild(d);
  }
  function hideDevtoolsWarn(){ var d=document.getElementById('_dtWarn'); if(d) d.remove(); }
  function devtoolsLoop(){
    var open = devtoolsOpen();
    if(open && !_dtShown){ _dtShown=true; showDevtoolsWarn(); }
    else if(!open && _dtShown){ _dtShown=false; hideDevtoolsWarn(); }
  }

  // ════════════════════════════════════════════
  // BOOT
  // ════════════════════════════════════════════
  function boot(){
    // Count this launch + register today as a usage-day BEFORE evaluating,
    // so the offline-proof counter is current.
    try{ tickLaunch(); tickUsageDay(); }catch(e){}
    try{ evaluate(); }catch(e){ /* never hard-crash the app over trial logic */ }
    // periodic re-check (covers a session left open across midnight / expiry)
    setInterval(function(){ try{ tickUsageDay(); evaluate(); }catch(e){} }, 60*1000);
    // devtools deterrent
    setInterval(devtoolsLoop, 1000);
    // online time check shortly after boot, then hourly
    setTimeout(onlineTimeCheck, 4000);
    setInterval(onlineTimeCheck, 60*60*1000);
    // re-apply guards after the app re-renders POS etc.
    setInterval(installSaleGuards, 3000);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 800); });
  } else {
    setTimeout(boot, 800);
  }
})();
