import { FR } from '../../frConfig';
import { BREAKER_GROUPS, FUSE_BOXES, PLATE_TABLES } from '../../world/layout';
import type { CircuitId, ItemType } from '../../world/types';
import type { FrPlayer, FrSim } from './sim';
import { eyeHeight } from './controller';

// The night's jobs (Part 5): the building's power pool and drain, the main breaker load puzzle, blown
// fuses and zone switches, the music box, the cupcakes, items and the inventory, and the early exit.

export interface FrItem {
  id: number;
  type: ItemType;
  x: number;
  y: number;
  z: number;
  holder: string | null;
  /** Birthday plate it sits on, or -1. */
  plate: number;
}

export interface Objective {
  id: string;
  text: string;
  done: boolean;
  required: boolean;
  failed: boolean;
}

export const MAX_SLOTS = 4;
const GROUP_OF: Record<string, number> = {};
BREAKER_GROUPS.forEach((g, i) => g.circuits.forEach((c) => (GROUP_OF[c] = i)));

export const ZONE_CIRCUITS: CircuitId[] = ['dining', 'west', 'east', 'kitchen', 'stage', 'party', 'play', 'restroom', 'staff', 'boh', 'backstage', 'lobby', 'cove'];

export function groupOf(c: CircuitId): number {
  return GROUP_OF[c] ?? -1;
}

export class NightState {
  power: number;
  /** Breaker switches on the main panel. */
  breakers: boolean[];
  /** Load printed under each breaker (1..4). */
  loads: number[];
  /** Green band for the master lever. */
  band: [number, number];
  masterCooldown = 0;
  /** Breaker groups whose fuse is blown. */
  blown = new Set<number>();
  musicBox = 100;
  musicFailed = false;
  private warned = new Set<number>();
  items: FrItem[] = [];
  /** PLATE_TABLES indices that are tonight's birthday tables. */
  plates: number[] = [];
  requiredZones: CircuitId[] = [];
  frontUnlocked = false;
  powerOut = false;
  private crankNoiseT = 0;

  constructor(
    private readonly sim: FrSim,
    readonly enabled: boolean,
  ) {
    const n = Math.max(1, Math.min(6, sim.opts.night));
    this.power = enabled ? FR.power.START[n] : 100;
    this.loads = BREAKER_GROUPS.map(() => 1 + Math.floor(sim.rand() * 4));
    const lo = FR.power.BREAKER_LOW[0] + Math.floor(sim.rand() * (FR.power.BREAKER_LOW[1] - FR.power.BREAKER_LOW[0] + 1));
    this.band = [lo, lo + FR.power.BREAKER_BAND];
    this.breakers = BREAKER_GROUPS.map(() => !enabled);
    if (!enabled) return;
    const count = Math.max(1, sim.opts.playerCount ?? 1);
    // Blown fuses: Night 1 always includes the Dining Hall so new players see the building light up.
    const nBlown = Math.max(1, FR.objectives.BLOWN_FUSES[n] + (FR.scaling.FUSES[Math.min(4, count)] ?? 0));
    const dining = groupOf('dining');
    const groups = BREAKER_GROUPS.map((_, i) => i).filter((i) => i !== groupOf('office'));
    if (n === 1) this.blown.add(dining);
    while (this.blown.size < nBlown && this.blown.size < groups.length) this.blown.add(groups[Math.floor(sim.rand() * groups.length)]);
    // Required zones: the Dining Hall plus random others.
    const nZones = FR.objectives.ZONES_REQUIRED[n];
    this.requiredZones = ['dining'];
    const pool = ZONE_CIRCUITS.filter((c) => c !== 'dining');
    while (this.requiredZones.length < nZones) {
      const c = pool[Math.floor(sim.rand() * pool.length)];
      if (!this.requiredZones.includes(c)) this.requiredZones.push(c);
    }
    // Birthday tables.
    const idx = PLATE_TABLES.map((_, i) => i);
    while (this.plates.length < FR.objectives.CUPCAKES && idx.length) this.plates.push(idx.splice(Math.floor(sim.rand() * idx.length), 1)[0]);
    this.spawnItems();
  }

