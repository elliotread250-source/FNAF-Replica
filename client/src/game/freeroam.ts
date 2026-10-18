import * as THREE from 'three';
import {
  CollisionWorld,
  FR,
  eyeHeight,
  forward,
  getLevel,
  newBody,
  stepBody,
  type Body,
  type CircuitId,
  type FrDoorDef,
  type FrInput,
  type InteractableDef,
  type Stance,
} from '@fnaf/shared';
import { getRenderer } from '../render/renderer';
import { WorldRender, type PowerView } from '../render/world/world';
import { volumetricCone } from '../render/fx/effects';
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

interface DoorState {
  open: number;
  target: number;
}

/** Local power model for the walkable building (the server-owned version arrives with multiplayer). */
class Power implements PowerView {
  main = false;
  circuits = new Set<CircuitId>(['always']);
  constructor(day: boolean) {
    if (day) {
      this.main = true;
      for (const c of Object.keys(CIRCUIT_NAMES)) this.circuits.add(c as CircuitId);
      this.circuits.add('breaker');
    }
  }
  on(c: CircuitId): boolean {
    if (c === 'always') return true;
    if (c === 'breaker') return this.main;
    return this.main && this.circuits.has(c);
  }
  lit(c: CircuitId, kind: string): boolean {
    return kind === 'emergency' ? !this.on(c) : this.on(c);
  }
}

