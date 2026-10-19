import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative Pfade statt "/": Damit funktioniert derselbe Build auf einem
  // Projekt-Unterpfad (https://<user>.github.io/<repo>/) wie auch auf localhost.
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
});