  private spawnItems(): void {
    const sim = this.sim;
    const spawns = sim.level.itemSpawns;
    const add = (type: ItemType, x: number, y: number, z: number) => this.items.push({ id: this.items.length, type, x, y, z, holder: null, plate: -1 });
    const free = spawns.filter((s) => !s.guaranteed);
    for (const s of spawns) if (s.guaranteed) add(s.guaranteed, s.x, s.y, s.z);
    const used = new Set<number>();
    const place = (type: ItemType, n: number) => {
      for (let i = 0; i < n; i++) {
        const opts = free.map((s, k) => ({ s, k })).filter(({ s, k }) => s.types.includes(type) && !used.has(k));
        if (!opts.length) return;
        const pick = opts[Math.floor(sim.rand() * opts.length)];
        used.add(pick.k);
        add(type, pick.s.x, pick.s.y, pick.s.z);
      }
    };
    const [b0, b1] = FR.objectives.RANDOM_ITEMS.battery;
    const [f0, f1] = FR.objectives.RANDOM_ITEMS.fuse;
    place('battery', b0 + Math.floor(sim.rand() * (b1 - b0 + 1)));
    // Always enough fuses for every blown box plus a spare, counting the two in the supply closet.
    place('fuse', Math.max(this.blown.size + 1 - 2, f0 + Math.floor(sim.rand() * (f1 - f0 + 1))));
  }

  // ---- Power -------------------------------------------------------------------------------------

  /** Is this circuit's breaker on and its fuse intact? */
  groupLive(c: CircuitId): boolean {
    const g = groupOf(c);
    if (g < 0) return true;
    return this.breakers[g] && !this.blown.has(g);
  }

  loadOn(): number {
    return this.breakers.reduce((s, on, i) => s + (on ? this.loads[i] : 0), 0);
  }

  /** Drain in percent per in-game hour right now. */
  drainPerHour(): number {
    const sim = this.sim;
    let r = FR.power.ALWAYS;
    if (!sim.power.main) return r;
    r += FR.power.BASE + sim.office.drainPerHour();
    for (const c of sim.power.circuits) if (c !== 'always' && sim.circuitOn(c)) r += FR.power.PER_CIRCUIT;
    sim.level.doors.forEach((d, i) => {
      if (d.kind !== 'shutter' || sim.doorTarget[i] > 0.5) return;
      r += d.circuit === 'office' ? FR.power.OFFICE_DOOR : FR.power.SHUTTER;
    });
    return r;
  }

  tick(dt: number): void {
    if (!this.enabled) return;
    const sim = this.sim;
    if (this.masterCooldown > 0) this.masterCooldown -= dt;
    // Power.
    if (!this.powerOut) {
      this.power -= (this.drainPerHour() * dt) / sim.hourSeconds;
      if (this.power <= 0) this.blackout();
    }
    // Music box.
    const n = Math.max(1, Math.min(6, sim.opts.night));
    const count = Math.max(1, sim.opts.playerCount ?? 1);
    const rate = FR.musicBox.UNWIND[n] * (FR.scaling.MUSIC_BOX[Math.min(4, count)] ?? 1);
    if (this.musicBox > 0) {
      this.musicBox = Math.max(0, this.musicBox - rate * dt);
      for (const w of FR.musicBox.WARN) {
        if (this.musicBox <= w && !this.warned.has(w)) {
          this.warned.add(w);
          sim.emit({ t: 'musicbox', level: w });
        }
      }
      if (this.musicBox <= 0) {
        this.musicFailed = true;
        sim.emit({ t: 'musicEmpty' });
      }
    }
    // Front doors unlock at 5 AM if every required job is done.
    if (!this.frontUnlocked && sim.hour >= FR.objectives.EARLY_EXIT_HOUR && this.requiredDone()) {
      this.frontUnlocked = true;
      sim.emit({ t: 'frontUnlocked' });
    }
  }

  private blackout(): void {
    const sim = this.sim;
    this.power = 0;
    this.powerOut = true;
    sim.power.main = false;
    sim.power.circuits = new Set(['always']);
    // Shutters spring open and jam.
    sim.level.doors.forEach((d, i) => {
      if (d.kind === 'shutter') sim.doorTarget[i] = 1;
    });
    sim.emit({ t: 'powerOut' });
  }

  // ---- Interactions ------------------------------------------------------------------------------

