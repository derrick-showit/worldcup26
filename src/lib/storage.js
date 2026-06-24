// Storage layer ported from the source index.html <script>.
// Shared keys (vote:, chat:, cmt:, player:) -> Supabase kv table.
// Local keys (picks, bracket, tp, played, identity-derived per-user) -> localStorage.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// SHARED works when both Supabase env vars are present; else local-only.
// NOTE: Privy owns auth now — we do NOT use Supabase Auth email magic links.
export const SHARED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const sb = SHARED ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const LS = (k) => 'owc:' + k;
const cache = {};

function sharedKey(k) {
  return k.startsWith('vote:') || k.startsWith('chat:') || k.startsWith('cmt:') || k.startsWith('player:');
}

export const storage = {
  get(key) {
    if (SHARED && sharedKey(key)) return key in cache ? { key, value: cache[key] } : null;
    const v = localStorage.getItem(LS(key));
    return v == null ? null : { key, value: v };
  },
  set(key, value) {
    if (SHARED && sharedKey(key)) {
      cache[key] = value;
      sb.from('kv').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
        .then(({ error }) => { if (error) console.warn('[set]', error.message); });
      return { key, value };
    }
    localStorage.setItem(LS(key), value);
    return { key, value };
  },
  delete(key) {
    if (SHARED && sharedKey(key)) {
      delete cache[key];
      sb.from('kv').delete().eq('key', key).then(() => {});
      return { key, deleted: true };
    }
    localStorage.removeItem(LS(key));
    return { key, deleted: true };
  },
  list(prefix = '') {
    if (SHARED && sharedKey(prefix)) return { keys: Object.keys(cache).filter((k) => k.startsWith(prefix)), prefix };
    const out = [], pre = LS(prefix);
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(pre)) out.push(k.slice(4));
    }
    return { keys: out, prefix };
  },
};

export const J = {
  get(key, fb) {
    const r = storage.get(key);
    if (!r) return fb;
    try { return JSON.parse(r.value); } catch { return fb; }
  },
  set(key, o) { storage.set(key, JSON.stringify(o)); },
};

export async function hydrate() {
  if (!SHARED) return;
  const { data, error } = await sb.from('kv').select('key,value');
  if (error) { console.warn('[hydrate]', error.message); return; }
  (data || []).forEach((r) => { cache[r.key] = r.value; });
}

let _live = null;
// onLive() callback is wired by the app to trigger a re-render on remote changes.
export function subscribeRealtime(onLive) {
  if (!SHARED) return;
  sb.channel('kv-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kv' }, (p) => {
      const row = p.new || p.old;
      if (!row || !row.key) return;
      if (p.eventType === 'DELETE') delete cache[row.key];
      else cache[row.key] = row.value;
      clearTimeout(_live);
      _live = setTimeout(() => { onLive && onLive(); }, 300);
    })
    .subscribe();
}
