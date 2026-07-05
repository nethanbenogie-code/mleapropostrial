/* ============================================================
   MLEA POS v6.0 — 03-security.js
   PIN hashing (SHA-256 + salt), session timer, lockout
   Part of a multi-file build. Load order matters — see index.html.
   Shares global scope with sibling modules (no import/export).
   ============================================================ */

// ════════════════════════════════════════════
// PIN HASHING — Web Crypto API (SHA-256 + salt)
// Replaces plaintext PIN storage.
// Format stored: "salt:hash" where both are hex strings.
//
// IMPORTANT: crypto.subtle only exists in "secure
// contexts" (https:// or http://localhost). When the
// app is served over a plain LAN IP (e.g.
// http://192.168.x.x) crypto.subtle is undefined.
// To keep the POS working on a local network we fall
// back to a pure-JS SHA-256 (same algorithm + format,
// so existing hashed PINs stay compatible).
// ════════════════════════════════════════════

// Pure-JS SHA-256 (used only when crypto.subtle is unavailable).
function _sha256js(ascii) {
  function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = '';
  const words = [];
  const asciiBitLength = ascii.length * 8;
  let hash = _sha256js.h = _sha256js.h || [];
  const k = _sha256js.k = _sha256js.k || [];
  let primeCounter = k.length;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1/3) * maxWord) | 0;
    }
  }
  // Re-init hash each call (h above is the seed table; copy it)
  hash = hash.slice(0, 8);
  let h0 = hash.slice();
  ascii += '\x80';
  while (ascii.length % 64 - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, j += 16);
    const oldHash = h0;
    h0 = h0.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = h0[0], e = h0[4];
      const temp1 = h0[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & h0[5]) ^ ((~e) & h0[6]))
        + k[i]
        + (w[i] = (i < 16) ? w[i] : (
            w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
          ) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & h0[1]) ^ (a & h0[2]) ^ (h0[1] & h0[2]));
      h0 = [(temp1 + temp2) | 0].concat(h0);
      h0[4] = (h0[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) h0[i] = (h0[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (h0[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

// UTF-8 encode a string into a byte-string for _sha256js
function _utf8(str) {
  return unescape(encodeURIComponent(str));
}

// Returns true if the secure Web Crypto digest is available
function _hasSubtle() {
  try { return !!(window.crypto && window.crypto.subtle && window.crypto.subtle.digest); }
  catch (e) { return false; }
}

// SHA-256 hex of a string — uses native crypto.subtle when available,
// otherwise the pure-JS fallback. Works on every origin.
async function _sha256hex(str) {
  if (_hasSubtle()) {
    const data = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }
  // Fallback (non-secure origin like http://192.168.x.x)
  return _sha256js(_utf8(str));
}

// Random hex salt — uses crypto.getRandomValues when available,
// otherwise a Math.random fallback (fine for per-PIN salting).
function _randomSalt(bytes) {
  bytes = bytes || 16;
  try {
    if (window.crypto && window.crypto.getRandomValues) {
      const arr = crypto.getRandomValues(new Uint8Array(bytes));
      return Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
    }
  } catch (e) {}
  let s = '';
  for (let i = 0; i < bytes; i++) s += Math.floor(Math.random()*256).toString(16).padStart(2,'0');
  return s;
}

async function hashPIN(pin, salt) {
  // Generate a random salt if not provided (new PINs)
  if (!salt) salt = _randomSalt(16);
  const hashHex = await _sha256hex(salt + pin);
  return { hash: hashHex, salt, stored: salt + ':' + hashHex };
}

async function verifyPIN(pin, stored) {
  // Support legacy plaintext PINs (migration path)
  if (!stored || !stored.includes(':')) {
    // Legacy: direct comparison, then auto-upgrade on success
    return stored === pin ? 'legacy' : false;
  }
  const [salt, expectedHash] = stored.split(':');
  const { hash } = await hashPIN(pin, salt);
  return hash === expectedHash ? 'hashed' : false;
}

async function hashAndStorePIN(userId, pin) {
  const { stored } = await hashPIN(pin);
  const u = LocalDB.getById('users', userId);
  if (u) { u.pin = stored; LocalDB.update('users', u); }
  if (storageMode === 'firebase') {
    const fu = FirebaseDB.getById('users', userId);
    if (fu) { fu.pin = stored; FirebaseDB.update('users', fu); }
  }
  return stored;
}

// Migrate all plaintext PINs to hashed on first run
async function migratePlaintextPINs() {
  const users = LocalDB.getAll('users');
  let migrated = 0;
  for (const u of users) {
    if (u.pin && !u.pin.includes(':')) {
      // Plaintext detected — hash it
      const { stored } = await hashPIN(u.pin);
      u.pin = stored;
      LocalDB.update('users', u);
      if (storageMode === 'firebase') {
        const fu = FirebaseDB.getById('users', u.id);
        if (fu) { fu.pin = stored; FirebaseDB.update('users', fu); }
      }
      migrated++;
    }
  }
  if (migrated > 0) {
    console.log(`PIN migration: ${migrated} user(s) upgraded to hashed storage`);
    logAct('Security', `PIN hashing migration: ${migrated} user(s) upgraded`);
  }
  return migrated;
}

function resetSesTimer(){
  clearTimeout(sesTimer);clearTimeout(sesWarnTimer);if(!currentUser)return;
  const mins=parseInt(getSetting('ses_timeout','30'))||30;
  const ms=mins*60*1000;
  // Warn 60 seconds before expiry
  sesWarnTimer=setTimeout(()=>{
    if(currentUser)toast('⏱ Session expiring in 60 seconds. Tap anywhere to stay logged in.','gold',10000);
  },Math.max(0,ms-60000));
  sesTimer=setTimeout(()=>{if(currentUser){toast('Session expired — please sign in again','gold');logout();}},ms);
}
let sesWarnTimer=null;
document.addEventListener('click',resetSesTimer);
document.addEventListener('keydown',resetSesTimer);

function chkLock(){
  if(Date.now()<pinLockUntil){
    const sec=Math.ceil((pinLockUntil-Date.now())/1000);
    const lb=document.getElementById('lockoutBar');
    if(lb){lb.style.display='block';lb.textContent='🔒 Too many failed attempts. Try again in '+sec+'s';}
    document.querySelectorAll('.pbn').forEach(b=>b.disabled=true);
    setTimeout(chkLock,1000);return true;
  }
  const lb=document.getElementById('lockoutBar');if(lb)lb.style.display='none';
  document.querySelectorAll('.pbn').forEach(b=>b.disabled=false);
  pinFails=0;return false;
}

