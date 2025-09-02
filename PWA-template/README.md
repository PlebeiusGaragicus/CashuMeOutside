# PWA-template

This folder will use the same methodology of the cashu.me PWA to create a template PWA of similar structure. The main difference is that native builts for any platform are NOT of interest. The point of the PWA is to completely avoid app stores - this will be a web-native template. The point is to be able to create a PWA of similar functionality by using cashu.me as a template.

The current functionality of cashu.me should be replaced.  Instead, this template PWA will have a few simple features:

  - show the bitcoin block height with date of last refresh.  Button underneath it to manually update the number.  Settings option to keep number updated with frequent polling, or fall back to manual-only update.
  - show current price of bitcoin (same behaviour as above)
  - Currency converter between USD <--> sats (use no other currency)
  - QR code scanner to decode a bolt11 invoice (but any QR code should be able to be decoded)

## Quick Start

This template is plain HTML/CSS/JS and runs with any static server. For camera access, serve over HTTPS.

- Simple dev server (no HTTPS):
  - Python: `python3 -m http.server 8081` and open http://localhost:8081
  - Node: `npx serve -l 8081` and open http://localhost:8081
- HTTPS option (recommended for camera):
  - Generate a local cert with mkcert, then: `npx http-server -S -C ./cert.pem -K ./key.pem -p 8081`
  - Or launch Chrome with an insecure-origin-as-secure flag for localhost during dev.

Open `PWA-template/` as the site root. The app will register a service worker and be installable.

## Project Structure

- `index.html` — App shell and UI.
- `styles.css` — Minimal, responsive dark theme.
- `main.js` — Features: block height, price, USD↔sats converter, QR scanning, settings + polling.
- `manifest.json` — PWA metadata (name, theme color, icons).
- `sw.js` — Service worker: precaches app shell; network-only for external APIs; navigation fallback.
- `icons/` — Place `icon-192.png` and `icon-512.png` here. See `icons/README.md`.

## APIs Used

- Block height sources (tried in order):
  - `https://mempool.space/api/blocks/tip/height`
  - `https://blockstream.info/api/blocks/tip/height`
  - `https://api.blockcypher.com/v1/btc/main`
- Price sources (tried in order):
  - `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd`
  - `https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT`
- QR scanning:
  - Native `BarcodeDetector` when available
  - Fallback to ZXing via ESM CDN: `@zxing/browser`

## Notes

- External API requests are always network-only; the service worker does not cache them.
- The app shell is cached for offline use. Install prompt appears when criteria are met.
- ZXing fallback requires a network fetch the first time; native detector works offline.
- Settings persist in LocalStorage: auto-update toggles and polling interval.
