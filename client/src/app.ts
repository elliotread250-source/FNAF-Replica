import { clear } from './ui/dom';

export type Screen = (root: HTMLElement, params: Record<string, unknown>) => void | (() => void);
type FrameFn = (dt: number, t: number) => void;

const screens = new Map<string, Screen>();
let cleanup: (() => void) | void;
let frame: FrameFn | null = null;
let current = '';

export function register(name: string, s: Screen): void {
  screens.set(name, s);
}

export function ui(): HTMLElement {
  return document.getElementById('ui') as HTMLElement;
}

export function go(name: string, params: Record<string, unknown> = {}): void {
  const s = screens.get(name);
  if (!s) throw new Error(`no screen ${name}`);
  try {
    if (typeof cleanup === 'function') cleanup();
  } catch (err) {
    console.error(err);
  }
  current = name;
  const root = clear(ui());
  document.body.dataset.screen = name;
  cleanup = s(root, params);
}

export function currentScreen(): string {
  return current;
}

export function setFrame(fn: FrameFn | null): void {
  frame = fn;
}

export function getFrame(): FrameFn | null {
  return frame;
}

let last = performance.now();
const start = last;
let fpsCapAccum = 0;
export function startLoop(getCap: () => number): void {
  const tick = (now: number) => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000);
    const cap = getCap();
    if (cap) {
      fpsCapAccum += dt;
      if (fpsCapAccum < 1 / cap - 0.002) return;
      fpsCapAccum = 0;
    }
    last = now;
    frame?.(dt, (now - start) / 1000);
  };
  requestAnimationFrame(tick);
}
