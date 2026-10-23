import * as THREE from 'three';
import { doorLeaves, SHUTTER_HEADROOM, type CircuitId, type FrDoorDef, type LightDef, type Level, type StyleId, type WallRun } from '@fnaf/shared';
import { BatchSet } from './batch';
import { EXTERIOR, makeStyles, TRIM, type StyleMats } from './materials';
import { buildProp } from './props';
import { buildOfficeKit, type OfficeKitRender } from './officeKit';
import { buildRoomKits, type RoomKitBuild } from './roomKits';
import { mergeStatic } from './merge';

/** Which circuits are live. The game owns this; the renderer only reads it. */
export interface PowerView {
  lit(circuit: CircuitId, kind: LightDef['kind']): boolean;
}

interface Fixture {
  def: LightDef;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  base: number;
  phase: number;
  level: number;
}

interface DoorVisual {
  def: FrDoorDef;
  pivot: THREE.Group;
  slabs: THREE.Object3D[];
  open: number;
}

const POOL = { low: 5, medium: 8, high: 12 } as const;

/** The whole building as one Three.js scene graph, grouped by room so far rooms can be skipped. */
export class WorldRender {
  readonly root = new THREE.Group();
  readonly roomGroups = new Map<string, THREE.Group>();
  readonly doors = new Map<number, DoorVisual>();
  readonly fixtures: Fixture[] = [];
  /** Building-wide set dressing (ROOM_KITS); its update() drives the animated parts. */
  readonly roomKits: RoomKitBuild;
  /** The Security Office's desk, CRTs, fan and wall dressing (shared catalogue: OFFICE_KIT). */
  readonly officeKit: OfficeKitRender;
  private styles: Record<StyleId, StyleMats>;
  private pool: { light: THREE.PointLight; fixture: Fixture | null; level: number }[] = [];
  private cellRoom = new Map<string, string>();
  private glowMats = new Map<string, THREE.MeshStandardMaterial[]>();
  readonly ambient = new THREE.HemisphereLight('#8090b0', '#201810', 0.03);
  /** Photosensitivity mode: buzzing and sparking fixtures hold steady instead of flickering. */
  calm = false;
  /** Opening graph for culling: each edge knows its door (or -1 for an archway/doorless opening). */
  private edges = new Map<string, { to: string; door: number }[]>();
  private ambientTarget = 0.03;
  private time = 0;

