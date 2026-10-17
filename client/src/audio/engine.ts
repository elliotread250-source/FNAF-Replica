import { store } from '../store';
import { mtof, type Melody, TOREADOR, WEASEL, FREDDY_TUNE, FOXY_HUM, TITLE_BOX, CHIP_A, CHIP_B } from './music';

type Bus = 'ambience' | 'sfx' | 'jumpscare' | 'voice' | 'ui' | 'music';
type Recipe = (ctx: BaseAudioContext, out: AudioNode, t: number) => number; // returns duration

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

function noiseBuffer(ctx: BaseAudioContext, seconds: number, brown = false): AudioBuffer {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  return buf;
}

function noise(ctx: BaseAudioContext, seconds: number, brown = false): AudioBufferSourceNode {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx, seconds, brown);
  return s;
}

function env(ctx: BaseAudioContext, t: number, a: number, peak: number, d: number, sustain = 0): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.001, a));
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + d);
  return g;
}

function osc(ctx: BaseAudioContext, type: OscillatorType, f: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  return o;
}

function filt(ctx: BaseAudioContext, type: BiquadFilterType, f: number, q = 1): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

function shaper(ctx: BaseAudioContext, amount: number): WaveShaperNode {
  const w = ctx.createWaveShaper();
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / n) * 2 - 1;
    curve[i] = ((1 + amount) * x) / (1 + amount * Math.abs(x));
  }
  w.curve = curve;
  return w;
}

function chain(...nodes: AudioNode[]): AudioNode {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
  return nodes[nodes.length - 1];
}

// ---------- recipes ----------

function metal(ctx: BaseAudioContext, out: AudioNode, t: number, freqs: number[], gain: number, decay: number): void {
  for (const f of freqs) {
    const o = osc(ctx, 'sine', f * rnd(0.97, 1.03));
    const g = env(ctx, t, 0.002, gain / freqs.length, decay * rnd(0.7, 1.2));
    chain(o, g, out);
    o.start(t);
    o.stop(t + decay * 1.5);
  }
}

function thud(ctx: BaseAudioContext, out: AudioNode, t: number, from = 120, to = 40, gain = 0.9, dur = 0.14): void {
  const o = osc(ctx, 'sine', from);
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = env(ctx, t, 0.002, gain, dur + 0.1);
  chain(o, g, out);
  o.start(t);
  o.stop(t + dur + 0.2);
}

function burst(ctx: BaseAudioContext, out: AudioNode, t: number, dur: number, type: BiquadFilterType, f: number, gain: number, q = 1): void {
  const n = noise(ctx, dur + 0.05);
  const g = env(ctx, t, 0.003, gain, dur);
  chain(n, filt(ctx, type, f, q), g, out);
  n.start(t);
}

const doorSlam: Recipe = (ctx, out, t) => {
  burst(ctx, out, t, 0.25, 'lowpass', 900, 0.8);
  metal(ctx, out, t, [180, 420, 750, 1130], 0.5, 0.45);
  thud(ctx, out, t, 120, 40, 1);
  return 0.6;
};

const doorOpen: Recipe = (ctx, out, t) => {
  const n = noise(ctx, 0.4);
  const f = filt(ctx, 'bandpass', 300, 3);
  f.frequency.setValueAtTime(300, t);
  f.frequency.exponentialRampToValueAtTime(2200, t + 0.35);
  chain(n, f, env(ctx, t, 0.02, 0.5, 0.35), out);
  n.start(t);
  metal(ctx, out, t + 0.3, [220, 510], 0.2, 0.2);
  return 0.5;
};

const click: Recipe = (ctx, out, t) => {
  const o = osc(ctx, 'square', 2200);
  chain(o, env(ctx, t, 0.001, 0.25, 0.012), out);
  o.start(t);
  o.stop(t + 0.03);
  return 0.03;
};

