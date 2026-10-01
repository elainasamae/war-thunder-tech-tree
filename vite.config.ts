import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-third-party-notices',
      apply: 'build',
      async closeBundle() {
        await Promise.all(
          ['LICENSE', 'THIRD_PARTY_NOTICES.md'].map((file) =>
            copyFile(resolve(file), resolve('dist', file)),
          ),
        );
      },
    },
  ],
  base: '/',
  build: {
    rollupOptions: {
      input: { tree: resolve('index.html'), uidguard: resolve('u/index.html') },
    },
  },
  // Reuse the native project's single source of data. Vite copies these files
  // to dist unchanged; they are fetched on demand, not bundled into JavaScript.
  publicDir: 'Data',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
