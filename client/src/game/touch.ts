import { h } from '../ui/dom';
import { store } from '../store';

// Touch controls for phones and tablets. One overlay, built from Pointer Events (so the same code works for a
// finger, a pen, or a mouse in a test): a floating joystick under the left thumb, drag-to-look under the right,
// and big buttons that call back into the game the same way the keyboard does.

/** Should touch controls be shown? `?touch=1` / `?touch=0` force it; the setting wins over detection. */
export function touchEnabled(): boolean {
  const q = new URLSearchParams(location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  const mode = store.settings.touchControls ?? 'auto';
  if (mode === 'on') return true;
  if (mode === 'off') return false;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const fine = typeof matchMedia === 'function' && matchMedia('(any-pointer: fine)').matches;
  return coarse || (navigator.maxTouchPoints > 0 && !fine);
}

export interface TouchButton {
  id: string;
  label: string;
  /** Where it sits: a named cluster on screen. */
  cluster: 'right' | 'top' | 'office' | 'cams' | 'hidden';
  /** Held buttons send down on press and up on release; others fire once on tap. */
  hold?: boolean;
  down: () => void;
  up?: () => void;
}

export interface TouchCallbacks {
  /** Joystick: forward and strafe in -1..1 (y up = forward), and how far it's pushed 0..1. */
  move(fwd: number, strafe: number, push: number): void;
  /** Drag-to-look deltas in pixels. */
  look(dx: number, dy: number): void;
}

/** A floating joystick + look pad + button clusters, laid over the game. */
export class TouchControls {
  readonly root: HTMLElement;
  private stick: HTMLElement;
  private knob: HTMLElement;
  private clusters = new Map<string, HTMLElement>();
  private buttons = new Map<string, HTMLElement>();
  private moveId: number | null = null;
  private lookId: number | null = null;
  private origin = { x: 0, y: 0 };
  private last = { x: 0, y: 0 };
  private readonly radius = 56;

  constructor(
    parent: HTMLElement,
    private cb: TouchCallbacks,
    /** Without the pad, touches fall through to the canvas (the classic office picks doors and lights there). */
    opts: { pad?: boolean } = {},
  ) {
    this.knob = h('div', { class: 'tc-knob' });
    this.stick = h('div', { class: 'tc-stick' }, this.knob);
    const pad = h('div', { class: 'tc-pad' });
    this.root = h('div', { class: 'tc-root' }, this.stick);
    if (opts.pad !== false) this.root.prepend(pad);
    for (const c of ['right', 'top', 'office', 'cams', 'hidden']) {
      const el = h('div', { class: `tc-cluster tc-${c}` });
      this.clusters.set(c, el);
      this.root.appendChild(el);
    }
    parent.appendChild(this.root);
    document.body.classList.add('touch-ui');
    pad.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove, { passive: false });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
  }

  /** Replace the buttons. Ids that stay keep their element (so a held button isn't dropped mid-press). */
  setButtons(list: TouchButton[]): void {
    const keep = new Set(list.map((b) => b.id));
    for (const [id, el] of this.buttons)
      if (!keep.has(id)) {
        // A held button that vanishes still owes its release, or the key it stands for stays down.
        const tb = (el as HTMLElement & { _b?: TouchButton })._b;
        if (el.classList.contains('on') && tb?.hold) tb.up?.();
        el.remove();
        this.buttons.delete(id);
      }
    for (const b of list) {
      let el = this.buttons.get(b.id);
      if (!el) {
        el = h('button', { class: 'tc-btn', 'data-touch': b.id, type: 'button' }, b.label);
        const btn = el;
        btn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          btn.setPointerCapture?.(e.pointerId);
          btn.classList.add('on');
          (btn as HTMLElement & { _b?: TouchButton })._b?.down();
        });
        const release = (e: Event) => {
          e.preventDefault();
          if (!btn.classList.contains('on')) return;
          btn.classList.remove('on');
          const tb = (btn as HTMLElement & { _b?: TouchButton })._b;
          if (tb?.hold) tb.up?.();
        };
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointercancel', release);
        btn.addEventListener('contextmenu', (e) => e.preventDefault());
        this.buttons.set(b.id, btn);
      }
      (el as HTMLElement & { _b?: TouchButton })._b = b;
      if (el.textContent !== b.label) el.textContent = b.label;
      const cl = this.clusters.get(b.cluster) as HTMLElement;
      if (el.parentElement !== cl) cl.appendChild(el);
    }
  }

  /** Show or hide the joystick and look pad (hidden while seated, hiding or on cameras). */
  setMoveEnabled(on: boolean): void {
    this.root.classList.toggle('tc-nomove', !on);
    if (!on && this.moveId !== null) this.release();
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    const leftHalf = e.clientX < window.innerWidth * 0.45;
    if (leftHalf && this.moveId === null && !this.root.classList.contains('tc-nomove')) {
      this.moveId = e.pointerId;
      this.origin = { x: e.clientX, y: e.clientY };
      this.stick.style.left = `${e.clientX}px`;
      this.stick.style.top = `${e.clientY}px`;
      this.stick.classList.add('on');
      this.knob.style.transform = 'translate(-50%, -50%)';
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.last = { x: e.clientX, y: e.clientY };
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId === this.moveId) {
      e.preventDefault();
      let dx = e.clientX - this.origin.x;
      let dy = e.clientY - this.origin.y;
      const d = Math.hypot(dx, dy);
      if (d > this.radius) {
        dx = (dx / d) * this.radius;
        dy = (dy / d) * this.radius;
      }
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const push = Math.min(1, d / this.radius);
      // A small dead zone so a resting thumb doesn't creep.
      const k = push < 0.15 ? 0 : 1 / this.radius;
      this.cb.move(-dy * k, dx * k, push);
    } else if (e.pointerId === this.lookId) {
      e.preventDefault();
      this.cb.look(e.clientX - this.last.x, e.clientY - this.last.y);
      this.last = { x: e.clientX, y: e.clientY };
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.moveId) this.release();
    if (e.pointerId === this.lookId) this.lookId = null;
  };

  private release(): void {
    this.moveId = null;
    this.stick.classList.remove('on');
    this.cb.move(0, 0, 0);
  }

  dispose(): void {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.root.remove();
    document.body.classList.remove('touch-ui');
  }
}