const errorBuzz: Recipe = (ctx, out, t) => {
  for (const off of [0, 0.14]) {
    const o = osc(ctx, 'square', 160);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t + off);
    g.gain.linearRampToValueAtTime(0.35, t + off + 0.005);
    g.gain.setValueAtTime(0.35, t + off + 0.1);
    g.gain.linearRampToValueAtTime(0, t + off + 0.11);
    chain(o, g, out);
    o.start(t + off);
    o.stop(t + off + 0.12);
  }
  return 0.3;
};

const whoosh: Recipe = (ctx, out, t) => {
  const n = noise(ctx, 0.35);
  const f = filt(ctx, 'bandpass', 400, 1.5);
  f.frequency.setValueAtTime(400, t);
  f.frequency.exponentialRampToValueAtTime(3000, t + 0.25);
  chain(n, f, env(ctx, t, 0.05, 0.4, 0.25), out);
  n.start(t);
  click(ctx, out, t + 0.28);
  return 0.35;
};

const camSwitch: Recipe = (ctx, out, t) => {
  click(ctx, out, t);
  burst(ctx, out, t, 0.12, 'bandpass', 3000, 0.25, 0.7);
  return 0.15;
};

const staticBurst: Recipe = (ctx, out, t) => {
  burst(ctx, out, t, 0.6, 'highpass', 1500, 0.4);
  return 0.6;
};

const sting: Recipe = (ctx, out, t) => {
  const sh = shaper(ctx, 8);
  const g = env(ctx, t, 0.004, 0.55, 0.6);
  chain(sh, g, out);
  for (const st of [0, 1, 2, 6, 7]) {
    const o = osc(ctx, 'sawtooth', 220 * Math.pow(2, st / 12) * rnd(0.995, 1.005));
    o.connect(sh);
    o.start(t);
    o.stop(t + 0.7);
  }
  return 0.7;
};

function footstep(variant: 'heavy' | 'clunky' | 'light' = 'heavy'): Recipe {
  return (ctx, out, t) => {
    const deep = variant === 'heavy' ? 70 : variant === 'clunky' ? 95 : 130;
    thud(ctx, out, t, deep * 1.8, deep, variant === 'light' ? 0.4 : 0.7, 0.1);
    metal(ctx, out, t + 0.01, [310, 690, 1240].map((f) => f * rnd(0.9, 1.1)), variant === 'clunky' ? 0.35 : 0.2, 0.12);
    return 0.25;
  };
}

function formantVoice(ctx: BaseAudioContext, out: AudioNode, t: number, f0: number, dur: number, formants: number[], gain: number, slide = 1): void {
  const src = osc(ctx, 'sawtooth', f0);
  src.frequency.setValueAtTime(f0, t);
  src.frequency.exponentialRampToValueAtTime(f0 * slide, t + dur);
  const g = env(ctx, t, 0.04, gain, dur);
  for (const f of formants) {
    const bp = filt(ctx, 'bandpass', f, 6);
    src.connect(bp);
    bp.connect(g);
  }
  g.connect(out);
  src.start(t);
  src.stop(t + dur + 0.1);
}

const laugh: Recipe = (ctx, out, t) => {
  for (let i = 0; i < 3; i++) formantVoice(ctx, out, t + i * 0.28, 88 - i * 4, 0.22, [400, 800, 2600], 0.9, 0.85);
  return 1.1;
};

const groan: Recipe = (ctx, out, t) => {
  const sh = shaper(ctx, 20);
  sh.connect(out);
  formantVoice(ctx, sh, t, 140, 1.4, [500, 900, 2400], 0.5, 0.45);
  return 1.5;
};

const breathing: Recipe = (ctx, out, t) => {
  for (const [off, dur] of [
    [0, 1.1],
    [1.4, 1.3],
  ]) {
    const n = noise(ctx, dur + 0.1);
    const f = filt(ctx, 'bandpass', off ? 600 : 900, 2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t + off);
    g.gain.linearRampToValueAtTime(0.35, t + off + dur * 0.4);
    g.gain.linearRampToValueAtTime(0.0001, t + off + dur);
    const d = ctx.createDelay();
    d.delayTime.value = 0.004;
    const fb = ctx.createGain();
    fb.gain.value = 0.6;
    chain(n, f, g);
    g.connect(out);
    g.connect(d);
    d.connect(fb);
    fb.connect(d);
    d.connect(out);
    n.start(t + off);
  }
  return 2.8;
};

