import { h, button, mount, toast } from '../dom';
import { go, register, setFrame } from '../../app';
import { store } from '../../store';
import { api } from '../../api';
import { audio } from '../../audio/engine';
import { getRenderer, benchmark } from '../../render/renderer';
import { TitleScene } from '../../render/scenes/small';
import { resetSocket } from '../../net/socket';

export const DISCLAIMER =
  "FNAF Replica is an unofficial, non-commercial fan game. Five Nights at Freddy's and all related characters are the property of Scott Cawthon. This project is not affiliated with or endorsed by Scott Cawthon or Steel Wool Studios. All art, audio and code in this game are original.";

let title: TitleScene | null = null;
let stopMusic: (() => void) | null = null;

export function disclaimer(): HTMLElement {
  return h('div', { class: 'disclaimer' }, DISCLAIMER, ' ', h('a', { href: '/legal', onclick: (e: Event) => (e.preventDefault(), go('legal')) }, 'Legal'));
}

/** The 3D title shot behind every menu. */
export function titleBackdrop(dim = 1): void {
  const r = getRenderer();
  if (!title) title = new TitleScene();
  const samples: number[] = [];
  let benchDone = (() => {
    try {
      return Boolean(localStorage.getItem('fr_quality')) || store.settings.quality !== 'auto';
    } catch {
      return true;
    }
  })();
  let tAcc = 0;
  setFrame((dt) => {
    if (!title) return;
    title.update(dt);
    title.camera.aspect = window.innerWidth / window.innerHeight;
    title.camera.updateProjectionMatrix();
    const flick = !store.settings.photosensitive && Math.random() < 0.01 ? 0.6 : 0;
    r.post.uniforms.darkness.value = 1 - dim + flick;
    r.post.uniforms.flash.value = 0;
    r.post.uniforms.redTint.value = 0;
    r.post.uniforms.wobble.value = 0;
    r.post.uniforms.aberration.value = 0.002;
    r.render(title.scene, title.camera);
    if (!benchDone) {
      tAcc += dt;
      samples.push(dt * 1000);
      if (tAcc > 3) {
        benchDone = true;
        r.setQuality(benchmark(samples));
      }
    }
  });
}

export function ambientMenu(): void {
  if (!audio.ready) return;
  audio.startLoop('drone', 'drone');
  if (!stopMusic) stopMusic = audio.melody('title', { bpm: 70, gain: 0.08, loop: true, wobble: 0.3, bus: 'ambience' });
}

export function stopMenuAudio(): void {
  stopMusic?.();
  stopMusic = null;
  audio.stopLoop('drone', 0.5);
}

function stars(n: number): string {
  return n > 0 ? '★'.repeat(Math.min(4, n)) : '';
}

register('warning', (root) => {
  const go2 = async (where: 'title' | 'settings') => {
    try {
      localStorage.setItem('fr_warned', '1');
    } catch {
      /* storage blocked */
    }
    await audio.init().catch(() => {});
    go(where === 'title' ? 'title' : 'settings', { back: 'title', tab: 'access' });
  };
  mount(
    root,
    h(
      'div',
      { class: 'screen center warn-screen' },
      h('h1', { class: 'title', style: 'font-size:48px' }, 'WARNING'),
      h('p', null, 'This game contains flashing lights, loud noises and jump scares. Photosensitivity mode and reduced jump scares are available in Settings.'),
      h('div', { class: 'row', style: 'justify-content:center;margin-top:20px' }, button('Continue', () => void go2('title'), 'btn primary'), button('Open accessibility settings', () => void go2('settings'), 'btn')),
    ),
  );
});

register('title', (root) => {
  titleBackdrop(0.85);
  const me = store.me;
  const typed: string[] = [];
  const konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  const onKey = (e: KeyboardEvent) => {
    typed.push(e.code);
    if (typed.length > 12) typed.shift();
    const last4 = typed.slice(-4).join(',');
    if (last4 === 'Digit1,Digit9,Digit8,Digit7') {
      audio.melody('freddy', { bpm: 220, gain: 0.25, wobble: 1 });
      const flash = h('div', { class: 'overlay-full', style: 'background:#2a2000' }, h('h1', { class: 'title', style: 'color:#ffd21a' }, ":')"));
      if (!store.settings.photosensitive) {
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 16);
      }
    }
    if (typed.slice(-10).join(',') === konami.join(',') && title) {
      title.bobble = !title.bobble;
      toast('Bobblehead mode.', 'info');
    }
  };
  window.addEventListener('keydown', onKey);
  const unlock = async () => {
    await audio.init().catch(() => {});
    ambientMenu();
  };
  root.addEventListener('pointerdown', () => void unlock(), { once: true });
  if (audio.ready) ambientMenu();

  const logout = async () => {
    await api.logout().catch(() => {});
    store.me = null;
    store.lobby = null;
    resetSocket();
    go('title');
  };
  const items: HTMLElement[] = me
    ? [
        button('Clock In', () => go('play')),
        button('Explore the Pizzeria (Day Shift)', () => go('freeroam', { mode: 'day' })),
        button('Night Shift (Free Roam, solo preview)', () => go('freeroam', { mode: 'night' })),
        button('Locker Room', () => go('locker')),
        button('Personnel File', () => go('profile')),
        button('Notice Board', () => go('settings', { back: 'title' })),
        button('Archives', () => go('archives')),
        button('Leave', () => void logout()),
      ]
    : [button('Clock In', () => go('login')), button('Play as Guest', () => go('login', { guest: true })), button('Explore the Pizzeria (Day Shift)', () => go('freeroam', { mode: 'day' })), button('Night Shift (Free Roam, solo preview)', () => go('freeroam', { mode: 'night' })), button('Notice Board', () => go('settings', { back: 'title' }))];
  mount(
    root,
    h(
      'div',
      { class: 'screen', style: 'justify-content:flex-end;padding-bottom:12vh' },
      h('h1', { class: 'title' }, 'FNAF', h('br'), 'REPLICA'),
      h('div', { class: 'stars' }, stars(me?.user.stars ?? 0)),
      me ? h('div', { class: 'dim' }, `${me.user.displayName}${me.user.isGuest ? ' (guest)' : ''} · ${me.user.fazTokens} ${store.roster.currency()}`) : null,
      h('div', { class: 'menu' }, items),
    ),
    disclaimer(),
  );
  return () => window.removeEventListener('keydown', onKey);
});

register('legal', (root) => {
  titleBackdrop(0.3);
  mount(
    root,
    h(
      'div',
      { class: 'screen center' },
      h(
        'div',
        { class: 'panel legal' },
        h('h2', null, 'Legal'),
        h('p', null, DISCLAIMER),
        h('p', null, 'No monetisation: no payments, no ads, no paid items. Every cosmetic is earned by playing.'),
        h('p', null, 'Contact: TODO_CONTACT_EMAIL'),
        button('Back', () => (history.replaceState(null, '', '/'), go(store.me ? 'title' : 'title')), 'btn'),
      ),
    ),
  );
});