export class FreeRoam {
  readonly level = getLevel();
  readonly world = new CollisionWorld(this.level);
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 140);
  readonly render: WorldRender;
  readonly power: Power;
  readonly body: Body;
  private prev = { x: 0, y: 0, z: 0 };
  private doorState = new Map<number, DoorState>();
  private keys = new Set<string>();
  private stanceToggle: Stance = 0;
  private jumpQueued = false;
  private yaw: number;
  private pitch = 0;
  private acc = 0;
  private bobT = 0;
  private lean = 0;
  private flash!: THREE.SpotLight;
  private flashOn = true;
  private beam!: THREE.Mesh;
  private ui: { prompt: HTMLElement; room: HTMLElement; stamina: HTMLElement; hint: HTMLElement; map: HTMLCanvasElement; root: HTMLElement; pause: HTMLElement };
  private target: { kind: 'door'; door: FrDoorDef } | { kind: 'item'; item: InteractableDef } | null = null;
  private mapOpen = false;
  private lastRoom: string | null = null;
  private time = 0;
  private locked = false;
  private rattle = 0;
  private message = '';
  private messageT = 0;
  private cleanup: (() => void)[] = [];
  /** Test and debug access, only wired when explicitly asked for. */
  readonly debug = {
    teleport: (x: number, z: number, y = 0, yaw = this.yaw, pitch = 0) => {
      this.teleport(x, z, y, yaw);
      this.pitch = pitch;
    },
    power: (main: boolean, circuits: string[] = []) => {
      this.power.main = main;
      this.power.circuits = new Set(['always', ...circuits] as CircuitId[]);
    },
    state: () => ({ x: this.body.x, y: this.body.y, z: this.body.z, stance: this.body.stance, room: this.lastRoom, speed: this.body.speed }),
    flash: (on: boolean) => (this.flashOn = on),
    hideUi: () => {
      this.ui.pause.style.display = 'none';
    },
  };

  constructor(readonly mode: FreeRoamMode, ui: HTMLElement) {
    const spawn = this.level.spawns[0];
    this.body = newBody(spawn.x, spawn.z, spawn.y, spawn.yaw);
    this.yaw = spawn.yaw;
    this.power = new Power(mode === 'day');
    const r = getRenderer();
    this.render = new WorldRender(this.level, r.quality);
    this.scene.add(this.render.root);
    this.scene.background = new THREE.Color('#020204');
    this.scene.fog = new THREE.FogExp2('#050608', 0.03);
    for (const d of this.level.doors) {
      const open = d.startsOpen ? 1 : 0;
      this.doorState.set(d.id, { open, target: open });
    }
    this.buildFlashlight(r.shadowSize);
    this.ui = this.buildUi(ui);
    this.bind();
    void audio.init().then(() => {
      audio.startLoop('fr_drone', 'drone');
      audio.startLoop('fr_hum', 'light_hum');
      audio.loopGain('fr_hum', 0);
    }).catch(() => {});
    this.prev = { x: this.body.x, y: this.body.y, z: this.body.z };
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

  private buildUi(root: HTMLElement) {
    const prompt = h('div', { class: 'fr-prompt' });
    const room = h('div', { class: 'fr-room' });
    const stamina = h('div', { class: 'fr-stamina' }, h('div'));
    const hint = h('div', { class: 'fr-hint' });
    const map = h('canvas', { class: 'fr-map', width: '720', height: '520' });
    map.style.display = 'none';
    const pause = h(
      'div',
      { class: 'fr-pause' },
      h('h2', null, this.mode === 'day' ? 'Day Shift' : 'Night Shift'),
      h('p', null, 'Click to look around. WASD move, Shift run, C crouch, X crawl, Space jump or vault, E interact, F flashlight, Q and R lean, M map, Esc releases the mouse.'),
    );
    const wrap = h('div', { class: 'fr-hud pass' }, h('div', { class: 'fr-cross' }), prompt, room, stamina, hint, map, pause);
    root.appendChild(wrap);
    return { prompt, room, stamina, hint, map, root: wrap, pause };
  }

  private bind(): void {
    const canvas = getRenderer().canvas;
    const onClick = () => {
      if (!this.locked) void canvas.requestPointerLock?.();
    };
    const onLock = () => {
      this.locked = document.pointerLockElement === canvas;
      this.ui.pause.style.display = this.locked ? 'none' : 'flex';
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
    for (const c of this.cleanup) c();
    this.ui.root.remove();
  }

  teleport(x: number, z: number, y = 0, yaw = this.yaw): void {
    Object.assign(this.body, { x, z, y, vy: 0, grounded: true, vault: 0 });
    this.prev = { x, y, z };
    this.yaw = yaw;
  }

  // ---- Frame -------------------------------------------------------------------------------------

  frame(dt: number, t: number): void {
    this.time = t;
    const step = 1 / FR.TICK_HZ;
    this.acc += dt;
    let guard = 0;
    while (this.acc >= step && guard++ < 5) {
      this.prev = { x: this.body.x, y: this.body.y, z: this.body.z };
      this.tick(step);
      this.acc -= step;
    }
    const a = this.acc / step;
    const px = this.prev.x + (this.body.x - this.prev.x) * a;
    const py = this.prev.y + (this.body.y - this.prev.y) * a;
    const pz = this.prev.z + (this.body.z - this.prev.z) * a;
    this.updateDoors(dt);
    this.placeCamera(px, py, pz, dt);
    this.updateWorld(dt);
    this.updateHud();
    const r = getRenderer();
    const u = r.post.uniforms;
    u.darkness.value = 0;
    u.flash.value = 0;
    u.redTint.value = 0;
    u.wobble.value = 0;
    u.aberration.value = 0.0012;
    r.render(this.scene, this.camera);
  }

  private tick(dt: number): void {
    const k = this.keys;
    const inp: FrInput = {
      fwd: (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0),
      strafe: (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0),
      yaw: this.yaw,
      pitch: this.pitch,
      sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      stance: (k.has('ControlLeft') ? 1 : this.stanceToggle) as Stance,
      jump: this.jumpQueued,
    };
    this.jumpQueued = false;
    if (!this.locked && !window.__frAuto) {
      inp.fwd = 0;
      inp.strafe = 0;
      inp.jump = false;
    }
    const ev = stepBody(this.body, inp, dt, this.world);
    for (const e of ev) {
      if (e.type === 'step') audio.play('step_light', { gain: e.radius > 10 ? 0.5 : e.radius > 3 ? 0.28 : 0.12, rate: 0.9 + Math.random() * 0.2 });
      else if (e.type === 'land') audio.play('step_heavy', { gain: 0.4 });
      else if (e.type === 'vault') audio.play('whoosh', { gain: 0.3 });
    }
    if (this.body.stance !== this.stanceToggle && !k.has('ControlLeft')) this.stanceToggle = this.body.stance;
  }

  private placeCamera(x: number, y: number, z: number, dt: number): void {
    const b = this.body;
    const eye = eyeHeight(b);
    if (b.speed > 0.3 && b.grounded) this.bobT += dt * b.speed * 2.2;
    const bob = store.settings.reducedMotion ? 0 : Math.sin(this.bobT) * 0.018 * Math.min(1, b.speed / 3);
    // Lean: Q left, R right. The camera slides sideways and rolls, stopping short of walls.
    const wantLean = (this.keys.has('KeyR') ? 1 : 0) - (this.keys.has('KeyQ') ? 1 : 0);
    let limit: number = FR.player.LEAN;
    if (wantLean !== 0) {
      const rx = Math.cos(this.yaw) * wantLean;
      const rz = -Math.sin(this.yaw) * wantLean;
      const hit = this.world.raycast(x, y + eye, z, rx, 0, rz, FR.player.LEAN + 0.25);
      limit = Math.max(0, Math.min(FR.player.LEAN, hit - 0.25));
    }
    this.lean += (wantLean * limit - this.lean) * Math.min(1, dt * 10);
    const lx = Math.cos(this.yaw) * this.lean;
    const lz = -Math.sin(this.yaw) * this.lean;
    this.camera.position.set(x + lx, y + eye + bob, z + lz);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.set(this.pitch, this.yaw, -this.lean * 0.45);
    const fov = store.settings.fov === 'wide' ? 85 : store.settings.fov === 'narrow' ? 65 : 75;
    const aspect = window.innerWidth / window.innerHeight;
    if (this.camera.fov !== fov || this.camera.aspect !== aspect) {
      this.camera.fov = fov;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    // Flashlight rides slightly off-axis, like a hand-held torch.
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    const right = new THREE.Vector3(1, 0, 0).applyEuler(this.camera.rotation);
    this.flash.position.copy(this.camera.position).addScaledVector(right, 0.12).addScaledVector(dir, 0.1);
    this.flash.position.y -= 0.1;
    this.flash.target.position.copy(this.camera.position).addScaledVector(dir, 10);
    this.flash.visible = this.flashOn;
    this.flash.intensity = 24 * (1 - 0.85 * Math.min(1, this.render.ambient.intensity / 0.4));
    this.beam.visible = this.flashOn;
    this.beam.position.set(0.12, -0.1, -0.1);
    this.camera.updateMatrixWorld(true);
  }

  private updateWorld(dt: number): void {
    const cam = this.camera.position;
    const room = this.render.roomAt(this.body.x, this.body.y + 0.5, this.body.z);
    if (room !== this.lastRoom) {
      this.lastRoom = room;
      this.render.cull(room, 2);
    }
    this.render.update(dt, this.power, cam, room);
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

  private updateDoors(dt: number): void {
    for (const [id, st] of this.doorState) {
      if (st.open === st.target) continue;
      const d = this.level.doors[id];
      const rate = d.kind === 'shutter' ? (st.target > st.open ? 1 / 1.5 : 1 / 1.2) : d.kind === 'roller' ? 0.5 : 2.4;
      st.open += Math.sign(st.target - st.open) * Math.min(Math.abs(st.target - st.open), rate * dt);
      this.world.doorOpen[id] = st.open;
      const v = this.render.doors.get(id);
      if (v) this.render.poseDoor(v, st.open);
    }
  }

  // ---- Interaction -------------------------------------------------------------------------------

  private findTarget(): typeof this.target {
    const cam = this.camera.position;
    const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
    let best: typeof this.target = null;
    let bestScore = 0.82;
    const reach = FR.player.INTERACT_RANGE;
    for (const item of this.level.interactables) {
      const dx = item.x - cam.x;
      const dy = item.y - cam.y;
      const dz = item.z - cam.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > reach + 0.6) continue;
      const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
      if (dot < bestScore) continue;
      if (!this.world.clearLine(cam.x, cam.y, cam.z, item.x, item.y, item.z)) {
        // The plate sits on a wall face; allow a hit within 0.3 m of the target.
        const hit = this.world.raycast(cam.x, cam.y, cam.z, dx / d, dy / d, dz / d, d);
        if (hit < d - 0.3) continue;
      }
      best = { kind: 'item', item };
      bestScore = dot;
    }
    for (const door of this.level.doors) {
      if (door.floorY > this.body.y + 1 || door.floorY < this.body.y - 1) continue;
      if (door.kind === 'curtain') continue;
      const mx = door.axis === 'z' ? (door.from + door.to) / 2 : door.line;
      const mz = door.axis === 'z' ? door.line : (door.from + door.to) / 2;
      const dx = mx - cam.x;
      const dy = door.floorY + door.height * 0.55 - cam.y;
      const dz = mz - cam.z;
      const d = Math.hypot(dx, dy, dz);
      if (d > reach + (door.to - door.from) / 2) continue;
      const dot = (dx * dir.x + dy * dir.y + dz * dir.z) / d;
      if (dot < bestScore - 0.1) continue;
      // Is the player standing near the doorway, not behind a wall?
      const along = door.axis === 'z' ? cam.x : cam.z;
      const across = door.axis === 'z' ? Math.abs(cam.z - door.line) : Math.abs(cam.x - door.line);
      if (across > reach || along < door.from - 0.8 || along > door.to + 0.8) continue;
      if (dot > bestScore - 0.1) {
        best = { kind: 'door', door };
        bestScore = Math.max(bestScore, dot - 0.1);
      }
    }
    return best;
  }

  private promptFor(t: NonNullable<typeof this.target>): string {
    if (t.kind === 'door') {
      const st = this.doorState.get(t.door.id) as DoorState;
      if (t.door.locked) return `[E] ${t.door.name} (locked)`;
      if (t.door.kind === 'shutter') return `[E] ${st.target ? 'Close' : 'Open'} ${t.door.name}`;
      return `[E] ${st.target ? 'Close' : 'Open'} ${t.door.name.toLowerCase()}`;
    }
    const i = t.item;
    if (i.type === 'mainBreaker') return `[E] ${this.power.main ? 'Pull' : 'Throw'} the main breaker`;
    if (i.type === 'zoneSwitch') return `[E] ${CIRCUIT_NAMES[i.circuit ?? ''] ?? i.label} lights ${this.power.circuits.has(i.circuit as CircuitId) ? 'OFF' : 'ON'}`;
    if (i.type === 'honk') return '[E] Honk';
    return `[E] ${i.label}`;
  }

  private say(text: string): void {
    this.message = text;
    this.messageT = 3.2;
  }

  interact(): void {
    const t = this.target;
    if (!t) return;
    if (t.kind === 'door') {
      const d = t.door;
      if (d.locked) {
        audio.play('error', { gain: 0.5 });
        this.say(LOCKED_TEXT[d.locked] ?? 'Locked.');
        return;
      }
      if (d.kind === 'shutter' && d.circuit && !this.power.on(d.circuit)) {
        audio.play('error', { gain: 0.4 });
        this.say('No power. The shutter motor is dead.');
        return;
      }
      const st = this.doorState.get(d.id) as DoorState;
      // A shutter will not close on someone standing under it.
      if (d.kind === 'shutter' && st.target === 1 && this.playerInDoorway(d)) {
        this.say('Something is in the way.');
        return;
      }
      st.target = st.target ? 0 : 1;
      audio.play(st.target ? 'door_open' : 'door_slam', { gain: d.kind === 'shutter' ? 0.8 : 0.5 });
      return;
    }
    const i = t.item;
    if (i.type === 'mainBreaker') {
      this.power.main = !this.power.main;
      audio.play(this.power.main ? 'sparks' : 'door_slam', { gain: 0.8 });
      this.say(this.power.main ? 'The building hums. Now the zone switches.' : 'Everything dies.');
    } else if (i.type === 'zoneSwitch') {
      const c = i.circuit as CircuitId;
      if (!this.power.main) {
        audio.play('error', { gain: 0.4 });
        this.say('Nothing happens. The main breaker is off.');
        return;
      }
      if (this.power.circuits.has(c)) this.power.circuits.delete(c);
      else this.power.circuits.add(c);
      audio.play('click', { gain: 0.8 });
    } else if (i.type === 'honk') audio.play('honk', { gain: 0.7 });
  }

  private playerInDoorway(d: FrDoorDef): boolean {
    const b = this.body;
    const along = d.axis === 'z' ? b.x : b.z;
    const across = d.axis === 'z' ? b.z : b.x;
    return along > d.from - 0.4 && along < d.to + 0.4 && Math.abs(across - d.line) < 0.7;
  }

  // ---- HUD ---------------------------------------------------------------------------------------

  private updateHud(): void {
    this.target = this.findTarget();
    const dt = 1 / 60;
    if (this.messageT > 0) this.messageT -= dt;
    this.ui.prompt.textContent = this.messageT > 0 ? this.message : this.target ? this.promptFor(this.target) : '';
    this.ui.prompt.classList.toggle('on', Boolean(this.ui.prompt.textContent));
    const room = this.lastRoom ? this.level.roomById[this.lastRoom] : null;
    this.ui.room.textContent = room ? room.name : '';
    const bar = this.ui.stamina.firstElementChild as HTMLElement;
    bar.style.width = `${this.body.stamina}%`;
    this.ui.stamina.style.opacity = this.body.stamina < 99 ? '1' : '0';
    if (this.mode === 'night') {
      this.ui.hint.textContent = this.power.main ? 'Zone switches are on the walls. Find them.' : 'The power is out. The breaker room is in the basement.';
    } else this.ui.hint.textContent = '';
    if (this.mapOpen) this.drawMap();
  }

  private toggleMap(): void {
    this.mapOpen = !this.mapOpen;
    this.ui.map.style.display = this.mapOpen ? 'block' : 'none';
  }

  private drawMap(): void {
    const c = this.ui.map;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const lv = this.level;
    const below = this.body.y < -2;
    const s = Math.min(c.width / (lv.bounds.x2 + 4), c.height / (lv.bounds.z2 + 4));
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#3a2a1a';
    ctx.fillStyle = '#d8c8a0';
    ctx.lineWidth = 1.5;
    ctx.font = '11px Courier Prime, monospace';
    for (const r of lv.rooms.filter((q) => (q.floorY < -2) === below)) {
      for (const [x1, z1, x2, z2] of r.rects) {
        ctx.fillRect(2 * s + x1 * s, 2 * s + z1 * s, (x2 - x1) * s, (z2 - z1) * s);
        ctx.strokeRect(2 * s + x1 * s, 2 * s + z1 * s, (x2 - x1) * s, (z2 - z1) * s);
      }
      const [x1, z1, x2, z2] = r.rects[0];
      ctx.fillStyle = '#3a2a1a';
      ctx.fillText(r.name, 2 * s + ((x1 + x2) / 2) * s - r.name.length * 2.6, 2 * s + ((z1 + z2) / 2) * s);
      ctx.fillStyle = '#d8c8a0';
    }
    const px = 2 * s + this.body.x * s;
    const pz = 2 * s + this.body.z * s;
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

export { forward };
