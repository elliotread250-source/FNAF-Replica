import { h } from '../ui/dom';
import { audio } from '../audio/engine';
import { api } from '../api';
import { store } from '../store';

// Three original 8-bit death minigames on a 160x120 canvas, 16-colour palette, nearest-neighbour scaled.
const PAL = ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'];
type Game = 'partyTime' | 'followMe' | 'lightsOn';

interface Ctx {
  c: CanvasRenderingContext2D;
  keys: Set<string>;
  t: number;
}

function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, col: number): void {
  c.fillStyle = PAL[col];
  c.fillRect(Math.round(x), Math.round(y), w, hh);
}

function sprite(c: CanvasRenderingContext2D, x: number, y: number, body: number, head: number, ears = false): void {
  rect(c, x - 3, y - 4, 6, 7, body);
  rect(c, x - 2, y - 8, 5, 4, head);
  if (ears) {
    rect(c, x - 2, y - 11, 1, 3, head);
    rect(c, x + 2, y - 11, 1, 3, head);
  }
  rect(c, x - 1, y - 7, 1, 1, 7);
  rect(c, x + 1, y - 7, 1, 1, 7);
}

function move(k: Ctx, p: { x: number; y: number }, sp = 1): void {
  if (k.keys.has('ArrowLeft') || k.keys.has('KeyA')) p.x -= sp;
  if (k.keys.has('ArrowRight') || k.keys.has('KeyD')) p.x += sp;
  if (k.keys.has('ArrowUp') || k.keys.has('KeyW')) p.y -= sp;
  if (k.keys.has('ArrowDown') || k.keys.has('KeyS')) p.y += sp;
  p.x = Math.max(4, Math.min(156, p.x));
  p.y = Math.max(12, Math.min(116, p.y));
}

/** "Party Time": deliver cake to six kids. Outside, a grey child cries. You can never reach them. */
function partyTime(): (k: Ctx) => 'run' | 'done' {
  const p = { x: 30, y: 60 };
  const kids = Array.from({ length: 6 }, (_, i) => ({ x: 20 + (i % 3) * 30, y: 30 + Math.floor(i / 3) * 50, fed: false }));
  let car = -40;
  let endAt = 0;
  return (k) => {
    move(k, p);
    rect(k.c, 0, 0, 160, 120, 1);
    rect(k.c, 110, 0, 50, 120, 5);
    rect(k.c, 112, 40, 46, 30, 0);
    for (const kid of kids) {
      rect(k.c, kid.x - 6, kid.y + 4, 14, 4, 4);
      sprite(k.c, kid.x, kid.y, kid.fed ? 11 : 8, kid.fed ? 11 : 8);
      if (!kid.fed && Math.hypot(kid.x - p.x, kid.y - p.y) < 8) {
        kid.fed = true;
        audio.play('blip', { rate: 1.5 });
      }
    }
    sprite(k.c, 134, 60, 5, 6);
    if (k.t % 40 < 20) rect(k.c, 136, 54, 1, 3, 12);
    sprite(k.c, p.x, p.y, 4, 4, false);
    rect(k.c, p.x + 3, p.y - 3, 3, 2, 14);
    if (p.x > 104) p.x = 104;
    if (kids.every((x) => x.fed)) {
      car = Math.min(140, car + 1);
      rect(k.c, car, 100, 18, 8, 2);
      if (car >= 140 && !endAt) endAt = k.t + 40;
    }
    if (endAt && k.t > endAt - 15) {
      rect(k.c, 0, 0, 160, 120, 0);
      rect(k.c, 60, 30, 40, 50, 7);
      rect(k.c, 68, 45, 8, 8, 0);
      rect(k.c, 84, 45, 8, 8, 0);
      rect(k.c, 70, 66, 20, 3, 8);
      rect(k.c, 66, 55, 4, 4, 8);
      rect(k.c, 90, 55, 4, 4, 8);
    }
    return endAt && k.t > endAt ? 'done' : k.t > 30 * 30 ? 'done' : 'run';
  };
}

/** "Follow Me": a purple figure beckons through rooms. At the end, five dismantled friends. */
function followMe(): (k: Ctx) => 'run' | 'done' {
  const p = { x: 20, y: 60 };
  let room = 0;
  let flashAt = 0;
  return (k) => {
    move(k, p);
    rect(k.c, 0, 0, 160, 120, room === 3 ? 0 : 1);
    rect(k.c, 0, 0, 160, 10, 5);
    rect(k.c, 0, 110, 160, 10, 5);
    const fx = 140;
    if (room < 3) {
      sprite(k.c, fx, 60, 13, 13);
      if (k.t % 30 < 15) rect(k.c, fx - 6, 56, 3, 1, 13);
    }
    sprite(k.c, p.x, p.y, 13, 13, true);
    if (p.x > 150 && room < 3) {
      room++;
      p.x = 10;
      audio.play('blip');
    }
    if (room === 3) {
      for (let i = 0; i < 5; i++) {
        rect(k.c, 30 + i * 22, 90, 12, 5, [4, 13, 10, 8, 9][i]);
        rect(k.c, 32 + i * 22, 86, 5, 4, [4, 13, 10, 8, 9][i]);
      }
      sprite(k.c, 80, 50, 13, 13);
      if (!flashAt) flashAt = k.t + 60;
      if (k.t > flashAt && !store.settings.photosensitive && k.t % 4 < 2) rect(k.c, 0, 0, 160, 120, 7);
      if (k.t > flashAt + 30) return 'done';
    }
    return k.t > 30 * 30 ? 'done' : 'run';
  };
}

