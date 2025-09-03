# PWA-template

NOTE: the submodule cashu.me should NOT be edited in any way - it only exists for reference.

This repo attempts to build a PWA inspired from ./Inpiration/cashu.me.  It aims to use the same methodology of the cashu.me PWA to create a template PWA of similar structure and functionality. The main difference is that native builts for any platform are NOT of interest. The point of the PWA is to completely avoid "app stores" - this will instead be web-native and web-only. The point is to be able to create a PWA of similar functionality and style by using cashu.me as a template.

The current functionality of cashu.me should be replaced.  Instead, this template PWA will have a few simple features:

  - show the bitcoin block height with date of last refresh.  Button **underneath** it to manually update the number.  In the settings menu there's an option to keep number updated with frequent polling, update upon app-open, or fall back to manual-only update.
  - show current price of bitcoin (same behaviour as above)
  - Currency converter between USD <--> sats (settings menu option to select currency between English-speaking countries)
  - QR code scanner to decode a bolt11 invoice (but any QR code should be able to be decoded)

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