const kitchen: Recipe = (ctx, out, t) => {
  for (let i = 0; i < 5; i++) {
    const tt = t + rnd(0, 0.9);
    metal(ctx, out, tt, [rnd(500, 900), rnd(1300, 2100), rnd(2800, 4200), rnd(5000, 6000)], 0.35, rnd(0.15, 0.4));
  }
  burst(ctx, out, t + 0.2, 0.4, 'bandpass', 1800, 0.15, 4);
  return 1.2;
};

const knock: Recipe = (ctx, out, t) => {
  for (let i = 0; i < 3; i++) {
    const tt = t + i * 0.32 + rnd(0, 0.04);
    burst(ctx, out, tt, 0.12, 'lowpass', 700, 0.9);
    metal(ctx, out, tt, [160, 390, 720], 0.7, 0.35);
    thud(ctx, out, tt, 100, 35, 1, 0.12);
  }
  return 1.3;
};

const foxyRun: Recipe = (ctx, out, t) => {
  let tt = t;
  let gap = 0.28;
  for (let i = 0; i < 12; i++) {
    footstep('light')(ctx, out, tt);
    tt += gap;
    gap *= 0.9;
  }
  return tt - t + 0.3;
};

function scream(kind: string): Recipe {
  return (ctx, out, t) => {
    const dur = kind === 'golden' ? 1.4 : 1.05;
    const base = kind === 'foxy' ? 520 : kind === 'freddy' || kind === 'powerout' ? 220 : kind === 'puppet' ? 640 : 330;
    const sh = shaper(ctx, 60);
    const master = ctx.createGain();
    master.gain.setValueAtTime(1, t);
    master.gain.setValueAtTime(1, t + dur - 0.1);
    master.gain.linearRampToValueAtTime(0.0001, t + dur);
    chain(sh, master, out);
    // Layer 1: chaotic FM sawtooth.
    const car = osc(ctx, 'sawtooth', base);
    const mod = osc(ctx, 'sawtooth', base * 0.53);
    const mg = ctx.createGain();
    mg.gain.value = base * 2.5;
    mod.connect(mg);
    mg.connect(car.frequency);
    for (let i = 0; i < 12; i++) car.frequency.setValueAtTime(base * rnd(0.6, 2.2), t + (i * dur) / 12);
    const g1 = ctx.createGain();
    g1.gain.value = 0.5;
    chain(car, g1, sh);
    car.start(t);
    mod.start(t);
    car.stop(t + dur);
    mod.stop(t + dur);
    // Layer 2: resonant noise sweep.
    const n = noise(ctx, dur);
    const bp = filt(ctx, 'bandpass', 2000, 8);
    bp.frequency.setValueAtTime(800, t);
    bp.frequency.exponentialRampToValueAtTime(6000, t + dur * 0.4);
    bp.frequency.exponentialRampToValueAtTime(1200, t + dur);
    const g2 = ctx.createGain();
    g2.gain.value = 0.9;
    chain(n, bp, g2, sh);
    n.start(t);
    // Layer 3: sub hit.
    thud(ctx, out, t, 90, 30, 1, 0.3);
    if (kind === 'golden') {
      // Bit-crushed and cut dead, like the game crashed.
      const crush = shaper(ctx, 400);
      g1.disconnect();
      chain(g1, crush, sh);
    }
    return dur;
  };
}

const sparks: Recipe = (ctx, out, t) => {
  for (let i = 0; i < 8; i++) burst(ctx, out, t + rnd(0, 0.35), rnd(0.005, 0.03), 'highpass', 3000, rnd(0.2, 0.6));
  return 0.4;
};