  constructor(readonly level: Level, quality: 'low' | 'medium' | 'high' = 'medium') {
    this.styles = makeStyles();
    const trim = TRIM();
    const ext = EXTERIOR();
    const roomBatches = new Map<string, BatchSet>();
    const sets = (id: string | null) => {
      const key = id ?? '_ext';
      let s = roomBatches.get(key);
      if (!s) {
        s = new BatchSet();
        roomBatches.set(key, s);
      }
      return s;
    };
    const wallFace = (run: WallRun, sideRoom: string | null, dir: 1 | -1, y1: number, y2: number, a: number, b: number) => {
      const room = sideRoom ? level.roomById[sideRoom] : null;
      const st = room ? this.styles[room.style] : null;
      const m = st ? st.wall : ext;
      const tile = st ? st.wallTile : 3;
      const batch = sets(sideRoom).get(m);
      const plane = run.line + dir * (run.thick / 2);
      if (run.axis === 'x') batch.faceX(plane, y1, y2, a, b, dir, tile);
      else batch.faceZ(plane, y1, y2, a, b, dir, tile);
    };
    const wallTop = (run: WallRun, y: number, a: number, b: number) => {
      const batch = sets(null).get(trim);
      if (run.axis === 'x') batch.faceY(y, run.line - run.thick / 2, run.line + run.thick / 2, a, b, 1, 1);
      else batch.faceY(y, a, b, run.line - run.thick / 2, run.line + run.thick / 2, 1, 1);
    };
    const wallEnds = (run: WallRun, y1: number, y2: number, a: number, b: number) => {
      const batch = sets(null).get(trim);
      for (const [end, dir] of [[a, -1], [b, 1]] as const) {
        if (run.axis === 'x') batch.faceZ(end, y1, y2, run.line - run.thick / 2, run.line + run.thick / 2, dir, 1);
        else batch.faceX(end, y1, y2, run.line - run.thick / 2, run.line + run.thick / 2, dir, 1);
      }
    };
    for (const run of [...level.walls, ...level.lintels]) {
      wallFace(run, run.lo, -1, run.y1, run.y2, run.a, run.b);
      wallFace(run, run.hi, 1, run.y1, run.y2, run.a, run.b);
      wallTop(run, run.y2, run.a, run.b);
      wallEnds(run, run.y1, run.y2, run.a, run.b);
    }
    // Underside of lintels (soffit) so door frames look closed.
    for (const run of level.lintels) {
      if (run.y1 > 0.01 + (level.roomById[run.lo ?? run.hi ?? '']?.floorY ?? 0)) {
        const batch = sets(null).get(trim);
        if (run.axis === 'x') batch.faceY(run.y1, run.line - run.thick / 2, run.line + run.thick / 2, run.a, run.b, -1, 1);
        else batch.faceY(run.y1, run.a, run.b, run.line - run.thick / 2, run.line + run.thick / 2, -1, 1);
      }
    }

    for (const r of level.rooms) {
      const st = this.styles[r.style];
      const set = sets(r.id);
      for (const [x1, z1, x2, z2] of r.rects) {
        if (!r.noFloor) set.get(st.floor).faceY(r.floorY, x1, x2, z1, z2, 1, st.floorTile);
        if (!r.noCeil) set.get(st.ceil).faceY(r.floorY + r.ceilH, x1, x2, z1, z2, -1, 3);
        for (let x = x1; x < x2; x++) for (let z = z1; z < z2; z++) this.cellRoom.set(`${r.floorY}|${x},${z}`, r.id);
      }
    }

    for (const [id, set] of roomBatches) {
      const g = new THREE.Group();
      g.name = id;
      for (const mesh of set.meshes()) g.add(mesh);
      this.root.add(g);
      this.roomGroups.set(id, g);
    }
    const groupFor = (id: string) => {
      let g = this.roomGroups.get(id);
      if (!g) {
        g = new THREE.Group();
        g.name = id;
        this.root.add(g);
        this.roomGroups.set(id, g);
      }
      return g;
    };

    // Props and set dressing are static: build them per room, then bake each room into one mesh per material.
    const dressing = new Map<string, THREE.Group>();
    const dressFor = (room: string) => {
      let g = dressing.get(room);
      if (!g) {
        g = new THREE.Group();
        g.name = `dress:${room}`;
        dressing.set(room, g);
      }
      return g;
    };
    for (const p of level.props) {
      const b = buildProp(p);
      dressFor(p.room).add(b.object);
      if (b.glows.length) {
        const list = this.glowMats.get(p.room) ?? [];
        list.push(...b.glows);
        this.glowMats.set(p.room, list);
      }
    }
    this.officeKit = buildOfficeKit();
    groupFor('office').add(this.officeKit.root);
    this.roomKits = buildRoomKits();
    for (const [room, g] of this.roomKits.byRoom) dressFor(room).add(g);
    for (const [room, g] of dressing) groupFor(room).add(mergeStatic(g));
    this.buildWindows();
    for (const d of level.doors) this.buildDoor(d, groupFor(this.roomOfDoor(d)));
    this.buildEdges();
    this.buildFixtures(groupFor);
    this.buildDecor(groupFor);

    // Outside: wet asphalt.
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: '#0c0d10', roughness: 0.25, metalness: 0.2 }));
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(level.bounds.x2 / 2, -0.62, level.bounds.z2 / 2);
    this.root.add(lot);

    this.root.add(this.ambient);
    const n = POOL[quality];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight('#ffffff', 0, 18, 2);
      l.castShadow = false;
      this.root.add(l);
      this.pool.push({ light: l, fixture: null, level: 0 });
    }
  }

  private buildEdges(): void {
    const link = (a: string, b: string, door: number) => {
      for (const [x, y] of [[a, b], [b, a]]) {
        const list = this.edges.get(x) ?? [];
        if (!list.some((e) => e.to === y && e.door === door)) list.push({ to: y, door });
        this.edges.set(x, list);
      }
    };
    for (const o of this.level.openings) {
      const mid = Math.floor((o.from + o.to) / 2);
      const at = (off: number) => (o.axis === 'z' ? this.cellRoom.get(`${o.floorY}|${mid},${Math.floor(o.line + off)}`) : this.cellRoom.get(`${o.floorY}|${Math.floor(o.line + off)},${mid}`));
      const a = at(0.5);
      const b = at(-0.5);
      if (!a || !b || a === b) continue;
      const door = this.level.doors.find((d) => d.axis === o.axis && d.line === o.line && d.from === o.from && d.to === o.to && d.floorY === o.floorY);
      link(a, b, door ? door.id : -1);
    }
    // The stairwell is one shaft split over two floors.
    for (const [a, b] of Object.entries(this.level.links)) for (const n of b) if (!this.edges.get(a)?.some((e) => e.to === n)) link(a, n, -1);
  }

  private roomOfDoor(d: FrDoorDef): string {
    const mid = (d.from + d.to) / 2;
    const probe = (off: number) => (d.axis === 'z' ? this.cellRoom.get(`${d.floorY}|${Math.floor(mid)},${Math.floor(d.line + off)}`) : this.cellRoom.get(`${d.floorY}|${Math.floor(d.line + off)},${Math.floor(mid)}`));
    return probe(0.5) ?? probe(-0.5) ?? 'dining';
  }

  roomAt(x: number, y: number, z: number): string | null {
    const fy = y < -2 ? -4.5 : 0;
    return this.cellRoom.get(`${fy}|${Math.floor(x)},${Math.floor(z)}`) ?? null;
  }

  private buildWindows(): void {
    const glass = new THREE.MeshPhysicalMaterial({ color: '#9ec0d8', transparent: true, opacity: 0.22, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
    for (const o of this.level.openings) {
      if (o.kind !== 'window' && o.kind !== 'glass') continue;
      const w = o.to - o.from;
      const h = o.head - o.sill;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glass);
      if (o.axis === 'z') mesh.position.set((o.from + o.to) / 2, o.floorY + o.sill + h / 2, o.line);
      else {
        mesh.position.set(o.line, o.floorY + o.sill + h / 2, (o.from + o.to) / 2);
        mesh.rotation.y = Math.PI / 2;
      }
      this.root.add(mesh);
    }
  }

  private buildDoor(d: FrDoorDef, parent: THREE.Group): void {
    const w = d.to - d.from;
    const pivot = new THREE.Group();
    const slabs: THREE.Object3D[] = [];
    const wood = new THREE.MeshStandardMaterial({ color: '#6a4a2e', roughness: 0.8 });
    const steel = new THREE.MeshStandardMaterial({ color: '#7a8088', roughness: 0.45, metalness: 0.7 });
    const stripe = new THREE.MeshStandardMaterial({ color: '#8a7a2a', roughness: 0.7, metalness: 0.4 });
    const curtain = new THREE.MeshStandardMaterial({ color: '#5a2a78', roughness: 1, side: THREE.DoubleSide });
    const glass = new THREE.MeshPhysicalMaterial({ color: '#a8c8d8', transparent: true, opacity: 0.3, roughness: 0.05, side: THREE.DoubleSide });
    const mid = d.axis === 'z' ? new THREE.Vector3((d.from + d.to) / 2, d.floorY, d.line) : new THREE.Vector3(d.line, d.floorY, (d.from + d.to) / 2);
    const alongX = d.axis === 'z';
    const make = (len: number, mat: THREE.Material, thick = 0.06): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : thick, d.height, alongX ? thick : len), mat);
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    if (d.kind === 'swing' || d.kind === 'exit' || d.kind === 'glass') {
      const mat = d.kind === 'glass' ? glass : d.kind === 'exit' ? steel : wood;
      // Hinge pivot at one end; slab extends along the wall.
      const hingePos = d.hinge === 'from' ? d.from : d.to;
      const s = d.hinge === 'from' ? 1 : -1;
      pivot.position.set(alongX ? hingePos : d.line, d.floorY, alongX ? d.line : hingePos);
      const slab = make(w, mat);
      slab.position.set(alongX ? (s * w) / 2 : 0, d.height / 2, alongX ? 0 : (s * w) / 2);
      pivot.add(slab);
      slabs.push(slab);
      if (d.kind === 'swing') {
        const win = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 0.28 : 0.07, 0.4, alongX ? 0.07 : 0.28), glass);
        win.position.set(alongX ? (s * w) / 2 : 0, d.height * 0.72, alongX ? 0 : (s * w) / 2);
        pivot.add(win);
      }
    } else if (d.kind === 'double') {
      pivot.position.set(mid.x, 0, mid.z);
      for (const side of [-1, 1]) {
        const sub = new THREE.Group();
        const edge = side * (w / 2);
        sub.position.set(alongX ? edge : 0, d.floorY, alongX ? 0 : edge);
        const slab = make(w / 2, wood);
        slab.position.set(alongX ? -side * (w / 4) : 0, d.height / 2, alongX ? 0 : -side * (w / 4));
        sub.add(slab);
        sub.userData.side = side;
        pivot.add(sub);
        slabs.push(sub);
      }
      pivot.position.y = 0;
    } else if (d.kind === 'shutter' || d.kind === 'roller') {
      pivot.position.set(mid.x, d.floorY, mid.z);
      const slab = make(w, d.kind === 'roller' ? stripe : steel, 0.1);
      slab.position.y = d.height / 2;
      pivot.add(slab);
      slabs.push(slab);
    } else {
      pivot.position.set(mid.x, d.floorY, mid.z);
      const slab = make(w, curtain, 0.05);
      slab.position.y = d.height / 2;
      pivot.add(slab);
      slabs.push(slab);
    }
    parent.add(pivot);
    this.doors.set(d.id, { def: d, pivot, slabs, open: d.startsOpen ? 1 : 0 });
    this.poseDoor(this.doors.get(d.id) as DoorVisual, d.startsOpen ? 1 : 0);
  }

  poseDoor(v: DoorVisual, open: number): void {
    v.open = open;
    const d = v.def;
    const alongX = d.axis === 'z';
    // Hinged leaves and shutters are posed with the same numbers the collision uses (doorLeaves, doorBoxes).
    if (d.kind === 'swing' || d.kind === 'exit' || d.kind === 'glass') {
      v.pivot.rotation.y = doorLeaves(d, open)[0].angle;
    } else if (d.kind === 'double') {
      const leaves = doorLeaves(d, open);
      for (const sub of v.slabs) sub.rotation.y = leaves[(sub.userData.side as number) === -1 ? 0 : 1].angle;
    } else if (d.kind === 'shutter' || d.kind === 'roller') {
      v.slabs[0].position.y = d.height / 2 + open * (d.height - SHUTTER_HEADROOM);
    } else {
      // Curtain: slides aside by shrinking.
      v.slabs[0].scale.set(alongX ? Math.max(0.12, 1 - open * 0.88) : 1, 1, alongX ? 1 : Math.max(0.12, 1 - open * 0.88));
    }
  }

  private buildFixtures(groupFor: (id: string) => THREE.Group): void {
    for (const l of this.level.lights) {
      const mat = new THREE.MeshStandardMaterial({ color: '#111', emissive: l.color, emissiveIntensity: 0, roughness: 0.6 });
      let geo: THREE.BufferGeometry;
      switch (l.kind) {
        case 'fluoro':
          geo = new THREE.BoxGeometry(1.2, 0.05, 0.2);
          break;
        case 'pendant':
          geo = new THREE.SphereGeometry(0.2, 12, 10);
          break;
        case 'caged':
          geo = new THREE.BoxGeometry(0.28, 0.14, 0.28);
          break;
        case 'emergency':
          geo = new THREE.BoxGeometry(0.3, 0.12, 0.12);
          break;
        case 'neon':
          geo = new THREE.BoxGeometry(3, 0.16, 0.06);
          break;
        default:
          geo = new THREE.SphereGeometry(0.1, 8, 6);
      }
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(l.x, l.y, l.z);
      groupFor(l.room).add(mesh);
      if (l.kind === 'pendant') {
        const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.0, 4), new THREE.MeshStandardMaterial({ color: '#111' }));
        cord.position.set(l.x, l.y + 0.5, l.z);
        groupFor(l.room).add(cord);
      }
      this.fixtures.push({ def: l, mesh, mat, base: l.kind === 'emergency' ? 2.2 : l.kind === 'neon' ? 2.4 : 1.7, phase: hash01(l.id, 17) * 100, level: 0 });
    }
  }

  /** Banners, stage backdrop, posters: things that make the rooms read as a pizzeria. */
  private buildDecor(groupFor: (id: string) => THREE.Group): void {
    const std = (c: string, e?: string) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, emissive: e ?? '#000', emissiveIntensity: e ? 0.6 : 0 });
    // Show stage: star backdrop and side drapes.
    const stage = groupFor('stage');
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.2, 12.6), std('#1a2a6a'));
    back.position.set(67.6, 3.1, 15);
    stage.add(back);
    for (const z of [10.4, 19.6]) {
      const drape = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4.2, 1.6), std('#8a1020'));
      drape.position.set(66.8, 3.1, z);
      stage.add(drape);
    }
    const valance = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 13), std('#8a1020'));
    valance.position.set(66.7, 5.0, 15);
    stage.add(valance);
    // Dining Hall: banner and a disco ball.
    const dining = groupFor('dining');
    const banner = new THREE.Mesh(new THREE.BoxGeometry(12, 0.9, 0.06), std('#ff6a9a', '#ff2a6a'));
    banner.position.set(30, 4.2, 10.15);
    dining.add(banner);
    const disco = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshStandardMaterial({ color: '#cccccc', metalness: 1, roughness: 0.1 }));
    disco.position.set(34, 4.1, 21);
    dining.add(disco);
    // Pirate Cove: curtains across the front of the cove, and a sign.
    const cove = groupFor('cove');
    const cur = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3, 6.5), std('#4a1a6a'));
    cur.position.set(13.2, 1.8, 16);
    cove.add(cur);
    // Prize corner neon sign
    const prize = groupFor('prize');
    const neon = new THREE.Mesh(new THREE.BoxGeometry(5, 0.7, 0.06), std('#220810', '#ff5fb0'));
    neon.position.set(22, 3.0, 0.15);
    prize.add(neon);
    // Exit signs over the staff door and the front doors.
    const exitMat = std('#041a08', '#2aff60');
    for (const [room, x, y, z] of [['staff', 5, 2.6, 65.85], ['lobby', 40, 3.0, 0.2]] as const) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.05), exitMat);
      s.position.set(x, y, z);
      groupFor(room).add(s);
    }
  }

  /** Ambient/fog target and fixture lighting, called every frame. */
  update(dt: number, power: PowerView, cam: THREE.Vector3, camRoom: string | null): void {
    this.time += dt;
    this.roomKits.update(dt, (room) => power.lit(this.level.roomById[room]?.circuit ?? 'always', 'fluoro'));
    const t = this.time;
    let litNear = 0;
    for (const f of this.fixtures) {
      const lit = f.def.flicker !== 'dead' && power.lit(f.def.circuit, f.def.kind);
      let target = lit ? 1 : 0;
      // Flicker from a seeded hash of (time step, fixture), never Math.random: the same tube stutters the same
      // way every night, and the rate stays under 3 Hz-equivalent dips. Photosensitivity mode holds them steady.
      if (lit && f.def.flicker === 'buzz') target = this.calm ? 0.85 : Math.sin(t * 40 + f.phase) > -0.2 ? (hash01(Math.floor(t * 12), f.def.id) < 0.04 ? 0.15 : 1) : 0.7;
      if (lit && f.def.flicker === 'spark') target = this.calm ? 1 : (t + f.phase) % 24 < 0.5 ? (hash01(Math.floor(t * 8), f.def.id + 999) < 0.5 ? 0 : 1) : 1;
      f.level += (target - f.level) * Math.min(1, dt * 18);
      f.mat.emissiveIntensity = f.level * f.base;
      if (camRoom && f.def.room === camRoom) litNear = Math.max(litNear, lit ? f.level : 0);
    }
    this.ambientTarget = 0.03 + litNear * 0.5;
    this.ambient.intensity += (this.ambientTarget - this.ambient.intensity) * Math.min(1, dt * 3);
    for (const [room, mats] of this.glowMats) {
      const roomLit = this.fixtures.some((f) => f.def.room === room && f.level > 0.3) || room === 'arcade';
      for (const m of mats) m.emissiveIntensity = roomLit ? 1.5 : 0.08;
    }

    // Light pool: the nearest lit fixtures get real lights.
    const cands = this.fixtures.filter((f) => f.def.real && f.level > 0.05 && f.def.kind !== 'neon');
    // Real lights go to the room you're in first, then rooms you can see into, then anything else close. Pure
    // distance used to hand a slot to a lamp on the far side of a wall, which then lit this room through it.
    const linked = new Set(camRoom ? (this.edges.get(camRoom) ?? []).map((e) => e.to) : []);
    const near = cands
      .filter((f) => this.roomGroups.get(f.def.room)?.visible !== false)
      .map((f) => {
        const d2 = (f.def.x - cam.x) ** 2 + (f.def.y - cam.y) ** 2 + (f.def.z - cam.z) ** 2;
        const w = f.def.room === camRoom ? 1 : linked.has(f.def.room) ? 3 : 10;
        return { f, d2, score: d2 * w };
      })
      .filter((c) => c.d2 < 26 * 26)
      .sort((a, b) => a.score - b.score)
      .slice(0, this.pool.length)
      .map((c) => c.f);
    const keep = new Set(near);
    for (const slot of this.pool) if (slot.fixture && !keep.has(slot.fixture)) slot.fixture = null;
    const assigned = new Set(this.pool.map((s) => s.fixture).filter(Boolean));
    for (const f of near) {
      if (assigned.has(f)) continue;
      const free = this.pool.find((s) => !s.fixture);
      if (free) {
        free.fixture = f;
        assigned.add(f);
      }
    }
    for (const slot of this.pool) {
      const f = slot.fixture;
      const target = f ? f.def.intensity * f.level : 0;
      slot.level += (target - slot.level) * Math.min(1, dt * 10);
      slot.light.intensity = slot.level;
      if (f) {
        slot.light.position.set(f.def.x, f.def.y - 0.3, f.def.z);
        slot.light.color.set(f.def.color);
        slot.light.distance = f.def.kind === 'emergency' ? 9 : f.def.kind === 'pendant' ? 22 : 15;
      }
    }
  }

  /**
   * Show the rooms you could see from `camRoom`: walk the opening graph up to `hops` openings deep, but stop
   * at a closed door (the room just behind it stays drawn so the door itself never vanishes). Open doors and
   * archways let the walk continue, so a long sightline through an open door isn't cut off at two hops.
   */
  cull(camRoom: string | null, hops = 2, always: string[] = [], doorOpen?: ArrayLike<number>): void {
    const show = new Set<string>(['_ext', ...always]);
    if (camRoom) {
      let frontier = [camRoom];
      show.add(camRoom);
      for (let i = 0; i < hops; i++) {
        const next: string[] = [];
        for (const r of frontier)
          for (const e of this.edges.get(r) ?? []) {
            if (show.has(e.to)) continue;
            show.add(e.to);
            const closed = e.door >= 0 && doorOpen !== undefined && doorOpen[e.door] < 0.05;
            if (!closed) next.push(e.to);
          }
        frontier = next;
      }
    } else {
      for (const id of this.roomGroups.keys()) show.add(id);
    }
    for (const [id, g] of this.roomGroups) g.visible = show.has(id);
  }
}

/** Deterministic 0..1 hash of two integers (for seeded flicker). */
function hash01(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}
