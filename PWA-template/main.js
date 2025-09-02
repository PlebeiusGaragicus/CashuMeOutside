// Bitcoin PWA Template - main logic
// Network-only for external APIs; service worker only caches the app shell.

const $ = (sel) => document.querySelector(sel);

// Elements
const el = {
  swStatus: $('#sw-status'),
  netStatus: $('#net-status'),
  cameraStatus: $('#camera-status'),
  installHint: $('#install-hint'),

  heightValue: $('#height-value'),
  heightUpdated: $('#height-updated'),
  heightSource: $('#height-source'),
  btnHeight: $('#btn-refresh-height'),

  priceValue: $('#price-value'),
  priceUpdated: $('#price-updated'),
  priceSource: $('#price-source'),
  btnPrice: $('#btn-refresh-price'),

  usd: $('#usd-input'),
  sats: $('#sats-input'),

  btnStartScan: $('#btn-start-scan'),
  btnStopScan: $('#btn-stop-scan'),
  btnCopyQR: $('#btn-copy-qr'),
  qrFile: $('#qr-file'),
  qrLive: $('#qr-live'),
  qrVideo: $('#qr-video'),
  qrCanvas: $('#qr-canvas'),
  qrOutput: $('#qr-output'),

  autoHeight: $('#auto-height'),
  autoPrice: $('#auto-price'),
  pollInterval: $('#poll-interval'),

  // PWA UX
  btnInstall: $('#btn-install'),
  updateBanner: $('#update-banner'),
  btnReload: $('#btn-reload'),
  offlineBanner: $('#offline-banner'),
  iosBanner: $('#ios-banner'),
  btnIosDismiss: $('#btn-ios-dismiss'),
};

// State & settings
const LS_STATE = 'btcPwa.state';
const LS_SETTINGS = 'btcPwa.settings';

const state = load(LS_STATE, {
  height: null,
  heightUpdated: null,
  heightSource: '',
  priceUsd: null,
  priceUpdated: null,
  priceSource: '',
  qrText: '',
});

const settings = load(LS_SETTINGS, {
  autoHeight: false,
  autoPrice: false,
  pollIntervalSec: 30,
});

let pollTimer = null;
let scanning = false;
let stopScanLoop = null; // function to stop active scan loop
let zxingReader = null; // ZXing instance when used

function save(key, obj) { localStorage.setItem(key, JSON.stringify(obj)); }
function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } }
function ts() { return new Date().toISOString(); }
function fmt(dtIso) { if (!dtIso) return 'never'; const d = new Date(dtIso); return d.toLocaleString(); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

// PWA UX helpers/state
let deferredPWAInstallPrompt = null;
const IOS_DISMISS_KEY = 'btcPwa.iosBanner.dismissed';
function getPwaDisplayMode() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  if (document.referrer.startsWith('android-app://')) return 'twa';
  if (navigator.standalone || isStandalone) return 'standalone';
  return 'browser';
}
function isIosSafari() {
  const ua = navigator.userAgent.toLowerCase();
  const isiOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/crios|fxios|chrome|android/.test(ua);
  return isiOS && isSafari;
}
function updateInstallUI() {
  const show = !!deferredPWAInstallPrompt && getPwaDisplayMode() === 'browser';
  if (el.btnInstall) el.btnInstall.hidden = !show;
  if (el.installHint) el.installHint.hidden = !show;
}
function updateNetworkUI() {
  const online = navigator.onLine;
  if (el.netStatus) el.netStatus.textContent = online ? 'online' : 'offline';
  if (el.offlineBanner) el.offlineBanner.hidden = online;
}
function maybeShowIosBanner() {
  if (!el.iosBanner) return;
  const dismissed = localStorage.getItem(IOS_DISMISS_KEY) === '1';
  if (dismissed) { el.iosBanner.hidden = true; return; }
  if (isIosSafari() && getPwaDisplayMode() === 'browser') {
    el.iosBanner.hidden = false;
  } else {
    el.iosBanner.hidden = true;
  }
}

// Populate footer year
$('#year').textContent = String(new Date().getFullYear());

// Service worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      el.swStatus.textContent = 'registered';

      // Listen for updates
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Update available
              el.swStatus.textContent = 'update ready';
              if (el.updateBanner) el.updateBanner.hidden = false;
            } else {
              el.swStatus.textContent = 'installed';
            }
          }
        });
      });

      // If already waiting (edge case)
      if (reg.waiting) {
        el.swStatus.textContent = 'update ready';
        if (el.updateBanner) el.updateBanner.hidden = false;
      }

      // Reflect active status
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        el.swStatus.textContent = 'active';
      });
    }).catch(() => {
      el.swStatus.textContent = 'failed';
    });
  });
} else {
  el.swStatus.textContent = 'unsupported';
}

