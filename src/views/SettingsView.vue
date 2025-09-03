<template>
  <main class="container">
    <section class="card">
      <h2>Settings</h2>
      <p class="small muted">These settings persist in your browser (LocalStorage) and are used by the Home page.</p>
      <div class="row gap" style="margin-top:8px">
        <label><input id="auto-height-settings" type="checkbox" v-model="settings.autoHeight" /> Auto-refresh block height</label>
        <label><input id="auto-price-settings" type="checkbox" v-model="settings.autoPrice" /> Auto-refresh price</label>
      </div>
      <div class="row gap" style="margin-top:8px">
        <label>
          <span>Poll interval (sec)</span>
          <input id="poll-interval-settings" type="number" min="5" :value="settings.pollIntervalSec" @input="onIntervalInput" />
        </label>
      </div>
      <p class="hint small" style="margin-top:8px">Auto-refresh runs when the Home page is open. External API calls are network-only.</p>
    </section>
  </main>
</template>

<script setup>
import { reactive, watchEffect } from 'vue';

const LS_SETTINGS = 'btcPwa.settings';
function load(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } }
function save(key, obj) { try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
}
function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

const settings = reactive(load(LS_SETTINGS, {
  autoHeight: false,
  autoPrice: false,
  pollIntervalSec: 30,
}));

function persist() { save(LS_SETTINGS, settings); }

function onIntervalInput(e) {
  const v = clamp(Number(e.target.value) || 30, 5, 3600);
  settings.pollIntervalSec = v;
  e.target.value = String(v);
  persist();
}

// Persist toggles immediately
watchEffect(persist);
</script>
