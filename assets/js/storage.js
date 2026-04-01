/*  SIG CONQUEST V2 — storage.js
    LocalStorage + IndexedDB 관리
    ──────────────────────────────────────── */

const STORAGE_KEY      = 'SIG_CONQUEST_STATE_V40';
const UNDO_KEY         = 'SIG_CONQUEST_UNDO_V40';
const SIG_ASSIGN_KEY   = 'SIG_ASSIGN_V40';
const SIG_ASSIGN_TS    = 'SIG_ASSIGN_TS';
const VISUAL_KEY       = 'SIG_VISUAL_V40';
const MAX_UNDO         = 15;

const SigStorage = {

  save(state) {
    const json = JSON.stringify(state);
    // undo 스택
    const stack = this._getUndo();
    stack.push(json);
    if (stack.length > MAX_UNDO) stack.shift();
    try { localStorage.setItem(UNDO_KEY, JSON.stringify(stack)); } catch {}
    // 실제 저장
    localStorage.setItem(STORAGE_KEY, json);
    window.dispatchEvent(new CustomEvent('sig_state_change'));
  },

  saveOnly(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    window.dispatchEvent(new CustomEvent('sig_state_change'));
  },

  load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
    catch { return null; }
  },

  canUndo()  { return this._getUndo().length > 0; },
  undo() {
    const stack = this._getUndo();
    if (!stack.length) return false;
    const prev = stack.pop();
    try { localStorage.setItem(UNDO_KEY, JSON.stringify(stack)); } catch {}
    localStorage.setItem(STORAGE_KEY, prev);
    window.dispatchEvent(new CustomEvent('sig_state_change'));
    return true;
  },

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(UNDO_KEY);
  },

  onChange(cb) {
    const handler = () => { const s = this.load(); if (s) cb(s); };
    window.addEventListener('sig_state_change', handler);
    window.addEventListener('storage', e => {
      if (e.key === STORAGE_KEY) handler();
    });
  },

  /* 이동 애니메이션용 경량 동기화 */
  sendVisual(data) {
    localStorage.setItem(VISUAL_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('sig_visual_change'));
  },
  onVisual(cb) {
    const handler = () => {
      try { cb(JSON.parse(localStorage.getItem(VISUAL_KEY))); } catch {}
    };
    window.addEventListener('sig_visual_change', handler);
    window.addEventListener('storage', e => {
      if (e.key === VISUAL_KEY) handler();
    });
  },

  _getUndo() {
    try { return JSON.parse(localStorage.getItem(UNDO_KEY)) || []; }
    catch { return []; }
  },
};

/* ── IndexedDB (SIG 이미지) ────────────── */

let _db = null;
function getDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((res, rej) => {
    const req = indexedDB.open('SigImagesDB', 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore('pool', { keyPath: 'uid' });
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror   = e => rej(e.target.error);
  });
}
const idbGetAll = () => getDB().then(db => new Promise((res,rej) => {
  const r = db.transaction('pool','readonly').objectStore('pool').getAll();
  r.onsuccess = () => res(r.result); r.onerror = e => rej(e.target.error);
}));
const idbPut = rec => getDB().then(db => new Promise((res,rej) => {
  const r = db.transaction('pool','readwrite').objectStore('pool').put(rec);
  r.onsuccess = () => res(); r.onerror = e => rej(e.target.error);
}));
const idbDelete = uid => getDB().then(db => new Promise((res,rej) => {
  const r = db.transaction('pool','readwrite').objectStore('pool').delete(uid);
  r.onsuccess = () => res(); r.onerror = e => rej(e.target.error);
}));
const idbClear = () => getDB().then(db => new Promise((res,rej) => {
  const r = db.transaction('pool','readwrite').objectStore('pool').clear();
  r.onsuccess = () => res(); r.onerror = e => rej(e.target.error);
}));

const makeUid    = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const loadAssign = () => { try { return JSON.parse(localStorage.getItem(SIG_ASSIGN_KEY)||'{}'); } catch { return {}; } };
const saveAssign = obj => { localStorage.setItem(SIG_ASSIGN_KEY, JSON.stringify(obj)); localStorage.setItem(SIG_ASSIGN_TS, Date.now().toString()); };
