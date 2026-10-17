import { h } from '../ui/dom';
import { store } from '../store';
import { CONFIG, ROSTER_BY_ID, type Input, type MapDef, type PlayerView, type StationId } from '@fnaf/shared';

/** Showtime: the Puppeteer's top-down map with fog of war and cooldown rings. */
export class PuppeteerMap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private wrap: HTMLElement;
  private selected: string | null = null;
  private view: PlayerView | null = null;
  private abilityStation: StationId | null = null;

  constructor(
    root: HTMLElement,
    private map: MapDef,
    private send: (i: Input) => void,
  ) {
    this.canvas = h('canvas', { width: '900', height: '700', style: 'width:100%;height:100%' });
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;
    this.wrap = h(
      'div',
      { class: 'puppeteer-map' },
      this.canvas,
      h(
        'div',
        { style: 'position:absolute;bottom:8px;left:8px;display:flex;gap:6px' },
        h('button', { class: 'btn small', onclick: () => this.ability('lights_out') }, `Lights Out (${CONFIG.showtime.LIGHTS_OUT.duration}s)`),
        h('button', { class: 'btn small', onclick: () => this.ability('static') }, `Static (${CONFIG.showtime.STATIC.duration}s)`),
      ),
      h('div', { style: 'position:absolute;top:8px;left:12px;font-family:VT323;font-size:20px;color:#c44fd0' }, 'PUPPETEER: click a character, then a neighbouring room or a door. Click a station to target abilities.'),
    );
    root.appendChild(this.wrap);
    this.canvas.addEventListener('click', (e) => this.click(e));
  }

  private xy(x: number, y: number): [number, number] {
    return [40 + (x / 100) * 820, 50 + (y / 100) * 600];
  }

  private click(e: MouseEvent): void {
    const r = this.canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 900;
    const py = ((e.clientY - r.top) / r.height) * 700;
    const v = this.view;
    if (!v) return;
    // Characters first.
    for (const a of v.an) {
      const n = this.map.nodes[a.n];
      if (!n) continue;
      const [x, y] = this.xy(n.x, n.y);
      if (Math.hypot(px - x, py - y) < 22 && ['freddy', 'bonnie', 'chica', 'foxy'].includes(a.id)) {
        if (a.id === 'foxy') {
          this.send({ action: 'showtime_move', anim: 'foxy', node: a.n });
          return;
        }
        this.selected = a.id;
        return;
      }
    }
    // Stations (doors / ability targets).
    for (const s of this.map.stations) {
      const [x, y] = this.xy(s.x, s.y);
      if (Math.hypot(px - x, py - y) < 26) {
        this.abilityStation = s.id;
        if (this.selected) {
          const a = v.an.find((q) => q.id === this.selected);
          const door = s.doors.find((d) => (ROSTER_BY_ID[this.selected ?? '']?.hunts[this.map.id] ?? []).includes(d) && (a?.d === d || this.map.doors[d].from === a?.n));
          if (door) this.send({ action: 'showtime_move', anim: this.selected, door });
        }
        return;
      }
    }
    for (const n of Object.values(this.map.nodes)) {
      const [x, y] = this.xy(n.x, n.y);
      if (Math.hypot(px - x, py - y) < 24 && this.selected) {
        this.send({ action: 'showtime_move', anim: this.selected, node: n.id });
        return;
      }
    }
  }

  private ability(a: 'lights_out' | 'static'): void {
    const st = this.abilityStation ?? (this.view?.stations.find((s) => s.alive && !s.sealed)?.id as StationId | undefined);
    if (st) this.send({ action: 'showtime_ability', ability: a, station: st });
  }

  update(v: PlayerView): void {
    this.view = v;
    const c = this.ctx;
    c.fillStyle = '#05040a';
    c.fillRect(0, 0, 900, 700);
    const vision = new Set(v.vision ?? []);
    // Edges.
    c.strokeStyle = '#2a2234';
    c.lineWidth = 3;
    for (const n of Object.values(this.map.nodes)) {
      const [x, y] = this.xy(n.x, n.y);
      for (const l of n.links) {
        const m = this.map.nodes[l];
        const [x2, y2] = this.xy(m.x, m.y);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x2, y2);
        c.stroke();
      }
    }
    for (const d of Object.values(this.map.doors)) {
      const from = this.map.nodes[d.from];
      const st = this.map.stations.find((s) => s.id === d.station);
      if (!from || !st) continue;
      const [x, y] = this.xy(from.x, from.y);
      const [x2, y2] = this.xy(st.x, st.y);
      c.strokeStyle = v.doors[d.id]?.c ? '#ff3a3a' : '#5a5a6a';
      c.lineWidth = v.doors[d.id]?.c ? 6 : 2;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x2, y2);
      c.stroke();
    }
    c.font = '15px VT323, monospace';
    for (const n of Object.values(this.map.nodes)) {
      const [x, y] = this.xy(n.x, n.y);
      c.fillStyle = vision.has(n.id) ? '#2a1e3a' : '#0c0a12';
      c.beginPath();
      c.arc(x, y, 22, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = vision.has(n.id) ? '#c8b8e8' : '#4a4058';
      c.fillText(n.name.slice(0, 14), x - 30, y + 36);
    }
    for (const s of v.stations) {
      const def = this.map.stations.find((q) => q.id === s.id);
      if (!def) continue;
      const [x, y] = this.xy(def.x, def.y);
      c.fillStyle = s.sealed ? '#222' : s.alive ? '#3a6a3a' : '#5a1a1a';
      c.fillRect(x - 24, y - 16, 48, 32);
      c.fillStyle = '#fff';
      c.fillText(`${s.name || s.id}${s.tab ? ' [CAM]' : ''}`, x - 30, y + 30);
      if (this.abilityStation === s.id) {
        c.strokeStyle = '#c44fd0';
        c.strokeRect(x - 27, y - 19, 54, 38);
      }
    }
    const colors: Record<string, string> = { freddy: '#a0703a', bonnie: '#6a6aff', chica: '#ffd21a', foxy: '#ff5a3a', puppet: '#ffffff' };
    for (const a of v.an) {
      const n = this.map.nodes[a.n];
      if (!n) continue;
      const [x, y] = this.xy(n.x, n.y);
      const ox = ['freddy', 'bonnie', 'chica', 'foxy', 'puppet'].indexOf(a.id) * 8 - 16;
      c.fillStyle = colors[a.id] ?? '#aaa';
      c.beginPath();
      c.arc(x + ox, y, 10, 0, Math.PI * 2);
      c.fill();
      const cdMax = (ROSTER_BY_ID[a.id]?.interval ?? 5) * CONFIG.showtime.COOLDOWN_SCALE * CONFIG.TICK_HZ;
      const frac = 1 - Math.min(1, (a.cd ?? 0) / cdMax);
      c.strokeStyle = frac >= 1 ? '#5af07a' : '#888';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(x + ox, y, 14, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
      c.stroke();
      if (this.selected === a.id) {
        c.strokeStyle = '#fff';
        c.beginPath();
        c.arc(x + ox, y, 18, 0, Math.PI * 2);
        c.stroke();
      }
      c.fillStyle = '#fff';
      c.fillText(`${store.roster.name(a.id)}${a.s !== 'room' ? ` (${a.s})` : ''}${a.id === 'foxy' ? ` st${a.st ?? 0}` : ''}`, x + ox - 20, y - 18);
    }
    c.fillStyle = '#c44fd0';
    c.fillText(`Lights Out ${v.stime?.lightsOut ? Math.ceil(v.stime.lightsOut / 20) + 's' : 'ready'} · Static ${v.stime?.static ? Math.ceil(v.stime.static / 20) + 's' : 'ready'}`, 600, 690);
  }

  dispose(): void {
    this.wrap.remove();
  }
}
