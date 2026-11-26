/* QuestFit — cloud sync between devices using Supabase (free tier).
 * One row per user in the "saves" table holds the whole save as JSON.
 * Sync rule: whichever side changed since the last sync wins; if both changed, the player chooses.
 */
'use strict';

const Cloud = (() => {
  const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';
  const CFG_KEY = 'questfit.cloud.cfg';
  const SYNC_KEY = 'questfit.cloud.lastSync';
  let client = null, user = null, status = 'off', lastError = '', pushTimer = null, busy = false;
  let listeners = [];
  let conflictHandler = null;   // async (local, remote) => 'local' | 'cloud'
  let appliedHandler = null;    // () => void, after a cloud save replaced the local one

  const read = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
  function config() {
    const file = window.QUESTFIT_CLOUD || {};
    let saved = {};
    try { saved = JSON.parse(read(CFG_KEY, '{}')); } catch { saved = {}; }
    // The project built into the app always wins; typed-in details are only used when none is built in.
    if (file.url && file.anonKey) return { url: file.url.trim(), anonKey: file.anonKey.trim(), builtIn: true };
    return { url: (saved.url || '').trim(), anonKey: (saved.anonKey || '').trim(), builtIn: false };
  }
  const configured = () => { const c = config(); return /^https:\/\/.+/.test(c.url) && c.anonKey.length > 20; };
  function setConfig(url, anonKey) { write(CFG_KEY, JSON.stringify({ url: String(url || '').trim(), anonKey: String(anonKey || '').trim() })); client = null; }
  const lastSync = () => Number(read(SYNC_KEY, '0')) || 0;
  const setLastSync = (ms) => write(SYNC_KEY, String(ms));

  function setStatus(s, err = '') { status = s; lastError = err; listeners.forEach(fn => { try { fn(info()); } catch { /* ignore */ } }); }
  function info() { const c = config(); let host = ''; try { host = c.url ? new URL(c.url).host : ''; } catch { host = ''; } return { status, error: lastError, email: user && user.email, configured: configured(), lastSync: lastSync(), host, builtIn: !!c.builtIn }; }
  function onChange(fn) { listeners.push(fn); }

  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = LIB; s.async = true;
      s.onload = () => res(); s.onerror = () => rej(new Error('Could not load the sync library (are you offline?)'));
      document.head.appendChild(s);
    });
  }
  async function getClient() {
    if (client) return client;
    if (!configured()) throw new Error('Cloud sync is not set up yet');
    await loadLib();
    const c = config();
    client = window.supabase.createClient(c.url, c.anonKey, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'questfit.cloud.auth' } });
    return client;
  }

  async function init({ onConflict, onApplied } = {}) {
    conflictHandler = onConflict || conflictHandler;
    appliedHandler = onApplied || appliedHandler;
    if (!configured()) { setStatus('off'); return; }
    try {
      const c = await getClient();
      const { data } = await c.auth.getSession();
      user = data && data.session ? data.session.user : null;
      if (!user) { setStatus('signed-out'); return; }
      await sync('open');
    } catch (e) { setStatus('error', e.message || String(e)); }
  }

  async function signIn(email, password) {
    const c = await getClient();
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    user = data.user;
    await sync('login');
  }
  async function signUp(email, password) {
    const c = await getClient();
    const { data, error } = await c.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    if (!data.session) return { confirm: true };   // project requires email confirmation
    user = data.user;
    await sync('login');
    return { confirm: false };
  }
  async function signOut() {
    try { if (client) await client.auth.signOut(); } catch { /* ignore */ }
    user = null;
    setLastSync(0);
    setStatus(configured() ? 'signed-out' : 'off');
  }

  async function fetchRemote() {
    const c = await getClient();
    const { data, error } = await c.from('saves').select('data, updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { save: data.data, at: new Date(data.updated_at).getTime() } : null;
  }
  /* Upload, but only if the cloud still holds the version we expect (expectedAt = null means "no save yet").
     Returns false if the other device got there first, so nothing is ever silently overwritten. */
  async function push(expectedAt) {
    if (!user || !Game.state) return true;
    const c = await getClient();
    const at = (Game.state.meta && Game.state.meta.updatedAt) || Date.now();
    const row = { data: Game.state, updated_at: new Date(at).toISOString() };
    if (expectedAt == null) {
      const { error } = await c.from('saves').insert({ user_id: user.id, ...row });
      if (error) { if (error.code === '23505' || /duplicate/i.test(error.message)) return false; throw new Error(error.message); }
    } else {
      const { data, error } = await c.from('saves').update(row).eq('user_id', user.id).eq('updated_at', new Date(expectedAt).toISOString()).select('updated_at');
      if (error) throw new Error(error.message);
      if (!data || !data.length) return false;
    }
    setLastSync(at);
    return true;
  }
  function apply(remote) {
    if (!Game.replaceState(remote.save)) throw new Error('The cloud save looks broken');
    setLastSync(remote.at);
    if (appliedHandler) appliedHandler();
  }

  /* Compare this device with the cloud and move the newer save to the other side. */
  async function sync(reason = 'manual') {
    if (!user || busy) return;
    busy = true;
    setStatus('syncing');
    try {
      const remote = await fetchRemote();
      const localAt = (Game.state && Game.state.meta && Game.state.meta.updatedAt) || 0;
      const base = lastSync();
      let ok = true;
      if (!remote) { if (Game.state) ok = await push(null); }
      else if (!Game.state) apply(remote);
      else {
        const remoteChanged = remote.at > base, localChanged = localAt > base;
        if (remoteChanged && localChanged && remote.at !== localAt) {
          const choice = conflictHandler ? await conflictHandler(Game.state, remote.save, reason) : 'cloud';
          if (choice === 'local') ok = await push(remote.at); else apply(remote);
        } else if (remoteChanged) apply(remote);
        else if (localChanged) ok = await push(remote.at);
      }
      if (!ok) { busy = false; return sync('retry'); }   // the cloud changed under us: compare again
      setStatus('synced');
    } catch (e) {
      setStatus('error', e.message || String(e));
    } finally { busy = false; }
  }

  /* Called after every local save: upload a few seconds later (batches quick changes). */
  function scheduleUpload() {
    if (!user) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(async () => {
      if (busy) { scheduleUpload(); return; }
      busy = true;
      setStatus('syncing');
      try {
        // Make sure the cloud wasn't changed by the other device in the meantime.
        const remote = await fetchRemote();
        if ((remote && remote.at > lastSync()) || !(await push(remote ? remote.at : null))) { busy = false; await sync('upload'); return; }
        setStatus('synced');
      } catch (e) { setStatus('error', e.message || String(e)); }
      busy = false;
    }, 2500);
  }

  return { init, signIn, signUp, signOut, sync, scheduleUpload, info, onChange, configured, config, setConfig };
})();
