import * as THREE from 'three';
import {
  FR,
  FrSim,
  IDLE_CMD,
  eyeHeight,
  type Agent,
  type CircuitId,
  type FrAct,
  type FrCmd,
  type FrDoorDef,
  type FrEvent,
  type FrPlayer,
  type HidingSpotDef,
  type InteractableDef,
  type Stance,
} from '@fnaf/shared';
import { getRenderer } from '../render/renderer';
import { WorldRender, type PowerView } from '../render/world/world';
import { volumetricCone } from '../render/fx/effects';
import { buildCharacter, type CharacterRig } from '../render/characters/build';
import { Jumpscare } from '../render/scenes/jumpscare';
import { audio } from '../audio/engine';
import { store } from '../store';
import { h } from '../ui/dom';

export type FreeRoamMode = 'day' | 'night';

const CIRCUIT_NAMES: Record<string, string> = {
  staff: 'Staff area',
  boh: 'Back of house',
  west: 'West hall',
  east: 'East hall',
  dining: 'Dining Hall',
  lobby: 'Lobby',
  stage: 'Stage',
  cove: 'Pirate Cove',
  party: 'Party rooms',
  play: 'Play zone',
  restroom: 'Restrooms',
  kitchen: 'Kitchen',
  office: 'Security Office',
  backstage: 'Backstage',
  parts: 'Parts & Service',
  manager: "Manager's Office",
  dock: 'Loading Dock',
  basement: 'Basement',
  server: 'Server Room',
  boiler: 'Boiler Room',
};

const LOCKED_TEXT: Record<string, string> = {
  night: "It's locked. Of course it's locked.",
  chain: 'Chained shut from the inside. A sign says: CLOSED, SEE YOU TOMORROW!',
  keycard: 'Locked. It wants a keycard.',
  basement: 'Padlocked. You need the basement key.',
};

const HIDE_VERB: Record<string, string> = {
  locker: 'Hide in the locker',
  under_table: 'Hide under the table',
  closet: 'Hide in the closet',
  stall: 'Hide in the stall',
  cabinet: 'Squeeze in',
  chest: 'Climb into the chest',
  curtain: 'Hide behind the curtain',
  costume_rack: 'Hide among the costumes',
  freezer: 'Hide in the freezer',
  cart: 'Climb into the cart',
  coffin: 'Lie in the coffin',
  stealth_alcove: 'Press into the shadows',
  sheet: 'Crawl under the dust sheet',
  desk: 'Hide under the desk',
};

const ME = 'me';

type Target = { kind: 'door'; door: FrDoorDef } | { kind: 'item'; item: InteractableDef } | { kind: 'hide'; spot: HidingSpotDef } | null;

interface AgentView {
  rig: CharacterRig;
  prev: { x: number; y: number; z: number; yaw: number };
  cur: { x: number; y: number; z: number; yaw: number };
  walkT: number;
}

