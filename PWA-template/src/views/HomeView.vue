<template>
  <main class="container">
    <section class="card">
      <h2>Status</h2>
      <ul class="kv">
        <li><span>Network</span><span>{{ online ? 'online' : 'offline' }}</span></li>
        <li><span>Camera</span><span>{{ cameraAvailable ? 'available' : 'unavailable' }}</span></li>
      </ul>
    </section>

    <section class="grid-2">
      <div class="card">
        <div class="row space-between middle">
          <h3>Block height</h3>
          <button class="btn" :disabled="loadingHeight" @click="refreshHeight">{{ loadingHeight ? 'Loading…' : 'Refresh' }}</button>
        </div>
        <div class="metric">
          <span class="value">{{ state.height ?? '—' }}</span>
        </div>
        <ul class="kv small muted">
          <li><span>Updated</span><span>{{ fmt(state.heightUpdated) }}</span></li>
          <li><span>Source</span><span>{{ state.heightSource || '—' }}</span></li>
        </ul>
      </div>

      <div class="card">
        <div class="row space-between middle">
          <h3>Price (USD)</h3>
          <button class="btn" :disabled="loadingPrice" @click="refreshPrice">{{ loadingPrice ? 'Loading…' : 'Refresh' }}</button>
        </div>
        <div class="metric">
          <span class="prefix">$</span>
          <span class="value">{{ state.priceUsd != null ? state.priceUsd.toFixed(2) : '—' }}</span>
        </div>
        <ul class="kv small muted">
          <li><span>Updated</span><span>{{ fmt(state.priceUpdated) }}</span></li>
          <li><span>Source</span><span>{{ state.priceSource || '—' }}</span></li>
        </ul>
      </div>
    </section>

    <section class="card">
      <h3>USD ↔ sats converter</h3>
      <div class="grid-2">
        <label>
          <span>USD</span>
          <input ref="usdEl" type="number" step="0.01" min="0" v-model="usdInput" @input="onUsdInput" placeholder="0.00" />
        </label>
        <label>
          <span>Satoshis</span>
          <input ref="satsEl" type="number" step="1" min="0" v-model="satsInput" @input="onSatsInput" placeholder="0" />
        </label>
      </div>
      <p class="hint small" v-if="state.priceUsd == null">Fetch price to enable converter.</p>
    </section>

    <section class="card">
      <div class="row space-between middle">
        <h3>QR scanner</h3>
        <div class="row gap">
          <button class="btn" :disabled="scanning" @click="startScan">Start</button>
          <button class="btn btn-ghost" :disabled="!scanning" @click="stopScan">Stop</button>
        </div>
      </div>
      <div class="qr-live" v-show="scanning">
        <video id="qr-video" ref="videoRef" autoplay playsinline></video>
      </div>
      <div class="row gap">
        <input id="qr-file" type="file" accept="image/*" @change="onFile" />
        <button id="btn-copy-qr" class="btn" :disabled="!state.qrText" @click="copyQr">Copy</button>
      </div>
      <div id="qr-output" class="output small" :class="{ muted: !state.qrText }">{{ state.qrText || 'No result yet.' }}</div>
    </section>

    <section class="card">
      <h3>Settings</h3>
      <div class="row gap">
        <label><input id="auto-height" type="checkbox" v-model="settings.autoHeight" /> Auto-refresh height</label>
        <label><input id="auto-price" type="checkbox" v-model="settings.autoPrice" /> Auto-refresh price</label>
        <label>
          <span>Poll interval (sec)</span>
          <input id="poll-interval" type="number" min="5" :value="settings.pollIntervalSec" @input="onIntervalInput" />
        </label>
      </div>
      <p class="hint small">Network-only for external APIs. The service worker caches only the app shell.</p>
    </section>
  </main>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, watch, toRefs } from 'vue';

// Props from App for network status
const props = defineProps({ online: { type: Boolean, default: typeof navigator !== 'undefined' ? navigator.onLine : true } });
const { online } = toRefs(props);