const chime6: Recipe = (ctx, out, t) => {
  for (let i = 0; i < 6; i++) {
    const tt = t + i * 1.0;
    for (const [r, g] of [
      [1, 0.4],
      [2.76, 0.2],
      [5.4, 0.1],
    ] as const) {
      const o = osc(ctx, 'sine', 523 * r);
      chain(o, env(ctx, tt, 0.003, g, 2.4), out);
      o.start(tt);
      o.stop(tt + 2.6);
    }
  }
  return 7.5;
};

const cheer: Recipe = (ctx, out, t) => {
  for (let i = 0; i < 20; i++) {
    const f0 = rnd(250, 400);
    formantVoice(ctx, out, t + rnd(0, 0.15), f0, rnd(0.5, 0.9), [700, 1800, 2600], 0.12, rnd(1.1, 1.4));
  }
  for (let i = 0; i < 3; i++) {
    const tt = t + rnd(0, 0.6);
    const o = osc(ctx, 'square', 900);
    const m = osc(ctx, 'sine', 30);
    const mg = ctx.createGain();
    mg.gain.value = 120;
    m.connect(mg);
    mg.connect(o.frequency);
    chain(o, filt(ctx, 'lowpass', 2500), env(ctx, tt, 0.05, 0.12, 0.6), out);
    o.start(tt);
    m.start(tt);
    o.stop(tt + 0.8);
    m.stop(tt + 0.8);
  }
  return 1.6;
};

const honk: Recipe = (ctx, out, t) => {
  const o = osc(ctx, 'square', 600);
  o.frequency.setValueAtTime(700, t);
  o.frequency.exponentialRampToValueAtTime(380, t + 0.18);
  chain(o, filt(ctx, 'lowpass', 2000), env(ctx, t, 0.005, 0.35, 0.2), out);
  o.start(t);
  o.stop(t + 0.25);
  return 0.25;
};

const coin: Recipe = (ctx, out, t) => {
  for (const [f, off] of [
    [988, 0],
    [1319, 0.08],
  ]) {
    const o = osc(ctx, 'square', f);
    chain(o, env(ctx, t + off, 0.002, 0.15, 0.25), out);
    o.start(t + off);
    o.stop(t + off + 0.3);
  }
  return 0.4;
};

const equip: Recipe = (ctx, out, t) => {
  for (const [f, off] of [
    [659, 0],
    [880, 0.06],
    [1175, 0.12],
  ]) {
    const o = osc(ctx, 'triangle', f);
    chain(o, env(ctx, t + off, 0.003, 0.2, 0.4), out);
    o.start(t + off);
    o.stop(t + off + 0.5);
  }
  return 0.6;
};

const achievementChime: Recipe = (ctx, out, t) => {
  for (const [f, off] of [
    [784, 0],
    [988, 0.1],
    [1319, 0.2],
  ]) {
    const o = osc(ctx, 'sine', f);
    chain(o, env(ctx, t + off, 0.003, 0.25, 0.6), out);
    o.start(t + off);
    o.stop(t + off + 0.7);
  }
  return 0.9;
};

const squelch: Recipe = (ctx, out, t) => {
  burst(ctx, out, t, 0.09, 'bandpass', 2400, 0.25, 1.5);
  return 0.1;
};

const blip: Recipe = (ctx, out, t) => {
  const o = osc(ctx, 'sine', 1400);
  o.frequency.setValueAtTime(1400, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.08);
  chain(o, env(ctx, t, 0.003, 0.15, 0.1), out);
  o.start(t);
  o.stop(t + 0.15);
  return 0.15;
};

const heartbeat: Recipe = (ctx, out, t) => {
  thud(ctx, out, t, 70, 40, 0.6, 0.1);
  thud(ctx, out, t + 0.22, 60, 35, 0.45, 0.1);
  return 0.5;
};

const giggle: Recipe = (ctx, out, t) => {
  for (let i = 0; i < 4; i++) formantVoice(ctx, out, t + i * 0.11, 380 + i * 30, 0.08, [800, 1800, 3000], 0.25, 1.2);
  return 0.6;
};