// Install UX
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPWAInstallPrompt = e;
  updateInstallUI();
});
window.addEventListener('appinstalled', () => {
  deferredPWAInstallPrompt = null;
  updateInstallUI();
});
if (el.btnInstall) {
  el.btnInstall.addEventListener('click', async () => {
    if (!deferredPWAInstallPrompt) return;
    deferredPWAInstallPrompt.prompt();
    const choice = await deferredPWAInstallPrompt.userChoice.catch(()=>null);
    deferredPWAInstallPrompt = null;
    updateInstallUI();
  });
}
if (el.btnReload) {
  el.btnReload.addEventListener('click', () => location.reload());
}
if (el.btnIosDismiss) {
  el.btnIosDismiss.addEventListener('click', () => {
    localStorage.setItem(IOS_DISMISS_KEY, '1');
    if (el.iosBanner) el.iosBanner.hidden = true;
  });
}

// Network awareness
updateNetworkUI();
window.addEventListener('online', updateNetworkUI);
window.addEventListener('offline', updateNetworkUI);
maybeShowIosBanner();

// Camera status
(async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.isSecureContext) {
    el.cameraStatus.textContent = 'unavailable';
    return;
  }
  el.cameraStatus.textContent = 'available';
})();

// UI initial fill
function updateHeightUI() {
  el.heightValue.textContent = state.height ?? '—';
  el.heightUpdated.textContent = fmt(state.heightUpdated);
  el.heightSource.textContent = state.heightSource;
}
function updatePriceUI() {
  el.priceValue.textContent = state.priceUsd != null ? state.priceUsd.toFixed(2) : '—';
  el.priceUpdated.textContent = fmt(state.priceUpdated);
  el.priceSource.textContent = state.priceSource;
}
function updateSettingsUI() {
  el.autoHeight.checked = !!settings.autoHeight;
  el.autoPrice.checked = !!settings.autoPrice;
  el.pollInterval.value = String(settings.pollIntervalSec);
}

updateHeightUI();
updatePriceUI();
updateSettingsUI();

// Fetch helpers
async function fetchText(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.text();
}
async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
}