// Local storage helpers
const LS_STATE = 'btcPwa.state';
const LS_SETTINGS = 'btcPwa.settings';
function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } }
function save(key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
}
function ts() { return new Date().toISOString(); }
function fmt(dtIso) { if (!dtIso) return 'never'; const d = new Date(dtIso); return d.toLocaleString(); }
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

// Reactive state
const state = reactive(load(LS_STATE, {
  height: null,
  heightUpdated: null,
  heightSource: '',
  priceUsd: null,
  priceUpdated: null,
  priceSource: '',
  qrText: '',
}));

const settings = reactive(load(LS_SETTINGS, {
  autoHeight: false,
  autoPrice: false,
  pollIntervalSec: 30,
}));

// Persist settings/state when changed
function persistState() { save(LS_STATE, state); }
function persistSettings() { save(LS_SETTINGS, settings); setupPolling(); }

// Fetch utils
async function fetchText(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(String(r.status)); return r.text(); }
async function fetchJson(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(String(r.status)); return r.json(); }

async function getBlockHeight() {
  const tries = [
    async () => ({ value: parseInt(await fetchText('https://mempool.space/api/blocks/tip/height'), 10), source: 'mempool.space' }),
    async () => ({ value: parseInt(await fetchText('https://blockstream.info/api/blocks/tip/height'), 10), source: 'blockstream.info' }),
    async () => { const j = await fetchJson('https://api.blockcypher.com/v1/btc/main'); return { value: j.height|0, source: 'blockcypher' }; },
  ];
  let lastErr;
  for (const t of tries) { try { const r = await t(); if (Number.isFinite(r.value)) return r; } catch (e) { lastErr = e; } }
  throw lastErr || new Error('All sources failed');
}

async function getPriceUsd() {
  const tries = [
    async () => { const j = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'); return { value: Number(j.bitcoin.usd), source: 'coingecko' }; },
    async () => { const j = await fetchJson('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'); return { value: Number(j.price), source: 'binance' }; },
  ];
  let lastErr;
  for (const t of tries) { try { const r = await t(); if (Number.isFinite(r.value)) return r; } catch (e) { lastErr = e; } }
  throw lastErr || new Error('All sources failed');
}

// Height/price actions
const loadingHeight = ref(false);
const loadingPrice = ref(false);

async function refreshHeight() {
  loadingHeight.value = true;
  try {
    const r = await getBlockHeight();
    state.height = r.value;
    state.heightUpdated = ts();
    state.heightSource = r.source;
    persistState();
  } catch (e) {
    state.heightSource = 'failed';
  } finally {
    loadingHeight.value = false;
  }
}

async function refreshPrice() {
  loadingPrice.value = true;
  try {
    const r = await getPriceUsd();
    state.priceUsd = r.value;
    state.priceUpdated = ts();
    state.priceSource = r.source;
    persistState();
    // re-run converter if one side has input
    if (document.activeElement !== usdEl.value && usdInput.value) onUsdInput();
    if (document.activeElement !== satsEl.value && satsInput.value) onSatsInput();
  } catch (e) {
    state.priceSource = 'failed';
  } finally {
    loadingPrice.value = false;
  }
}

// Converter
const usdInput = ref('');
const satsInput = ref('');
const usdEl = ref(null);
const satsEl = ref(null);
let updatingConverter = false;
function satsPerBtc() { return 100_000_000; }
function onUsdInput() {
  if (updatingConverter) return; updatingConverter = true;
  const usd = Number(usdInput.value);
  if (!Number.isFinite(usd) || usd < 0 || !state.priceUsd) { satsInput.value = ''; updatingConverter = false; return; }
  const sats = Math.floor((usd / state.priceUsd) * satsPerBtc());
  satsInput.value = String(sats);
  updatingConverter = false;
}
function onSatsInput() {
  if (updatingConverter) return; updatingConverter = true;
  const sats = Number(satsInput.value);
  if (!Number.isFinite(sats) || sats < 0 || !state.priceUsd) { usdInput.value = ''; updatingConverter = false; return; }
  const usd = (sats / satsPerBtc()) * state.priceUsd;
  usdInput.value = usd.toFixed(2);
  updatingConverter = false;
}

// Polling
let pollTimer = null;
function setupPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  if (!settings.autoHeight && !settings.autoPrice) return;
  const iv = clamp(Number(settings.pollIntervalSec) || 30, 5, 3600);
  const tick = async () => {
    if (settings.autoHeight) refreshHeight();
    if (settings.autoPrice) refreshPrice();
  };
  tick();
  pollTimer = setInterval(tick, iv * 1000);
}
function onIntervalInput(e) {
  const v = clamp(Number(e.target.value) || 30, 5, 3600);
  settings.pollIntervalSec = v;
  e.target.value = String(v);
  persistSettings();
}