  /** Press interactions on level interactables. Returns true if handled. */
  press(p: FrPlayer, id: string): boolean {
    const sim = this.sim;
    if (id.startsWith('breaker:')) {
      const i = Number(id.slice(8));
      if (!(i >= 0 && i < this.breakers.length)) return true;
      this.breakers[i] = !this.breakers[i];
      sim.emit({ t: 'breaker', index: i, on: this.breakers[i] });
      return true;
    }
    if (id === 'main-breaker') {
      if (sim.power.main) {
        sim.power.main = false;
        sim.emit({ t: 'power', main: false });
        return true;
      }
      if (this.powerOut) {
        sim.emit({ t: 'nopower', pid: p.id, text: 'The lever won’t hold. There’s no power left to give.' });
        return true;
      }
      if (this.masterCooldown > 0) {
        sim.emit({ t: 'master', result: 'cooldown', load: this.loadOn() });
        return true;
      }
      const load = this.loadOn();
      if (load > this.band[1]) {
        this.masterCooldown = FR.power.BREAKER_COOLDOWN;
        sim.emit({ t: 'master', result: 'trip', load });
        sim.noise(22.65, -3.5, 60, FR.noise.BREAKER_TRIP, p.id);
      } else if (load < this.band[0]) {
        sim.emit({ t: 'master', result: 'drop', load });
      } else {
        sim.power.main = true;
        sim.emit({ t: 'master', result: 'on', load });
        sim.emit({ t: 'power', main: true });
      }
      return true;
    }
    if (id.startsWith('fusebox:')) {
      const i = Number(id.slice(8));
      const box = FUSE_BOXES[i];
      if (!box) return true;
      const blown = box.groups.map((g) => BREAKER_GROUPS.findIndex((b) => b.id === g)).filter((g) => this.blown.has(g));
      sim.emit({ t: 'fusebox', pid: p.id, index: i, blown: blown.length, hasFuse: this.has(p, 'fuse') });
      return true;
    }
    if (id.startsWith('plate:')) {
      const i = Number(id.slice(6));
      this.placeCupcake(p, i);
      return true;
    }
    if (id === 'front-doors') {
      if (!this.frontUnlocked) {
        sim.emit({ t: 'locked', pid: p.id, door: -1, text: 'chain' });
        return true;
      }
      sim.exitPlayer(p);
      return true;
    }
    return false;
  }

  /** Zone switches respect breakers and fuses. Returns an error text or null when switched. */
  zoneSwitch(c: CircuitId): string | null {
    if (!this.sim.power.main) return 'Nothing happens. The main breaker is off.';
    const g = groupOf(c);
    if (g >= 0 && !this.breakers[g]) return 'Dead. Its breaker is off at the main panel.';
    if (g >= 0 && this.blown.has(g)) return 'The indicator lamp is dead. Blown fuse.';
    return null;
  }

  /** Held interactions: winding the music box, replacing a fuse. Returns progress 0..1, or -1 if invalid. */
  hold(p: FrPlayer, use: string, dt: number): number {
    const sim = this.sim;
    if (use === 'musicbox:remote') {
      // From CAM 8, on the office monitor or the Faz-Pad, at 40% speed.
      if (p.viewCam !== '8') return -1;
      this.musicBox = Math.min(100, this.musicBox + FR.musicBox.WIND_REMOTE * dt);
      if (this.musicBox > 50) this.warned.clear();
      return this.musicBox / 100;
    }
    if (use === 'musicbox') {
      const mb = sim.level.interactables.find((i) => i.id === 'musicbox');
      if (!mb || Math.hypot(mb.x - p.body.x, mb.z - p.body.z) > 1.9) return -1;
      if (this.musicFailed && this.musicBox <= 0 && !sim.opts.night) return -1;
      this.musicBox = Math.min(100, this.musicBox + FR.musicBox.WIND * dt);
      if (this.musicBox > 50) this.warned.clear();
      this.crankNoiseT -= dt;
      if (this.crankNoiseT <= 0) {
        this.crankNoiseT = 0.6;
        sim.noise(mb.x, mb.y, mb.z, FR.noise.CRANK, p.id);
      }
      return this.musicBox / 100;
    }
    if (use.startsWith('fusebox:')) {
      const i = Number(use.slice(8));
      const box = FUSE_BOXES[i];
      if (!box || Math.hypot(box.x - p.body.x, box.z - p.body.z) > 2.2 || !this.has(p, 'fuse')) return -1;
      const target = box.groups.map((g) => BREAKER_GROUPS.findIndex((b) => b.id === g)).find((g) => this.blown.has(g));
      if (target === undefined) return -1;
      p.useProgress += dt;
      if (p.useProgress >= FR.objectives.FUSE_INSERT) {
        p.useProgress = 0;
        this.consume(p, 'fuse');
        this.blown.delete(target);
        sim.emit({ t: 'fuseFixed', pid: p.id, group: target });
        return 1;
      }
      return p.useProgress / FR.objectives.FUSE_INSERT;
    }
    return -1;
  }

  // ---- Items -------------------------------------------------------------------------------------

  carried(p: FrPlayer): FrItem[] {
    return this.items.filter((i) => i.holder === p.id);
  }

  has(p: FrPlayer, type: ItemType): boolean {
    return this.items.some((i) => i.holder === p.id && i.type === type);
  }

  private consume(p: FrPlayer, type: ItemType): void {
    const it = this.items.find((i) => i.holder === p.id && i.type === type);
    if (!it) return;
    it.holder = null;
    it.y = -1000; // used up
  }

