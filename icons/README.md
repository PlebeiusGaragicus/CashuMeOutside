# Icons for Bitcoin PWA Template

Add at least these PNG icons (maskable preferred):

- icon-192.png (192x192)
- icon-512.png (512x512)

Recommended: include `purpose: "any maskable"` images to look great when installed. The manifest already references these paths.

How to generate quickly:

- Using pwa-asset-generator (Node):
  npx pwa-asset-generator ./logo.png ./icons --icon-only --favicon false --background "#0d1117" --padding "10%"

- Online tools:
  - https://maskable.app/editor
  - https://realfavicongenerator.net/

Place resulting files in this `icons/` folder. Service worker precache list deliberately omits icons to avoid install failures when missing.
