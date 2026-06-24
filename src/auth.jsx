import React, { createContext, useContext, useState, useRef, useEffect, Suspense, lazy } from 'react';

/* ─────────────────────────────────────────────────────────────
   Lazy auth. The heavy @privy-io/react-auth SDK is NOT in the main
   bundle — it lives in a separate chunk that only loads:
     • on idle, shortly after first paint (prefetch), and/or
     • on demand the first time someone clicks "Check in".
   The rest of the app (spectator UI, voting, bracket) renders
   immediately as a guest and never waits on Privy.
   ───────────────────────────────────────────────────────────── */

const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || '';
const PRIVY_CONFIG = {
  loginMethods: ['email', 'google', 'apple', 'twitter', 'wallet'],
  embeddedWallets: { createOnLogin: 'users-without-wallets' },
  appearance: { theme: 'dark', accentColor: '#13a05a' },
};

// Dynamic import → Rollup emits this (and all of Privy) as a separate async chunk.
const PrivyBridge = lazy(() => import('./privyBridge.jsx'));

const Ctx = createContext(null);
export function useAuth() { return useContext(Ctx); }

export function AuthProvider({ children }) {
  // State mirrored up from the Privy bridge once it loads.
  const [pv, setPv] = useState({ ready: false, authenticated: false, user: null, login: null, logout: null });
  const [load, setLoad] = useState(false);   // has the Privy chunk been requested?
  const pending = useRef(false);              // a login() click arrived before Privy was ready

  const login = () => {
    if (pv.login) pv.login();
    else { pending.current = true; setLoad(true); } // load Privy, then auto-open login when ready
  };
  const logout = () => { if (pv.logout) pv.logout(); };

  // Prefetch Privy on idle so a returning session restores and login is instant when clicked.
  useEffect(() => {
    const w = window;
    const start = () => setLoad(true);
    const handle = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 3000 }) : setTimeout(start, 1500);
    return () => { try { (w.cancelIdleCallback && w.requestIdleCallback) ? w.cancelIdleCallback(handle) : clearTimeout(handle); } catch (e) {} };
  }, []);

  // ready:true always → the app shell renders without waiting on the auth SDK.
  const value = {
    ready: true,
    authenticated: pv.authenticated,
    user: pv.user,
    login,
    logout,
    authLoading: load && !pv.ready,
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {load && (
        <Suspense fallback={null}>
          <PrivyBridge appId={PRIVY_APP_ID} config={PRIVY_CONFIG} onState={setPv} pending={pending} />
        </Suspense>
      )}
    </Ctx.Provider>
  );
}