export class FreeRoam {
  readonly sim: FrSim;
  readonly me: FrPlayer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 140);
  readonly render: WorldRender;
  private power: PowerView;
  private prev = { x: 0, y: 0, z: 0 };
  private keys = new Set<string>();
  private stanceToggle: Stance = 0;
  private jumpQueued = false;
  private actQueued: FrAct | null = null;
  private yaw: number;
  private pitch = 0;
  private acc = 0;
  private bobT = 0;
  private lean = 0;
  private flash!: THREE.SpotLight;
  private flashOn: boolean;
  private beam!: THREE.Mesh;
  private ui!: {
    prompt: HTMLElement;
    room: HTMLElement;
    stamina: HTMLElement;
    hint: HTMLElement;
    clock: HTMLElement;
    map: HTMLCanvasElement;
    root: HTMLElement;
    pause: HTMLElement;
    hideView: HTMLElement;
    breath: HTMLElement;
    downed: HTMLElement;
    card: HTMLElement;
    debug: HTMLElement;
  };
  private target: Target = null;
  private mapOpen = false;
  private lastRoom: string | null = null;
  private time = 0;
  private locked = false;
  private message = '';
  private messageT = 0;
  private cleanup: (() => void)[] = [];
  private agents = new Map<string, AgentView>();
  private statues: CharacterRig[] = [];
  private jumpscare = new Jumpscare();
  private scareT = 0;
  private shake = 0;
  private debugOn = false;
  private ended = false;
  private chaseLoop = false;
  /** Called when the player leaves (Esc menu, end card). */
  onExit: () => void = () => {};
  /** Test and debug access, only wired when explicitly asked for. */
  readonly debug = {
    teleport: (x: number, z: number, y = 0, yaw = this.yaw, pitch = 0) => {
      Object.assign(this.me.body, { x, z, y, vy: 0, grounded: true, vault: 0 });
      this.prev = { x, y, z };
      this.yaw = yaw;
      this.pitch = pitch;
    },
    power: (main: boolean, circuits: string[] = []) => {
      this.sim.power.main = main;
      this.sim.power.circuits = new Set(['always', ...circuits] as CircuitId[]);
    },
    state: () => ({
      x: this.me.body.x,
      y: this.me.body.y,
      z: this.me.body.z,
      stance: this.me.body.stance,
      room: this.lastRoom,
      speed: this.me.body.speed,
      hidden: this.me.hidden?.spot ?? -1,
      downed: this.me.downed,
      ghost: this.me.ghost,
      agents: this.sim.agents.map((a) => ({ id: a.id, state: a.state, x: a.x, z: a.z })),
    }),
    flash: (on: boolean) => (this.flashOn = on),
    hideUi: () => {
      this.ui.pause.style.display = 'none';
    },
    act: (a: FrAct) => (this.actQueued = a),
    agent: (id: string, x: number, z: number, y = 0, yaw = 0) => {
      const a = this.sim.agents.find((q) => q.id === id);
      if (a) Object.assign(a, { x, z, y, yaw });
    },
  };

  constructor(
    readonly mode: FreeRoamMode,
    ui: HTMLElement,
    night = 1,
  ) {
    const seed = (Date.now() & 0xffff) ^ 0x5eed;
    this.sim = new FrSim({ seed, night, mode, playerCount: 1 });
    this.me = this.sim.addPlayer(ME, store.me?.user.displayName ?? 'Guard');
    this.yaw = this.me.body.yaw;
    this.flashOn = mode === 'night';
    const sim = this.sim;
    this.power = {
      lit: (c, kind) => (kind === 'emergency' ? !sim.circuitOn(c) : sim.circuitOn(c)),
    };
    const r = getRenderer();
    this.render = new WorldRender(sim.level, r.quality);
    this.scene.add(this.render.root);
    this.scene.background = new THREE.Color('#020204');
    this.scene.fog = new THREE.FogExp2('#050608', 0.03);
    this.buildFlashlight(r.shadowSize);
    this.buildUi(ui);
    this.bind();
    this.buildStatues();
    void audio
      .init()
      .then(() => {
        audio.startLoop('fr_drone', 'drone');
        audio.startLoop('fr_hum', 'light_hum');
        audio.loopGain('fr_hum', 0);
      })
      .catch(() => {});
    this.prev = { x: this.me.body.x, y: this.me.body.y, z: this.me.body.z };
    // The first sim tick spawns the night's animatronics.
    this.sim.tick();
  }

  private buildFlashlight(shadowSize: number): void {
    const f = new THREE.SpotLight('#fff2d8', 24, FR.flashlight.RANGE * 1.4, THREE.MathUtils.degToRad(FR.flashlight.CONE), 0.5, 1);
    f.castShadow = true;
    f.shadow.mapSize.set(shadowSize, shadowSize);
    f.shadow.camera.near = 0.15;
    f.shadow.bias = -0.0004;
    this.flash = f;
    this.scene.add(f, f.target);
    this.beam = volumetricCone('#fff2d8', 12, 2.6, 0.1);
    this.beam.rotation.x = Math.PI / 2;
    this.beam.renderOrder = 5;
    this.camera.add(this.beam);
    this.scene.add(this.camera);
  }

  /** The animatronics that aren't hunting yet stand on the stage and in the cove. */
  private buildStatues(): void {
    const live = new Set(this.sim.agents.map((a) => a.id));
    const spots: [string, number, number, number, number][] = [
      ['freddy', 58.5, 1.0, 15.5, Math.PI / 2],
      ['bonnie', 58.5, 1.0, 13.5, Math.PI / 2],
      ['chica', 58.5, 1.0, 17.5, Math.PI / 2],
      ['foxy', 8, 0.4, 16, -Math.PI / 2],
    ];
    for (const [id, x, y, z, yaw] of spots) {
      if (live.has(id)) continue;
      const rig = buildCharacter(id, store.roster.mode);
      rig.root.position.set(x, y, z);
      rig.root.rotation.y = yaw + Math.PI;
      this.scene.add(rig.root);
      this.statues.push(rig);
    }
  }

  private buildUi(root: HTMLElement): void {
    const prompt = h('div', { class: 'fr-prompt' });
    const room = h('div', { class: 'fr-room' });
    const stamina = h('div', { class: 'fr-stamina' }, h('div'));
    const hint = h('div', { class: 'fr-hint' });
    const clock = h('div', { class: 'fr-clock' });
    const map = h('canvas', { class: 'fr-map', width: '720', height: '520' });
    map.style.display = 'none';
    const hideView = h('div', { class: 'fr-hideview' });
    const breath = h('div', { class: 'fr-breath' }, h('div'));
    const downed = h('div', { class: 'fr-downed' }, h('div', { class: 'fr-downed-text' }));
    const card = h('div', { class: 'fr-card' });
    const debug = h('pre', { class: 'fr-debug' });
    const pause = h(
      'div',
      { class: 'fr-pause' },
      h('h2', null, this.mode === 'day' ? 'Day Shift' : `Night ${this.sim.opts.night}`),
      h(
        'p',
        null,
        'Click to look around. WASD move, Shift run, C crouch, X crawl, Space jump or vault (hold Space while hidden to hold your breath), E interact or hide, F flashlight, Q and R lean, M map. Esc releases the mouse.',
      ),
      h('button', { class: 'btn', onclick: (e: Event) => (e.stopPropagation(), this.onExit()) }, 'Leave the building'),
    );
    const wrap = h('div', { class: 'fr-hud pass' }, hideView, h('div', { class: 'fr-cross' }), prompt, room, stamina, breath, hint, clock, map, downed, card, debug, pause);
    root.appendChild(wrap);
    this.ui = { prompt, room, stamina, hint, clock, map, root: wrap, pause, hideView, breath, downed, card, debug };
  }

  private bind(): void {
    const canvas = getRenderer().canvas;
    const onClick = () => {
      if (!this.locked && !this.ended) void canvas.requestPointerLock?.();
    };
    const onLock = () => {
      this.locked = document.pointerLockElement === canvas;
      this.ui.pause.style.display = this.locked || this.ended ? 'none' : 'flex';
    };
    const onMove = (e: MouseEvent) => {
      if (!this.locked) return;
      const s = 0.0022;
      this.yaw -= e.movementX * s;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - e.movementY * s));
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Space') {
        this.jumpQueued = true;
        e.preventDefault();
      }
      if (e.code === 'KeyC') this.stanceToggle = this.stanceToggle === 1 ? 0 : 1;
      if (e.code === 'KeyX') this.stanceToggle = this.stanceToggle === 2 ? 0 : 2;
      if (e.code === 'KeyF') {
        this.flashOn = !this.flashOn;
        audio.play('click', { gain: 0.5 });
      }
      if (e.code === 'KeyM') this.toggleMap();
      if (e.code === 'KeyE') this.interact();
      if (e.code === 'F9' && (store.config.testHooks || ['localhost', '127.0.0.1'].includes(location.hostname))) {
        this.debugOn = !this.debugOn;
        this.ui.debug.style.display = this.debugOn ? 'block' : 'none';
      }
      if (this.me.hidden && (e.code === 'KeyA' || e.code === 'KeyD')) {
        const spot = this.sim.spot(this.me.hidden.spot);
        if (spot.exits.length > 1) this.actQueued = { type: 'unhide', exit: e.code === 'KeyA' ? 0 : 1 };
      }
    };
    const onUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    const onBlur = () => this.keys.clear();
    canvas.addEventListener('click', onClick);
    this.ui.pause.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLock);
    document.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    this.cleanup.push(() => {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLock);
      document.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
      if (document.pointerLockElement) document.exitPointerLock();
    });
  }

  dispose(): void {
    audio.stopLoop('fr_drone', 0.4);
    audio.stopLoop('fr_hum', 0.4);
    audio.stopLoop('fr_chase', 0.3);
    for (const c of this.cleanup) c();
    this.ui.root.remove();
  }

  // ---- Frame -------------------------------------------------------------------------------------

  frame(dt: number, t: number): void {
    this.time = t;
    const r = getRenderer();
    const u = r.post.uniforms;
    if (this.scareT > 0) {
      const s = this.jumpscare.update(dt);
      this.scareT -= dt;
      u.flash.value = s.flash;
      u.aberration.value = s.aberration;
      u.redTint.value = 0.2;
      u.darkness.value = 0;
      u.wobble.value = 0;
      this.jumpscare.camera.aspect = window.innerWidth / window.innerHeight;
      this.jumpscare.camera.updateProjectionMatrix();
      r.render(this.jumpscare.scene, this.jumpscare.camera);
      // The world keeps running underneath.
      this.stepSim(dt);
      this.ui.downed.style.display = 'none';
      return;
    }
    this.stepSim(dt);
    const a = this.acc / this.sim.dt;
    const b = this.me.body;
    const px = this.prev.x + (b.x - this.prev.x) * a;
    const py = this.prev.y + (b.y - this.prev.y) * a;
    const pz = this.prev.z + (b.z - this.prev.z) * a;
    this.syncDoors();
    this.placeCamera(px, py, pz, dt);
    this.updateAgents(a, dt);
    this.updateWorld(dt);
    this.updateHud(dt);
    this.shake = Math.max(0, this.shake - dt * 2);
    u.darkness.value = this.me.ghost ? 0.25 : 0;
    u.flash.value = 0;
    u.redTint.value = this.me.downed ? 0.55 : this.chaseLoop ? 0.08 : 0;
    u.wobble.value = this.me.downed ? 0.3 : 0;
    u.aberration.value = 0.0012 + this.shake * 0.01;
    r.render(this.scene, this.camera);
  }

  private stepSim(dt: number): void {
    const step = this.sim.dt;
    this.acc += dt;
    let guard = 0;
    while (this.acc >= step && guard++ < 5) {
      this.prev = { x: this.me.body.x, y: this.me.body.y, z: this.me.body.z };
      for (const v of this.agents.values()) v.prev = { ...v.cur };
      this.sim.setCmd(ME, this.buildCmd());
      const events = this.sim.tick();
      for (const e of events) this.onEvent(e);
      for (const ag of this.sim.agents) {
        const v = this.agentView(ag);
        v.cur = { x: ag.x, y: ag.y, z: ag.z, yaw: ag.yaw };
      }
      this.acc -= step;
    }
    if (guard >= 5) this.acc = 0;
  }

  private buildCmd(): FrCmd {
    const k = this.keys;
    const active = this.locked || Boolean(window.__frAuto);
    const hidden = Boolean(this.me.hidden);
    const cmd: FrCmd = {
      ...IDLE_CMD,
      fwd: active && !hidden ? (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) : 0,
      strafe: active && !hidden ? (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) : 0,
      yaw: this.yaw,
      pitch: this.pitch,
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      stance: (k.has('ControlLeft') ? 1 : this.stanceToggle) as Stance,
      jump: active && !hidden && this.jumpQueued,
      flash: this.flashOn,
      breath: hidden && k.has('Space'),
      act: this.actQueued ?? undefined,
    };
    this.jumpQueued = false;
    this.actQueued = null;
    return cmd;
  }

  private onEvent(e: FrEvent): void {
    const mine = 'pid' in e && e.pid === ME;
    switch (e.t) {
      case 'door': {
        const d = this.sim.level.doors[e.id];
        audio.play(e.open ? 'door_open' : 'door_slam', { gain: this.gainAt(d.axis === 'z' ? (d.from + d.to) / 2 : d.line, d.floorY, d.axis === 'z' ? d.line : (d.from + d.to) / 2) * (d.kind === 'shutter' ? 0.8 : 0.55) });
        break;
      }
      case 'locked':
        if (mine) {
          audio.play('error', { gain: 0.5 });
          this.say(LOCKED_TEXT[e.text] ?? 'Locked.');
        }
        break;
      case 'nopower':
        if (mine) {
          audio.play('error', { gain: 0.4 });
          this.say(e.text);
        }
        break;
      case 'power':
        audio.play(e.main ? 'sparks' : 'door_slam', { gain: 0.8 });
        this.say(e.main ? 'The building hums. Now the zone switches.' : 'Everything dies.');
        break;
      case 'switch':
        audio.play('click', { gain: 0.8 });
        break;
      case 'honk':
        audio.play('honk', { gain: 0.7 });
        break;
      case 'notice':
        if (mine) {
          // Bonnie's tell: a detuned guitar twang.
          audio.play('sting', { gain: 0.55, rate: 0.7 });
          this.shake = 0.6;
        }
        break;
      case 'chase':
        if (mine && !this.chaseLoop) {
          this.chaseLoop = true;
          if (audio.ready) audio.startLoop('fr_chase', 'breath_loop');
        }
        break;
      case 'lost':
      case 'state':
        if (e.t === 'state' && e.from === 'CHASE' && this.chaseLoop) {
          this.chaseLoop = false;
          audio.stopLoop('fr_chase', 1.2);
        }
        break;
      case 'checkWarn':
        if (this.me.hidden && this.me.hidden.spot === e.spot) {
          audio.play('knock', { gain: 0.9 });
          this.shake = 1;
          this.ui.hideView.classList.add('warn');
          setTimeout(() => this.ui.hideView.classList.remove('warn'), 900);
        }
        break;
      case 'catch':
        if (mine) {
          this.scareT = this.jumpscare.start(e.agent, 'standard') + 0.15;
          audio.play(`scream_${e.agent}`, { gain: store.settings.reducedJumpscares ? 0.4 : 1 });
          if (this.chaseLoop) {
            this.chaseLoop = false;
            audio.stopLoop('fr_chase', 0.2);
          }
        }
        break;
      case 'revived':
        if (mine) this.say('You drag yourself up. Shaking.');
        break;
      case 'ghost':
        if (mine) this.say('You are out for the night.');
        break;
      case 'gasp':
        if (mine) audio.play('breathing', { gain: 0.8 });
        break;
      case 'hour':
        if (e.hour > 0 && e.hour < 6) audio.play('chime6', { gain: 0.25, rate: 1.6 });
        break;
      case 'end':
        this.endCard(e.won);
        break;
      default:
        break;
    }
  }

  private gainAt(x: number, y: number, z: number): number {
    const d = Math.hypot(x - this.me.body.x, y - this.me.body.y, z - this.me.body.z);
    return Math.max(0, 1 - d / 30);
  }

  private agentView(ag: Agent): AgentView {
    let v = this.agents.get(ag.id);
    if (!v) {
      const rig = buildCharacter(ag.id, store.roster.mode);
      this.scene.add(rig.root);
      const p = { x: ag.x, y: ag.y, z: ag.z, yaw: ag.yaw };
      v = { rig, prev: { ...p }, cur: { ...p }, walkT: 0 };
      this.agents.set(ag.id, v);
    }
    return v;
  }

  private updateAgents(alpha: number, dt: number): void {
    for (const ag of this.sim.agents) {
      const v = this.agentView(ag);
      const x = v.prev.x + (v.cur.x - v.prev.x) * alpha;
      const y = v.prev.y + (v.cur.y - v.prev.y) * alpha;
      const z = v.prev.z + (v.cur.z - v.prev.z) * alpha;
      let dy = v.cur.yaw - v.prev.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      const yaw = v.prev.yaw + dy * alpha;
      const rig = v.rig;
      const moving = ag.speed > 0.2;
      v.walkT += dt * ag.speed * 2.6;
      // Stiff mechanical gait: a heavy bob and swinging arms.
      rig.root.position.set(x, y + (moving ? Math.abs(Math.sin(v.walkT)) * 0.06 : 0), z);
      rig.root.rotation.y = yaw + Math.PI;
      rig.root.rotation.z = moving ? Math.sin(v.walkT) * 0.035 : 0;
      if (moving) {
        rig.armL.rotation.x = Math.sin(v.walkT) * 0.5;
        rig.armR.rotation.x = -Math.sin(v.walkT) * 0.5;
      } else if (ag.anim === 'check' || ag.anim === 'open') {
        rig.armL.rotation.x = -1.2;
        rig.armR.rotation.x = -1.2;
      } else {
        rig.armL.rotation.x *= 0.9;
        rig.armR.rotation.x *= 0.9;
      }
      // Eyes glow brighter while hunting.
      const hunting = ag.state === 'CHASE';
      for (const e of rig.eyes) {
        const m = e.material as THREE.MeshStandardMaterial;
        if (m.emissiveIntensity !== undefined) m.emissiveIntensity = hunting ? 4 : 1.2;
      }
      rig.tick(this.time);
      // Footsteps: heavy, audible through walls within 25 m.
      if (moving && Math.floor(v.walkT / Math.PI) !== Math.floor((v.walkT - dt * ag.speed * 2.6) / Math.PI)) {
        const g = this.gainAt(x, y, z);
        const walls = this.sim.world.countBetween(x, y + 1, z, this.camera.position.x, this.camera.position.y, this.camera.position.z);
        if (g > 0.02) audio.play('step_heavy', { gain: g * 0.9 * Math.pow(0.55, walls.walls + walls.doors), rate: 0.9 + Math.random() * 0.15 });
      }
    }
    for (const s of this.statues) s.tick(this.time);
  }

  private placeCamera(x: number, y: number, z: number, dt: number): void {
    const b = this.me.body;
    let eye = eyeHeight(b);
    let cx = x;
    let cy = y;
    let cz = z;
    const hid = this.me.hidden;
    if (hid) {
      const spot = this.sim.spot(hid.spot);
      const k = hid.phase === 'enter' ? 1 - Math.max(0, hid.t / spot.enterTime) : hid.phase === 'exit' ? Math.max(0, hid.t / 0.5) : 1;
      cx = x + (spot.x - x) * k;
      cz = z + (spot.z - z) * k;
      cy = y + (spot.y - y - eye) * k;
      // Look around only within the spot's arc.
      let d = this.yaw - spot.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw = spot.yaw + Math.max(-1.0, Math.min(1.0, d));
      this.pitch = Math.max(-0.6, Math.min(0.6, this.pitch));
    }
    if (this.me.downed) eye = 0.35;
    if (b.speed > 0.3 && b.grounded) this.bobT += dt * b.speed * 2.2;
    const bob = store.settings.reducedMotion ? 0 : Math.sin(this.bobT) * 0.018 * Math.min(1, b.speed / 3);
    const wantLean = hid ? 0 : (this.keys.has('KeyR') ? 1 : 0) - (this.keys.has('KeyQ') ? 1 : 0);
    let limit: number = FR.player.LEAN;
    if (wantLean !== 0) {
      const rx = Math.cos(this.yaw) * wantLean;
      const rz = -Math.sin(this.yaw) * wantLean;
      const hit = this.sim.world.raycast(cx, cy + eye, cz, rx, 0, rz, FR.player.LEAN + 0.25);
      limit = Math.max(0, Math.min(FR.player.LEAN, hit - 0.25));
    }
    this.lean += (wantLean * limit - this.lean) * Math.min(1, dt * 10);
    const lx = Math.cos(this.yaw) * this.lean;
    const lz = -Math.sin(this.yaw) * this.lean;
    const sh = store.settings.reducedMotion ? 0 : this.shake * 0.02;
    this.camera.position.set(cx + lx + (Math.random() - 0.5) * sh, cy + eye + bob + (Math.random() - 0.5) * sh, cz + lz);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, -this.lean * 0.45 + (this.me.downed ? 0.35 : 0));
    const fov = store.settings.fov === 'wide' ? 85 : store.settings.fov === 'narrow' ? 65 : 75;
    const aspect = window.innerWidth / window.innerHeight;
    if (this.camera.fov !== fov || this.camera.aspect !== aspect) {
      this.camera.fov = fov;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(this.camera.rotation);
    this.flash.position.copy(this.camera.position).addScaledVector(right, 0.12).addScaledVector(dir, 0.1);
    this.flash.position.y -= 0.1;
    this.flash.target.position.copy(this.camera.position).addScaledVector(dir, 10);
    const on = this.me.flashOn && this.me.battery > 0 && !hid;
    this.flash.visible = on;
    this.beam.visible = on;
    const low = this.me.battery < 20 ? 0.5 + Math.random() * 0.5 : 1;
    this.flash.intensity = 24 * low * (1 - 0.85 * Math.min(1, this.render.ambient.intensity / 0.4));
    this.beam.position.set(0.12, -0.1, -0.1);
    this.camera.updateMatrixWorld(true);
  }

  private syncDoors(): void {
    for (const [id, v] of this.render.doors) {
      const open = this.sim.world.doorOpen[id];
      if (Math.abs(open - v.open) > 1e-4) this.render.poseDoor(v, open);
    }
  }

  private updateWorld(dt: number): void {
    const cam = this.camera.position;
    const b = this.me.body;
    const room = this.render.roomAt(b.x, b.y + 0.5, b.z);
    if (room !== this.lastRoom) {
      this.lastRoom = room;
      this.render.cull(room, 2);
    }
    this.render.update(dt, this.power, cam, room);
    // Rigs outside the visible rooms are hidden too.
    for (const v of this.agents.values()) {
      const r = this.render.roomAt(v.cur.x, v.cur.y + 0.5, v.cur.z);
      v.rig.root.visible = !r || (this.render.roomGroups.get(r)?.visible ?? true);
    }
    const sc = this.scene.fog as THREE.FogExp2;
    const lit = this.render.ambient.intensity > 0.2;
    if (audio.ready) {
      audio.loopGain('fr_hum', lit ? 0.5 : 0, 0.6);
      audio.loopGain('fr_drone', lit ? 0.15 : 0.5, 0.8);
    }
    sc.density += ((lit ? 0.008 : 0.028) - sc.density) * Math.min(1, dt * 2);
    if (this.beam.material instanceof THREE.ShaderMaterial) {
      this.beam.material.uniforms.time.value = this.time;
      this.beam.material.uniforms.intensity.value = lit ? 0.05 : 0.12;
    }
  }

  // ---- Interaction -------------------------------------------------------------------------------

  private findTarget(): Target {
    if (this.me.hidden || this.me.downed || this.me.ghost) return null;
    const cam = this.camera.position;
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    let best: Target = null;
    let bestScore = 0.82;
    const reach = FR.player.INTERACT_RANGE;
    const consider = (x: number, y: number, z: number, extra: number, make: () => Target, needLos = true): void => {
      const dx = x - cam.x;
      const dy = y - cam.y;
      const dz = z - cam.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > reach + extra || d < 1e-3) return;
      const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
      if (dot < bestScore) return;
      if (needLos) {
        const hit = this.sim.world.raycast(cam.x, cam.y, cam.z, dx / d, dy / d, dz / d, d);
        if (hit < d - 0.45) return;
      }
      best = make();
      bestScore = dot;
    };
    for (const item of this.sim.level.interactables) consider(item.x, item.y, item.z, 0.6, () => ({ kind: 'item', item }));
    for (const spot of this.sim.level.hidingSpots) {
      const fy = this.sim.level.roomById[spot.room].floorY;
      if (Math.abs(fy - this.me.body.y) > 1.2) continue;
      consider(spot.x, Math.min(spot.y, fy + 1.0), spot.z, 0.6, () => ({ kind: 'hide', spot }), false);
    }
    for (const door of this.sim.level.doors) {
      if (Math.abs(door.floorY - this.me.body.y) > 1) continue;
      if (door.kind === 'curtain') continue;
      const along = door.axis === 'z' ? cam.x : cam.z;
      const across = door.axis === 'z' ? Math.abs(cam.z - door.line) : Math.abs(cam.x - door.line);
      if (across > reach || along < door.from - 0.8 || along > door.to + 0.8) continue;
      const mx = door.axis === 'z' ? (door.from + door.to) / 2 : door.line;
      const mz = door.axis === 'z' ? door.line : (door.from + door.to) / 2;
      bestScore -= 0.1;
      consider(mx, door.floorY + door.height * 0.55, mz, (door.to - door.from) / 2, () => ({ kind: 'door', door }), false);
      bestScore += 0.1;
    }
    return best;
  }

  private promptFor(t: NonNullable<Target>): string {
    if (t.kind === 'door') {
      const open = this.sim.doorTarget[t.door.id] > 0.5;
      if (t.door.locked) return `[E] ${t.door.name} (locked)`;
      if (t.door.kind === 'shutter') return `[E] ${open ? 'Close' : 'Open'} ${t.door.name}`;
      return `[E] ${open ? 'Close' : 'Open'} ${t.door.name.toLowerCase()}`;
    }
    if (t.kind === 'hide') {
      const full = this.sim.spotOccupants(t.spot.id).length >= t.spot.capacity;
      return full ? 'Someone is already in there' : `[E] ${HIDE_VERB[t.spot.type] ?? 'Hide'}`;
    }
    const i = t.item;
    if (i.type === 'mainBreaker') return `[E] ${this.sim.power.main ? 'Pull' : 'Throw'} the main breaker`;
    if (i.type === 'zoneSwitch') return `[E] ${CIRCUIT_NAMES[i.circuit ?? ''] ?? i.label} lights ${this.sim.power.circuits.has(i.circuit as CircuitId) ? 'OFF' : 'ON'}`;
    if (i.type === 'honk') return '[E] Honk';
    return `[E] ${i.label}`;
  }

  private say(text: string): void {
    this.message = text;
    this.messageT = 3.2;
  }

  interact(): void {
    if (this.me.hidden) {
      this.actQueued = { type: 'unhide', exit: 0 };
      return;
    }
    const t = this.target;
    if (!t) return;
    if (t.kind === 'door') this.actQueued = { type: 'door', id: t.door.id };
    else if (t.kind === 'hide') this.actQueued = { type: 'hide', id: t.spot.id };
    else this.actQueued = { type: 'item', id: t.item.id };
  }

  // ---- HUD ---------------------------------------------------------------------------------------

  private updateHud(dt: number): void {
    this.target = this.findTarget();
    if (this.messageT > 0) this.messageT -= dt;
    const hid = this.me.hidden;
    let prompt = this.messageT > 0 ? this.message : this.target ? this.promptFor(this.target) : '';
    if (!prompt && hid && hid.phase === 'in') {
      const spot = this.sim.spot(hid.spot);
      prompt = spot.exits.length > 1 ? '[E] Get out   [A]/[D] pick a side   [Space] hold breath' : '[E] Get out   [Space] hold breath';
    }
    this.ui.prompt.textContent = prompt;
    this.ui.prompt.classList.toggle('on', Boolean(prompt));
    const room = this.lastRoom ? this.sim.level.roomById[this.lastRoom] : null;
    this.ui.room.textContent = room ? room.name : '';
    const bar = this.ui.stamina.firstElementChild as HTMLElement;
    bar.style.width = `${this.me.body.stamina}%`;
    this.ui.stamina.style.opacity = this.me.body.stamina < 99 ? '1' : '0';
    // Hiding overlays.
    const hv = this.ui.hideView;
    const spotType = hid ? this.sim.spot(hid.spot).type : '';
    hv.className = `fr-hideview ${hid && hid.phase !== 'exit' ? `on ${spotType}` : ''}${hv.classList.contains('warn') ? ' warn' : ''}`;
    const breathBar = this.ui.breath.firstElementChild as HTMLElement;
    breathBar.style.width = `${(this.me.breath / FR.player.BREATH_HOLD) * 100}%`;
    this.ui.breath.style.opacity = hid && this.me.breath < FR.player.BREATH_HOLD - 0.05 ? '1' : '0';
    // Downed.
    this.ui.downed.style.display = this.me.downed && this.scareT <= 0 ? 'flex' : 'none';
    if (this.me.downed) (this.ui.downed.firstElementChild as HTMLElement).textContent = `DOWN  ${Math.ceil(this.me.bleed)}`;
    if (this.mode === 'night') {
      const hour = this.sim.hour;
      this.ui.clock.textContent = `${hour === 0 ? 12 : hour} AM`;
      this.ui.hint.textContent = this.sim.power.main ? '' : 'The power is out. The breaker room is in the basement.';
    } else {
      this.ui.clock.textContent = '';
      this.ui.hint.textContent = '';
    }
    if (this.mapOpen) this.drawMap();
    if (this.debugOn) {
      const lines = this.sim.agents.map((a) => {
        const d = Object.entries(a.detect)
          .map(([k, v]) => `${k}:${v.toFixed(2)}`)
          .join(' ');
        return `[${a.id}] ${a.state} aggr ${a.aggression.toFixed(1)} pos ${a.x.toFixed(1)},${a.z.toFixed(1)} detect ${d} unseen ${a.unseenT.toFixed(0)}s\n  ${a.log.slice(-5).join('\n  ')}`;
      });
      this.ui.debug.textContent = `t ${this.sim.time.toFixed(1)}  me ${this.me.body.x.toFixed(1)},${this.me.body.z.toFixed(1)}  noise ${this.me.noise}\n${lines.join('\n')}`;
    }
  }

  private endCard(won: boolean): void {
    this.ended = true;
    if (document.pointerLockElement) document.exitPointerLock();
    audio.stopLoop('fr_chase', 0.3);
    if (won) {
      audio.play('chime6', { gain: 0.8 });
      setTimeout(() => audio.play('cheer', { gain: 0.6 }), 1500);
    }
    const c = this.ui.card;
    c.textContent = '';
    c.append(
      h('h1', { class: 'title' }, won ? '6 AM' : 'GAME OVER'),
      h('p', null, won ? 'You made it through the night.' : 'The night is over. They found you.'),
      h('button', { class: 'btn primary', onclick: () => this.onExit() }, 'Back to the title'),
    );
    c.style.display = 'flex';
  }

  private toggleMap(): void {
    this.mapOpen = !this.mapOpen;
    this.ui.map.style.display = this.mapOpen ? 'block' : 'none';
  }

  private drawMap(): void {
    const c = this.ui.map;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const lv = this.sim.level;
    const below = this.me.body.y < -2;
    const s = Math.min(c.width / (lv.bounds.x2 + 4), c.height / (lv.bounds.z2 + 4));
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#3a2a1a';
    ctx.fillStyle = '#d8c8a0';
    ctx.lineWidth = 1.5;
    ctx.font = '11px Courier Prime, monospace';
    for (const r of lv.rooms.filter((q) => q.floorY < -2 === below)) {
      for (const [x1, z1, x2, z2] of r.rects) {
        ctx.fillRect(2 * s + x1 * s, 2 * s + z1 * s, (x2 - x1) * s, (z2 - z1) * s);
        ctx.strokeRect(2 * s + x1 * s, 2 * s + z1 * s, (x2 - x1) * s, (z2 - z1) * s);
      }
      const [x1, z1, x2, z2] = r.rects[0];
      ctx.fillStyle = '#3a2a1a';
      ctx.fillText(r.name, 2 * s + ((x1 + x2) / 2) * s - r.name.length * 2.6, 2 * s + ((z1 + z2) / 2) * s);
      ctx.fillStyle = '#d8c8a0';
    }
    const px = 2 * s + this.me.body.x * s;
    const pz = 2 * s + this.me.body.z * s;
    ctx.fillStyle = '#c41e1e';
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-this.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#3a2a1a';
    ctx.fillText(below ? 'BASEMENT' : 'GROUND FLOOR', 8, 14);
  }
}

declare global {
  interface Window {
    __frAuto?: boolean;
    __fr?: FreeRoam;
  }
}
