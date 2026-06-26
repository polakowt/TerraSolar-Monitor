import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: the Gemini API key is intentionally NOT injected into the client bundle.
// AI analysis runs server-side in api/analyze.ts, which reads GEMINI_API_KEY
// from the server environment.
export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
