import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: @walletconnect/ethereum-provider (pulled in by Privy's wallet support)
// lazily dynamic-imports @reown/appkit only when it uses its OWN modal. Privy uses
// its own modal, so that code path never runs. We mark these optional modules as
// external so Rollup doesn't fail trying to bundle a package we don't ship.
const OPTIONAL_EXTERNALS = ['@reown/appkit', '@reown/appkit/core'];

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      external: OPTIONAL_EXTERNALS,
    },
  },
  optimizeDeps: {
    exclude: OPTIONAL_EXTERNALS,
  },
});
