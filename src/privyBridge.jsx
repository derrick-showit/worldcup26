import React, { useEffect } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';

/* Loaded lazily by auth.jsx. Mounts PrivyProvider and mirrors its state up
   into the AuthProvider via onState, and fires a queued login() once ready. */
function Sync({ onState, pending }) {
  const p = usePrivy();
  useEffect(() => {
    onState({ ready: p.ready, authenticated: p.authenticated, user: p.user, login: p.login, logout: p.logout });
  }, [p.ready, p.authenticated, p.user, onState]);
  useEffect(() => {
    if (p.ready && pending.current) { pending.current = false; p.login(); }
  }, [p.ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function PrivyBridge({ appId, config, onState, pending }) {
  return (
    <PrivyProvider appId={appId} config={config}>
      <Sync onState={onState} pending={pending} />
    </PrivyProvider>
  );
}
