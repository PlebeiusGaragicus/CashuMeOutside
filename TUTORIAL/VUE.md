# Vite + Vue PWA Template (cashu.me-style)

This guide documents how we migrated the vanilla PWA template to Vue 3 + Vite while keeping cashu.me-like UX:
- Install experience (Android prompt, iOS A2HS hint)
- Offline-aware UI and auto-update service worker
- Clean component structure for the app shell and features

## Tech Stack
- Vue 3 + `<script setup>`
- Vue Router (SPA)
- Vite
- vite-plugin-pwa (GenerateSW, auto updates)

## Project Layout
- `PWA-template/index.html` – minimal entry with `#app` and Vite module script
- `PWA-template/src/main.js` – bootstraps Vue app and imports `styles.css`
- `PWA-template/src/App.vue` – app shell, banners, install UX, network detection, update banner
- `PWA-template/src/router.js` – routes
- `PWA-template/src/views/HomeView.vue` – core features: height, price, converter, QR scanner, polling
- `PWA-template/styles.css` – theme and layout (imported by Vite)
- `PWA-template/vite.config.js` – PWA plugin, manifest, dev server
- `PWA-template/public/` – static assets (icons, robots, etc)

## PWA Setup
`vite.config.js`:
- `VitePWA({ registerType: 'autoUpdate', workbox: { skipWaiting: true, clientsClaim: true }, manifest: { ... } })`
- Auto-update SW: The app shows an update banner using `useRegisterSW` and applies the new SW on reload.
- Manifest includes `protocol_handlers` for `web+cashu` and `web+lightning`.
- Icons: Place maskable icons in `PWA-template/public/icons/` and reference them in manifest. Example (SVG placeholders used here):
  - `public/icons/icon-192.svg`, `public/icons/icon-512.svg` (maskable)

`src/App.vue`:
- Uses `useRegisterSW` from `virtual:pwa-register/vue` to show the update available banner and call `updateServiceWorker()`.
- Handles `beforeinstallprompt` to enable an Install button on Android.
- Detects iOS Safari and shows an A2HS hint (Share → Add to Home Screen) with dismiss persistence in `localStorage`.
- Tracks `navigator.onLine` to surface offline status.

## Feature Port (HomeView.vue)
- Block height: tries multiple APIs (mempool.space, blockstream.info, blockcypher). Network-only via `fetch(..., { cache: 'no-store' })`.
- Price (USD): tries CoinGecko, Binance. Network-only fetch.
- Converter: USD ↔ sats; recalculates after price refresh; no floating drift (sats reads use `Math.floor`).
- Polling: optional auto-refresh with interval (5–3600s), persisted in `localStorage`.
- QR scanner: prefers `BarcodeDetector` when available; falls back to ZXing via CDN `@zxing/browser` + ESM. Supports live camera and image file decoding.

Security note: All external API calls are network-only and not cached by the SW.

## Run & Build
```
# from PWA-template
npm install
npm run dev   # http://localhost:5175
npm run build
npm run preview -- --port 5174
```

## What to Verify
- Install banner (Android). On iOS Safari, A2HS hint shows only in browser display-mode.
- Offline UI banner appears when disconnected.
- SW update banner appears after a new build; reload to apply.
- Height/price refresh works; auto-refresh if toggled; converter updates.
- QR scanner works with camera and image upload. Works only on secure origins (https or localhost).

## Next Improvements
- Replace CDN ZXing with npm dependency for full offline capability.
- Add proper maskable PNG icons (192/512) under `public/icons/`.
- Add global theme variables to a dedicated CSS module or PostCSS.
- Add more views/components if needed and introduce state management (Pinia) if the app grows.
