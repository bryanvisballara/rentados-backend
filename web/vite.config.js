import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const RENTADOS_BUILD_ID = process.env.VITE_BUILD_ID || String(Date.now());

const cacheBootstrapScript = `
(function () {
  var build = ${JSON.stringify(RENTADOS_BUILD_ID)};
  var key = 'rentados_web_build';
  try {
    var prev = localStorage.getItem(key);
    if (prev === build) return;
    localStorage.setItem(key, build);
    if ('caches' in window) {
      caches.keys().then(function (names) {
        names.forEach(function (name) { caches.delete(name); });
      });
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) { reg.unregister(); });
      });
    }
    if (prev) location.reload();
  } catch (e) {}
})();
`.trim();

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'rentados-cache-bootstrap',
      transformIndexHtml(html) {
        const tag = `<meta name="rentados-build" content="${RENTADOS_BUILD_ID}" />`;
        const script = `<script>${cacheBootstrapScript}</script>`;
        return html.replace('</head>', `    ${tag}\n    ${script}\n  </head>`);
      },
    },
  ],
  server: {
    host: true,
    port: 5578,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