/** "Lights On": find five glowing party hats with a flashlight cone. A golden bear waits behind you. */
function lightsOn(): (k: Ctx) => 'run' | 'done' {
  const p = { x: 80, y: 60 };
  const hats = [
    [20, 20],
    [140, 25],
    [30, 100],
    [130, 100],
    [80, 15],
  ].map(([x, y]) => ({ x, y, got: false }));
  let doneAt = 0;
  return (k) => {
    move(k, p, 1.2);
    rect(k.c, 0, 0, 160, 120, 0);
    const img = k.c.getImageData(0, 0, 160, 120);
    void img;
    k.c.save();
    k.c.beginPath();
    k.c.arc(p.x, p.y, 22, 0, Math.PI * 2);
    k.c.clip();
    rect(k.c, 0, 0, 160, 120, 1);
    for (const hat of hats) {
      if (hat.got) continue;
      rect(k.c, hat.x - 2, hat.y - 4, 5, 5, 10);
      rect(k.c, hat.x, hat.y - 6, 1, 2, 8);
    }
    k.c.restore();
    for (const hat of hats) {
      if (!hat.got && Math.hypot(hat.x - p.x, hat.y - p.y) < 6) {
        hat.got = true;
        audio.play('blip', { rate: 0.8 + hats.filter((x) => x.got).length * 0.15 });
      }
    }
    sprite(k.c, p.x, p.y, 12, 15);
    if (hats.every((x) => x.got)) {
      if (!doneAt) doneAt = k.t + 50;
      sprite(k.c, p.x - 12, p.y, 10, 10, false);
      rect(k.c, p.x - 14, p.y - 7, 1, 1, 0);
      rect(k.c, p.x - 11, p.y - 7, 1, 1, 0);
      if (k.t > doneAt) return 'done';
    }
    return k.t > 30 * 30 ? 'done' : 'run';
  };
}

const GAMES: Record<Game, () => (k: Ctx) => 'run' | 'done'> = { partyTime, followMe, lightsOn };

export function runMinigame(root: HTMLElement, which: Game, onDone: () => void, fullCredit = true): void {
  const canvas = h('canvas', { width: '160', height: '120', style: 'width:min(90vw,800px);image-rendering:pixelated;border:2px solid #333' });
  const el = h('div', { class: 'overlay-full', style: 'background:#000' }, canvas, h('div', { class: 'dim', style: 'font-family:VT323;font-size:20px;margin-top:8px' }, 'Arrow keys to move'));
  root.appendChild(el);
  const c = canvas.getContext('2d') as CanvasRenderingContext2D;
  const keys = new Set<string>();
  const kd = (e: KeyboardEvent) => {
    keys.add(e.code);
    e.preventDefault();
  };
  const ku = (e: KeyboardEvent) => keys.delete(e.code);
  window.addEventListener('keydown', kd, true);
  window.addEventListener('keyup', ku, true);
  const step = GAMES[which]();
  const stopMusic = audio.melody(which === 'followMe' ? 'chipB' : 'chipA', { bpm: 160, gain: 0.08, loop: true, voice: 'chip' });
  let t = 0;
  let result: 'run' | 'done' = 'run';
  const iv = setInterval(() => {
    t++;
    result = step({ c, keys, t });
    if (result === 'done') {
      clearInterval(iv);
      stopMusic();
      window.removeEventListener('keydown', kd, true);
      window.removeEventListener('keyup', ku, true);
      el.remove();
      if (store.me) {
        void api.archive('minigame', which).catch(() => {});
        if (fullCredit) void api.archive('minigame', `${which}:done`).catch(() => {});
      }
      onDone();
    }
  }, 1000 / 30);
}

export function runDeathMinigame(root: HTMLElement, onDone: () => void): void {
  const games: Game[] = ['partyTime', 'followMe', 'lightsOn'];
  runMinigame(root, games[Math.floor(Math.random() * games.length)], onDone);
}

export const MINIGAMES: { id: Game; name: string }[] = [
  { id: 'partyTime', name: 'Party Time' },
  { id: 'followMe', name: 'Follow Me' },
  { id: 'lightsOn', name: 'Lights On' },
];