  pickup(p: FrPlayer, id: number): void {
    const it = this.items[id];
    if (!it || it.holder || it.plate >= 0 || it.y < -100) return;
    if (Math.hypot(it.x - p.body.x, it.z - p.body.z) > 2.2 || Math.abs(it.y - (p.body.y + 1)) > 1.8) return;
    if (!this.sim.world.canReach(p.body.x, p.body.y + eyeHeight(p.body), p.body.z, it.x, it.y, it.z)) return;
    if (this.carried(p).length >= MAX_SLOTS) {
      this.sim.emit({ t: 'nopower', pid: p.id, text: 'Your hands are full.' });
      return;
    }
    it.holder = p.id;
    this.sim.emit({ t: 'pickup', pid: p.id, item: id, type: it.type });
  }

  useBattery(p: FrPlayer): void {
    if (!this.has(p, 'battery') || p.battery >= 99) return;
    this.consume(p, 'battery');
    p.battery = Math.min(100, p.battery + FR.flashlight.BATTERY_PACK);
    this.sim.emit({ t: 'battery', pid: p.id });
  }

  drop(p: FrPlayer): void {
    const mine = this.carried(p);
    const it = mine[mine.length - 1];
    if (!it) return;
    it.holder = null;
    it.x = p.body.x;
    it.y = p.body.y + 0.05;
    it.z = p.body.z;
    this.sim.emit({ t: 'drop', pid: p.id, item: it.id });
    this.sim.noise(it.x, it.y, it.z, FR.noise.DROP, p.id);
  }

  dropAll(p: FrPlayer): void {
    let k = 0;
    for (const it of this.carried(p)) {
      it.holder = null;
      it.x = p.body.x + Math.cos(k * 2.1) * 0.35;
      it.y = p.body.y + 0.05;
      it.z = p.body.z + Math.sin(k * 2.1) * 0.35;
      k++;
    }
  }

  private placeCupcake(p: FrPlayer, plate: number): void {
    const sim = this.sim;
    if (!this.plates.includes(plate)) {
      sim.emit({ t: 'nopower', pid: p.id, text: "That's not a birthday table. Look for the star card." });
      return;
    }
    if (this.items.some((i) => i.plate === plate)) return;
    const it = this.items.find((i) => i.holder === p.id && i.type === 'cupcake');
    if (!it) {
      sim.emit({ t: 'nopower', pid: p.id, text: 'An empty birthday plate. It needs a cupcake from the kitchen.' });
      return;
    }
    const t = PLATE_TABLES[plate];
    it.holder = null;
    it.plate = plate;
    it.x = t.x;
    it.y = 0.82;
    it.z = t.z;
    sim.emit({ t: 'cupcake', pid: p.id, plate, placed: this.placed() });
    if (this.placed() === this.plates.length) sim.emit({ t: 'cupcakesDone' });
  }

  placed(): number {
    return this.items.filter((i) => i.plate >= 0).length;
  }

  // ---- Objectives --------------------------------------------------------------------------------

  zonesLit(): CircuitId[] {
    return this.requiredZones.filter((c) => this.sim.circuitOn(c));
  }

  requiredDone(): boolean {
    return this.objectives().every((o) => !o.required || o.done);
  }

  objectives(): Objective[] {
    if (!this.enabled) return [];
    const sim = this.sim;
    const lit = this.zonesLit();
    const names: Record<string, string> = { dining: 'Dining Hall', west: 'West Hall', east: 'East Hall', kitchen: 'Kitchen', stage: 'Show Stage', party: 'Party Rooms', play: 'Play Zone', restroom: 'Restrooms', staff: 'Staff Area', boh: 'Back of House', backstage: 'Backstage', lobby: 'Lobby', cove: 'Pirate Cove' };
    return [
      { id: 'power', text: 'Restore main power (Breaker Room, basement)', done: sim.power.main || this.powerOut, required: true, failed: false },
      {
        id: 'lights',
        text: `Turn on the lights: ${this.requiredZones.map((c) => `${names[c] ?? c}${lit.includes(c) ? ' ✓' : ''}`).join(', ')}`,
        done: lit.length === this.requiredZones.length,
        required: true,
        failed: false,
      },
      { id: 'musicbox', text: 'Keep the music box wound (Prize Corner)', done: !this.musicFailed, required: true, failed: this.musicFailed },
      { id: 'cupcakes', text: `Put a cupcake on every birthday table (${this.placed()}/${this.plates.length})`, done: this.placed() >= this.plates.length, required: true, failed: false },
    ];
  }
}