const garble: Recipe = (ctx, out, t) => {
  for (let i = 0; i < 18; i++) {
    const tt = t + i * 0.13 + rnd(0, 0.05);
    const n = noise(ctx, 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, tt);
    g.gain.exponentialRampToValueAtTime(0.25, tt + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.12);
    chain(n, filt(ctx, 'bandpass', rnd(300, 1200), 5), g, out);
    n.start(tt);
  }
  const d = osc(ctx, 'sine', 48);
  chain(d, env(ctx, t, 0.4, 0.2, 2.2), out);
  d.start(t);
  d.stop(t + 2.8);
  return 2.6;
};

const phoneRing: Recipe = (ctx, out, t) => {
  const g = ctx.createGain();
  g.gain.value = 0;
  chain(g, filt(ctx, 'bandpass', 1200, 0.7), out);
  for (const f of [440, 480]) {
    const o = osc(ctx, 'sine', f);
    o.connect(g);
    o.start(t);
    o.stop(t + 2);
  }
  for (let i = 0; i < 40; i++) g.gain.setValueAtTime(i % 2 ? 0 : 0.25, t + i * 0.05);
  return 2;
};

const RECIPES: Record<string, Recipe> = {
  door_slam: doorSlam,
  door_open: doorOpen,
  click,
  error: errorBuzz,
  whoosh,
  cam: camSwitch,
  static: staticBurst,
  sting,
  step_heavy: footstep('heavy'),
  step_clunky: footstep('clunky'),
  step_light: footstep('light'),
  laugh,
  groan,
  breathing,
  kitchen,
  knock,
  foxy_run: foxyRun,
  scream_bonnie: scream('bonnie'),
  scream_chica: scream('chica'),
  scream_freddy: scream('freddy'),
  scream_foxy: scream('foxy'),
  scream_golden: scream('golden'),
  scream_puppet: scream('puppet'),
  scream_powerout: scream('powerout'),
  scream_generic: scream('generic'),
  sparks,
  chime6,
  cheer,
  honk,
  coin,
  equip,
  achievement: achievementChime,
  squelch,
  blip,
  heartbeat,
  giggle,
  garble,
  phone: phoneRing,
};

const BUS_FOR: Record<string, Bus> = {
  click: 'ui',
  coin: 'ui',
  equip: 'ui',
  achievement: 'ui',
  blip: 'ui',
  chime6: 'music',
  cheer: 'music',
};

class AudioEngine {
  ctx: AudioContext | null = null;
  private buses = new Map<Bus, GainNode>();
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private loops = new Map<string, { stop: (fade?: number) => void; gain: GainNode; extra?: Record<string, AudioParam> }>();
  private reverb: ConvolverNode | null = null;
  ready = false;

