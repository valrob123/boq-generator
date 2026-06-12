import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` is required so the production build loads correctly from the
// file:// protocol inside the packaged Electron app.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
  },
});