// QR scanning
const videoRef = ref(null);
let barcodeDetector = null;
let scanning = ref(false);
let stopScanLoop = null;
let zxingReader = null;

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
}

async function startScan() {
  if (scanning.value) return; scanning.value = true; showQRResult('');
  const constraints = { video: { facingMode: 'environment' }, audio: false };
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    showQRResult('Camera denied/unavailable. Use image upload instead.');
    stopScan();
    return;
  }

  const video = videoRef.value;
  video.srcObject = stream;
  await video.play();

  if (barcodeDetector) {
    const loop = async () => {
      if (!scanning.value) return;
      try {
        const results = await barcodeDetector.detect(video);
        if (results && results.length) {
          showQRResult(results[0].rawValue || '');
          stopScan();
          return;
        }
      } catch {}
      requestAnimationFrame(loop);
    };
    stopScanLoop = () => { scanning.value = false; };
    loop();
    return;
  }

  try {
    const reader = await ensureZXing();
    reader.decodeFromVideoDevice(null, video, (result, err) => {
      if (result) {
        showQRResult(result.getText());
        stopScan();
      }
    });
    stopScanLoop = () => { scanning.value = false; reader.reset(); };
  } catch (e) {
    showQRResult('Scanning not supported in this browser. Try image upload.');
    stopScan();
  }
}

function stopScan() {
  if (!scanning.value) return; scanning.value = false;
  if (stopScanLoop) { try { stopScanLoop(); } catch {} finally { stopScanLoop = null; } }
  const video = videoRef.value;
  const stream = video?.srcObject;
  if (stream) { for (const t of stream.getTracks()) t.stop(); video.srcObject = null; }
}

async function onFile(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  showQRResult('Decoding…');
  const url = URL.createObjectURL(file);
  try {
    if (barcodeDetector) {
      const imgBitmap = await createImageBitmap(file);
      const results = await barcodeDetector.detect(imgBitmap);
      if (results && results.length) { showQRResult(results[0].rawValue || ''); return; }
    }
    const reader = await ensureZXing();
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
    const result = await reader.decodeFromImageElement(img);
    showQRResult(result.getText());
  } catch (e) {
    showQRResult('No QR found in image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function copyQr() {
  if (!state.qrText) return;
  try { await navigator.clipboard.writeText(state.qrText); } catch {}
}

// Camera availability
const cameraAvailable = ref(false);
onMounted(async () => {
  persistSettings(); // ensure polling
  try {
    cameraAvailable.value = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.isSecureContext);
  } catch { cameraAvailable.value = false; }
});

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
  stopScan();
});

// Initial populate if online
onMounted(() => {
  if (props.online) {
    refreshHeight().catch(() => {});
    refreshPrice().catch(() => {});
  }
});

// Persist on changes
watch(() => settings.autoHeight, persistSettings);
watch(() => settings.autoPrice, persistSettings);
watch(() => settings.pollIntervalSec, persistSettings);
watch(state, persistState, { deep: true });
</script>
