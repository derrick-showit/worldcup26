// src/storage.js
// Drop-in replacement for Claude's `window.storage` API.
//   shared: true   -> stored in Supabase  (visible to everyone in the pool)
//   shared: false  -> stored in localStorage (this browser/device only, e.g. "who am I")
//
// The app calls window.storage.{get,set,list,delete}. We assign it here on import,
// and main.jsx imports this file BEFORE App.jsx so it's ready when the app evaluates.

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Helpful console message during setup; the app will still mount.
  console.warn("[storage] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — shared data will not persist. See README.");
}

const supabase = url && anon ? createClient(url, anon) : null;
const LS = (k) => "wc26local:" + k;

export const storage = {
  async get(key, shared = false) {
    if (!shared || !supabase) {
      const v = localStorage.getItem(LS(key));
      return v == null ? null : { key, value: v, shared };
    }
    const { data, error } = await supabase.from("kv").select("value").eq("key", key).maybeSingle();
    if (error) throw error;
    return data ? { key, value: data.value, shared } : null;
  },

  async set(key, value, shared = false) {
    if (!shared || !supabase) {
      localStorage.setItem(LS(key), value);
      return { key, value, shared };
    }
    const { error } = await supabase.from("kv").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    if (!shared || !supabase) {
      localStorage.removeItem(LS(key));
      return { key, deleted: true, shared };
    }
    const { error } = await supabase.from("kv").delete().eq("key", key);
    if (error) throw error;
    return { key, deleted: true, shared };
  },

  async list(prefix = "", shared = false) {
    if (!shared || !supabase) {
      const keys = [];
      const pre = "wc26local:" + prefix;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(pre)) keys.push(k.slice("wc26local:".length));
      }
      return { keys, prefix, shared };
    }
    const { data, error } = await supabase.from("kv").select("key").like("key", prefix + "%");
    if (error) throw error;
    return { keys: (data || []).map((r) => r.key), prefix, shared };
  },
};

if (typeof window !== "undefined") window.storage = storage;
