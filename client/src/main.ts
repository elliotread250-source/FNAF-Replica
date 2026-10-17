import './ui/styles.css';
import './ui/screens/title';
import './ui/screens/auth';
import './ui/screens/play';
import './ui/screens/lobby';
import './ui/screens/locker';
import './ui/screens/profile';
import './ui/screens/settings';
import './ui/screens/archives';
import './ui/screens/paycheck';
import './ui/screens/game';
import { go, startLoop, currentScreen } from './app';
import { store } from './store';
import { getSocket } from './net/socket';
import { deliverNightEnd } from './ui/screens/game';
import { startVoice } from './net/voice';
import { getRenderer } from './render/renderer';
import { h } from './ui/dom';
import type { NightEnd, NightStart } from './game/types';

function noiseOverlay(): void {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d') as CanvasRenderingContext2D;
  const img = x.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const el = h('div', { id: 'noise' });
  el.style.backgroundImage = `url(${c.toDataURL()})`;
  document.body.appendChild(el);
  let shift = 0;
  setInterval(() => {
    if (store.settings.photosensitive) return;
    shift = (shift + 37) % 256;
    el.style.backgroundPosition = `${shift}px ${(shift * 7) % 256}px`;
  }, 80);
}

async function boot(): Promise<void> {
  const app = document.getElementById('app') as HTMLElement;
  app.replaceWith(h('div', { id: 'stage' }), h('div', { id: 'ui' }));
  noiseOverlay();
  const loading = h('div', { class: 'overlay-full loading', style: 'background:#000' }, 'Cleaning the stage...');
  document.body.appendChild(loading);
  const lines = ['Cleaning the stage...', 'Restocking cupcakes...', 'Charging the doors...', 'Winding the music box...', 'Counting the animatronics. Twice.'];
  let li = 0;
  const lt = setInterval(() => (loading.textContent = lines[++li % lines.length]), 500);
  await store.loadConfig();
  await store.refreshMe();
  // ?perf=low: low preset, half render scale, 30 fps. For slow machines and headless test browsers.
  if (new URLSearchParams(location.search).get('perf') === 'low') {
    store.settings = { ...store.settings, quality: 'low', renderScale: 0.5, fpsCap: 30 };
  }
  document.title = 'FNAF Replica';
  try {
    getRenderer();
  } catch {
    loading.textContent = 'This browser cannot run WebGL. Try a recent Chrome, Edge or Firefox.';
    clearInterval(lt);
    return;
  }
  startLoop(() => store.settings.fpsCap);
  clearInterval(lt);
  loading.remove();

  if (store.me) {
    const s = getSocket();
    s.on('night:start', (start: NightStart) => go('game', { start }));
    s.on('night:end', (e: NightEnd) => deliverNightEnd(e));
    startVoice();
  }
  store.on(() => {
    if (store.me) {
      const s = getSocket();
      if (!s.hasListeners('night:start')) {
        s.on('night:start', (start: NightStart) => go('game', { start }));
        s.on('night:end', (e: NightEnd) => deliverNightEnd(e));
        startVoice();
      }
    }
    if (store.lobby && currentScreen() === 'play') go('lobby');
  });

  const gallery = new URLSearchParams(location.search).get('gallery');
  if (gallery && ['localhost', '127.0.0.1'].includes(location.hostname)) {
    const { runGallery } = await import('./debug');
    runGallery(gallery);
    return;
  }
  let warned = false;
  try {
    warned = Boolean(localStorage.getItem('fr_warned'));
  } catch {
    /* storage blocked */
  }
  if (location.pathname === '/legal') go('legal');
  else if (new URLSearchParams(location.search).get('reset')) go('login', { mode: 'reset' });
  else go(warned ? 'title' : 'warning');
}

void boot();