async function getBlockHeight() {
  const tries = [
    async () => ({ value: parseInt(await fetchText('https://mempool.space/api/blocks/tip/height'), 10), source: 'mempool.space' }),
    async () => ({ value: parseInt(await fetchText('https://blockstream.info/api/blocks/tip/height'), 10), source: 'blockstream.info' }),
    async () => { const j = await fetchJson('https://api.blockcypher.com/v1/btc/main'); return { value: j.height|0, source: 'blockcypher' }; },
  ];
  let lastErr;
  for (const t of tries) {
    try { const r = await t(); if (Number.isFinite(r.value)) return r; } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('All sources failed');
}

async function getPriceUsd() {
  const tries = [
    async () => { const j = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'); return { value: Number(j.bitcoin.usd), source: 'coingecko' }; },
    async () => { const j = await fetchJson('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'); return { value: Number(j.price), source: 'binance' }; },
  ];
  let lastErr;
  for (const t of tries) {
    try {
      const r = await t();
      if (Number.isFinite(r.value)) return r;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('All sources failed');
}

async function refreshHeight() {
  el.btnHeight.disabled = true;
  try {
    const r = await getBlockHeight();
    state.height = r.value;
    state.heightUpdated = ts();
    state.heightSource = r.source;
    save(LS_STATE, state);
    updateHeightUI();
  } catch (e) {
    el.heightSource.textContent = 'failed';
  } finally {
    el.btnHeight.disabled = false;
  }
}

async function refreshPrice() {
  el.btnPrice.disabled = true;
  try {
    const r = await getPriceUsd();
    state.priceUsd = r.value;
    state.priceUpdated = ts();
    state.priceSource = r.source;
    save(LS_STATE, state);
    updatePriceUI();
    // re-run converter if one side has input
    if (document.activeElement !== el.usd && el.usd.value) onUsdInput();
    if (document.activeElement !== el.sats && el.sats.value) onSatsInput();
  } catch (e) {
    el.priceSource.textContent = 'failed';
  } finally {
    el.btnPrice.disabled = false;
  }
}

// Converter
let updatingConverter = false;
function satsPerBtc() { return 100_000_000; }
function onUsdInput() {
  if (updatingConverter) return; updatingConverter = true;
  const usd = Number(el.usd.value);
  if (!Number.isFinite(usd) || usd < 0 || !state.priceUsd) { el.sats.value = ''; updatingConverter = false; return; }
  const sats = Math.floor((usd / state.priceUsd) * satsPerBtc());
  el.sats.value = String(sats);
  updatingConverter = false;
}
function onSatsInput() {
  if (updatingConverter) return; updatingConverter = true;
  const sats = Number(el.sats.value);
  if (!Number.isFinite(sats) || sats < 0 || !state.priceUsd) { el.usd.value = ''; updatingConverter = false; return; }
  const usd = (sats / satsPerBtc()) * state.priceUsd;
  el.usd.value = usd.toFixed(2);
  updatingConverter = false;
}

el.usd.addEventListener('input', onUsdInput);
el.sats.addEventListener('input', onSatsInput);

// Polling
function setupPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (!settings.autoHeight && !settings.autoPrice) return;
  const iv = clamp(Number(settings.pollIntervalSec) || 30, 5, 3600);
  const tick = async () => {
    if (settings.autoHeight) refreshHeight();
    if (settings.autoPrice) refreshPrice();
  };
  // run immediately then repeat
  tick();
  pollTimer = setInterval(tick, iv * 1000);
}

// Bind controls
el.btnHeight.addEventListener('click', refreshHeight);
el.btnPrice.addEventListener('click', refreshPrice);

el.autoHeight.addEventListener('change', () => {
  settings.autoHeight = el.autoHeight.checked; save(LS_SETTINGS, settings); setupPolling();
});

el.autoPrice.addEventListener('change', () => {
  settings.autoPrice = el.autoPrice.checked; save(LS_SETTINGS, settings); setupPolling();
});

el.pollInterval.addEventListener('change', () => {
  const v = clamp(Number(el.pollInterval.value) || 30, 5, 3600);
  settings.pollIntervalSec = v; el.pollInterval.value = String(v); save(LS_SETTINGS, settings); setupPolling();
});

setupPolling();

// QR scanning
let barcodeDetector = null;
if ('BarcodeDetector' in window) {
  try { barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch {}
}

async function ensureZXing() {
  if (zxingReader) return zxingReader;
  const mod = await import('https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.4/+esm');
  zxingReader = new mod.BrowserQRCodeReader();
  return zxingReader;
}

function showQRResult(text) {
  state.qrText = text || '';
  el.qrOutput.textContent = state.qrText || 'No result yet.';
  el.btnCopyQR.disabled = !state.qrText;
}

async function startScan() {
  if (scanning) return; scanning = true; showQRResult('');
  el.qrLive.hidden = false; el.btnStartScan.disabled = true; el.btnStopScan.disabled = false;

  const constraints = { video: { facingMode: 'environment' }, audio: false };
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    showQRResult('Camera denied/unavailable. Use image upload instead.');
    stopScan();
    return;
  }

  el.qrVideo.srcObject = stream;
  await el.qrVideo.play();

  // Prefer native BarcodeDetector
  if (barcodeDetector) {
    const loop = async () => {
      if (!scanning) return;
      try {
        const results = await barcodeDetector.detect(el.qrVideo);
        if (results && results.length) {
          showQRResult(results[0].rawValue || results[0].rawValue || '');
          stopScan();
          return;
        }
      } catch {}
      requestAnimationFrame(loop);
    };
    stopScanLoop = () => { scanning = false; };
    loop();
    return;
  }

  // Fallback: ZXing continuous decode
  try {
    const reader = await ensureZXing();
    reader.decodeFromVideoDevice(null, el.qrVideo, (result, err) => {
      if (result) {
        showQRResult(result.getText());
        stopScan();
      }
    });
    stopScanLoop = () => { scanning = false; reader.reset(); };
  } catch (e) {
    showQRResult('Scanning not supported in this browser. Try image upload.');
    stopScan();
  }
}

function stopScan() {
  if (!scanning) return; scanning = false;
  if (stopScanLoop) { try { stopScanLoop(); } catch {} finally { stopScanLoop = null; } }
  const stream = el.qrVideo.srcObject;
  if (stream) {
    for (const t of stream.getTracks()) t.stop();
    el.qrVideo.srcObject = null;
  }
  el.qrLive.hidden = true; el.btnStartScan.disabled = false; el.btnStopScan.disabled = true;
}

async function decodeFile(file) {
  if (!file) return;
  showQRResult('Decoding…');
  const url = URL.createObjectURL(file);
  try {
    // Try native first
    if (barcodeDetector) {
      const imgBitmap = await createImageBitmap(file);
      const results = await barcodeDetector.detect(imgBitmap);
      if (results && results.length) { showQRResult(results[0].rawValue || ''); return; }
    }
    // ZXing fallback
    const reader = await ensureZXing();
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    // Needs element; not required to be visible
    const result = await reader.decodeFromImageElement(img);
    showQRResult(result.getText());
  } catch (e) {
    showQRResult('No QR found in image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

el.btnStartScan.addEventListener('click', startScan);
el.btnStopScan.addEventListener('click', stopScan);
el.qrFile.addEventListener('change', (e) => decodeFile(e.target.files?.[0]));
el.btnCopyQR.addEventListener('click', async () => {
  if (!state.qrText) return;
  try { await navigator.clipboard.writeText(state.qrText); el.btnCopyQR.textContent = 'Copied'; setTimeout(()=> el.btnCopyQR.textContent='Copy', 1200); } catch {}
});

// Initial manual refresh to populate data if online
refreshHeight().catch(()=>{});
refreshPrice().catch(()=>{});