  /** Must be called from a user gesture. */
  async init(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -6;
    comp.ratio.value = 12;
    comp.attack.value = 0.002;
    comp.release.value = 0.2;
    this.master = ctx.createGain();
    chain(this.master, comp, ctx.destination);
    for (const b of ['ambience', 'sfx', 'jumpscare', 'voice', 'ui', 'music'] as Bus[]) {
      const g = ctx.createGain();
      g.connect(this.master);
      this.buses.set(b, g);
    }
    this.reverb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 1.8, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    }
    this.reverb.buffer = ir;
    const rg = ctx.createGain();
    rg.gain.value = 0.35;
    chain(this.reverb, rg, this.buses.get('sfx') as GainNode);
    this.applyVolumes();
    store.on(() => this.applyVolumes());
    await this.prerender();
    this.ready = true;
  }

  applyVolumes(): void {
    if (!this.ctx || !this.master) return;
    const s = store.settings;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.05);
    const js = s.reducedJumpscares ? Math.min(0.5, s.jumpscare) : s.jumpscare;
    const set = (b: Bus, v: number) => this.buses.get(b)?.gain.setTargetAtTime(v, t, 0.05);
    set('ambience', s.ambience * 0.6);
    set('sfx', s.effects);
    set('jumpscare', js * 1.3);
    set('voice', s.muteVoice ? 0 : s.voice);
    set('ui', s.effects * 0.7);
    set('music', s.effects * 0.8);
  }

  /** Render every one-shot once with OfflineAudioContext so playback is just a buffer start. */
  private async prerender(): Promise<void> {
    const ctx = this.ctx as AudioContext;
    for (const [name, r] of Object.entries(RECIPES)) {
      const dur = name === 'chime6' ? 7.5 : name.startsWith('foxy_run') ? 3 : name === 'breathing' ? 3 : name.startsWith('scream') ? 1.6 : 2;
      const off = new OfflineAudioContext(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
      r(off, off.destination, 0);
      this.buffers.set(name, await off.startRendering());
    }
  }

  bus(b: Bus): AudioNode {
    return this.buses.get(b) as AudioNode;
  }

  /** Play a sound. `pan` is -1 (left) to 1 (right). `distance` softens and quietens. */
  play(name: string, o: { pan?: number; gain?: number; bus?: Bus; distance?: number; rate?: number; reverb?: boolean } = {}): void {
    const ctx = this.ctx;
    const buf = this.buffers.get(name);
    if (!ctx || !buf) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = o.rate ?? 1;
    const g = ctx.createGain();
    const dist = o.distance ?? 0;
    g.gain.value = (o.gain ?? 1) / (1 + dist * 0.6);
    let node: AudioNode = src;
    if (dist > 0) {
      const lp = filt(ctx, 'lowpass', 8000 / (1 + dist));
      node.connect(lp);
      node = lp;
    }
    node.connect(g);
    let last: AudioNode = g;
    if (o.pan !== undefined) {
      const p = ctx.createPanner();
      p.panningModel = 'HRTF';
      p.positionX.value = o.pan * 2;
      p.positionZ.value = -1 - dist;
      g.connect(p);
      last = p;
    }
    const bus = o.bus ?? (name.startsWith('scream') ? 'jumpscare' : (BUS_FOR[name] ?? 'sfx'));
    last.connect(this.bus(bus));
    if (o.reverb && this.reverb) last.connect(this.reverb);
    src.start();
  }

  /** Melodies on a music-box voice, with optional wow-and-flutter and tempo. Returns a stop function. */
  melody(m: Melody | string, o: { bpm?: number; gain?: number; loop?: boolean; wobble?: number; voice?: 'box' | 'chip' | 'hum'; bus?: Bus; pan?: number } = {}): () => void {
    const ctx = this.ctx;
    if (!ctx) return () => {};
    const notes = typeof m === 'string' ? MELODIES[m] : m;
    const out = ctx.createGain();
    out.gain.value = o.gain ?? 0.25;
    let dest: AudioNode = out;
    if (o.pan !== undefined) {
      const p = ctx.createStereoPanner();
      p.pan.value = o.pan;
      out.connect(p);
      dest = p;
    }
    dest.connect(this.bus(o.bus ?? 'sfx'));
    const beat = 60 / (o.bpm ?? 110);
    let stopped = false;
    let timer = 0;
    const schedule = (start: number) => {
      let t = start;
      for (const [n, b] of notes) {
        if (n > 0) this.note(n, t, b * beat, out, o.voice ?? 'box', o.wobble ?? 0);
        t += b * beat;
      }
      return t;
    };
    const loopFn = (start: number) => {
      if (stopped) return;
      const end = schedule(start);
      if (o.loop) timer = window.setTimeout(() => loopFn(end), Math.max(0, (end - ctx.currentTime - 0.3) * 1000));
    };
    loopFn(ctx.currentTime + 0.05);
    return () => {
      stopped = true;
      clearTimeout(timer);
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => out.disconnect(), 400);
    };
  }

  private note(midi: number, t: number, dur: number, out: AudioNode, voice: 'box' | 'chip' | 'hum', wobble: number): void {
    const ctx = this.ctx as AudioContext;
    const f = mtof(midi);
    const parts = voice === 'box' ? [[1, 1, 'sine'], [2, 0.35, 'sine'], [3, 0.15, 'sine']] : voice === 'chip' ? [[1, 0.6, 'square'], [0.5, 0.3, 'triangle']] : [[1, 0.8, 'triangle'], [2, 0.2, 'sine']];
    for (const [r, g, type] of parts as [number, number, OscillatorType][]) {
      const o = osc(ctx, type, f * r);
      if (wobble) {
        const lfo = osc(ctx, 'sine', 4.5);
        const lg = ctx.createGain();
        lg.gain.value = wobble * 12;
        lfo.connect(lg);
        lg.connect(o.detune);
        lfo.start(t);
        lfo.stop(t + dur + 0.6);
      }
      const decay = voice === 'box' ? Math.min(1.2, dur * 2) : dur * 0.9;
      chain(o, env(ctx, t, voice === 'hum' ? 0.05 : 0.004, g * 0.5, decay), out);
      o.start(t);
      o.stop(t + decay + 0.1);
    }
    if (voice === 'box') {
      const c = osc(ctx, 'square', 3500);
      chain(c, env(ctx, t, 0.001, 0.03, 0.01), out);
      c.start(t);
      c.stop(t + 0.02);
    }
  }

  // ---------- loops ----------

  startLoop(id: string, kind: 'fan' | 'drone' | 'light_hum' | 'mic' | 'static' | 'breath_loop' | 'radio_static'): void {
    const ctx = this.ctx;
    if (!ctx || this.loops.has(id)) return;
    const g = ctx.createGain();
    g.gain.value = 0;
    const stops: (() => void)[] = [];
    const extra: Record<string, AudioParam> = {};
    const bus: Bus = kind === 'light_hum' ? 'sfx' : 'ambience';
    g.connect(this.bus(bus));
    if (kind === 'fan') {
      const n = noise(ctx, 4, true);
      n.loop = true;
      const lp = filt(ctx, 'lowpass', 400);
      const mod = ctx.createGain();
      mod.gain.value = 0.8;
      const lfo = osc(ctx, 'sine', 9);
      const lg = ctx.createGain();
      lg.gain.value = 0.15;
      lfo.connect(lg);
      lg.connect(mod.gain);
      chain(n, lp, mod, g);
      const hum = osc(ctx, 'sine', 60);
      const hum2 = osc(ctx, 'sine', 120);
      const hg = ctx.createGain();
      hg.gain.value = 0.05;
      hum.connect(hg);
      hum2.connect(hg);
      hg.connect(g);
      n.start();
      lfo.start();
      hum.start();
      hum2.start();
      extra.rate = n.playbackRate;
      extra.lfo = lfo.frequency;
      stops.push(() => [n, lfo, hum, hum2].forEach((x) => x.stop()));
      g.gain.setTargetAtTime(0.5, ctx.currentTime, 0.3);
    } else if (kind === 'drone') {
      const a = osc(ctx, 'sine', 43);
      const b = osc(ctx, 'sine', 47.5);
      const lfo = osc(ctx, 'sine', 0.07);
      const lg = ctx.createGain();
      lg.gain.value = 0.12;
      lfo.connect(lg);
      lg.connect(g.gain);
      a.connect(g);
      b.connect(g);
      a.start();
      b.start();
      lfo.start();
      stops.push(() => [a, b, lfo].forEach((x) => x.stop()));
      g.gain.setTargetAtTime(0.3, ctx.currentTime, 1);
      extra.f = a.frequency;
    } else if (kind === 'light_hum') {
      const s = osc(ctx, 'sawtooth', 120);
      chain(s, filt(ctx, 'bandpass', 240, 8), g);
      s.start();
      stops.push(() => s.stop());
      g.gain.setTargetAtTime(0.18, ctx.currentTime, 0.02);
    } else if (kind === 'static' || kind === 'radio_static' || kind === 'mic') {
      const n = noise(ctx, 2);
      n.loop = true;
      chain(n, filt(ctx, kind === 'mic' ? 'lowpass' : 'bandpass', kind === 'mic' ? 600 : 2500, 0.8), g);
      n.start();
      stops.push(() => n.stop());
      g.gain.setTargetAtTime(kind === 'mic' ? 0.05 : 0.08, ctx.currentTime, 0.05);
    } else if (kind === 'breath_loop') {
      const tick = () => this.play('breathing', { gain: 0.6, pan: 0 });
      tick();
      const iv = window.setInterval(tick, 3000);
      stops.push(() => clearInterval(iv));
      g.gain.value = 1;
    }
    this.loops.set(id, {
      gain: g,
      extra,
      stop: (fade = 0.2) => {
        g.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
        setTimeout(() => {
          stops.forEach((s) => {
            try {
              s();
            } catch {
              /* already stopped */
            }
          });
          g.disconnect();
        }, fade * 1000 + 100);
      },
    });
  }

  loopGain(id: string, v: number, tc = 0.1): void {
    const l = this.loops.get(id);
    if (l && this.ctx) l.gain.gain.setTargetAtTime(v, this.ctx.currentTime, tc);
  }

  /** The fan winding down in a blackout: pitch slides down over two seconds. */
  fanDown(): void {
    const l = this.loops.get('fan');
    if (!l || !this.ctx) return;
    const t = this.ctx.currentTime;
    l.extra?.rate?.setTargetAtTime(0.2, t, 0.6);
    l.extra?.lfo?.setTargetAtTime(0.5, t, 0.6);
    this.stopLoop('fan', 2.2);
  }

  stopLoop(id: string, fade = 0.2): void {
    const l = this.loops.get(id);
    if (!l) return;
    this.loops.delete(id);
    l.stop(fade);
  }

  stopAll(): void {
    for (const id of [...this.loops.keys()]) this.stopLoop(id, 0.3);
  }

  /** Speech-rhythm babble through a phone band-pass, for the manager's calls. */
  babble(seconds: number, gain = 0.5): () => void {
    const ctx = this.ctx;
    if (!ctx) return () => {};
    const out = ctx.createGain();
    out.gain.value = gain;
    const hp = filt(ctx, 'highpass', 300);
    const lp = filt(ctx, 'lowpass', 3400);
    chain(out, hp, lp, this.bus('voice'));
    let t = ctx.currentTime + 0.05;
    const end = t + seconds;
    while (t < end) {
      const syl = rnd(0.07, 0.2);
      formantVoice(ctx, out, t, rnd(100, 150), syl, [rnd(500, 800), rnd(1000, 1800), 2500], 0.4, rnd(0.9, 1.15));
      t += syl + (Math.random() < 0.15 ? rnd(0.2, 0.5) : rnd(0.02, 0.06));
    }
    return () => {
      out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      setTimeout(() => out.disconnect(), 300);
    };
  }

  /** Walkie-talkie chain for an incoming voice stream. */
  radioChain(stream: MediaStream, heavyStatic: () => boolean): { gain: GainNode; disconnect(): void } {
    const ctx = this.ctx as AudioContext;
    const src = ctx.createMediaStreamSource(stream);
    const g = ctx.createGain();
    const ws = shaper(ctx, 3);
    chain(src, filt(ctx, 'highpass', 300), filt(ctx, 'lowpass', 3400), ws, g, this.bus('voice'));
    const n = noise(ctx, 2);
    n.loop = true;
    const ng = ctx.createGain();
    ng.gain.value = 0.01;
    chain(n, filt(ctx, 'bandpass', 2000, 0.6), ng, this.bus('voice'));
    n.start();
    const iv = window.setInterval(() => ng.gain.setTargetAtTime(heavyStatic() ? 0.06 : 0.008, ctx.currentTime, 0.2), 500);
    return {
      gain: g,
      disconnect() {
        clearInterval(iv);
        n.stop();
        src.disconnect();
        g.disconnect();
      },
    };
  }
}

export const MELODIES: Record<string, Melody> = {
  toreador: TOREADOR,
  weasel: WEASEL,
  freddy: FREDDY_TUNE,
  foxy: FOXY_HUM,
  title: TITLE_BOX,
  chipA: CHIP_A,
  chipB: CHIP_B,
};

export const SOUND_NAMES = Object.keys(RECIPES);
export const audio = new AudioEngine();
