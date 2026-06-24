import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './auth.jsx';
import App from './App.jsx';
import './styles.css';

// No static Privy import here — the SDK is loaded lazily by AuthProvider,
// so it stays out of the main bundle and the app paints immediately.
createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
