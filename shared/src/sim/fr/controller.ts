import { FR } from '../../frConfig';
import { CollisionWorld, pushOut } from './collision';

export type Stance = 0 | 1 | 2; // stand, crouch, crawl

export interface Body {
  /** Feet position. */
  x: number;
  y: number;
  z: number;
  vy: number;
  yaw: number;
  pitch: number;
  stance: Stance;
  /** Current body height, easing toward the stance's height. */
  height: number;
  stamina: number;
  /** Seconds until stamina starts refilling. */
  staminaDelay: number;
  grounded: boolean;
  sprinting: boolean;
  /** Horizontal speed this tick (m/s), for animation, noise and anti-cheat. */
  speed: number;
  /** Distance walked since the last footstep event. */
  stride: number;
  /** Vault state: > 0 while vaulting. */
  vault: number;
  vaultFrom: { x: number; y: number; z: number };
  vaultTo: { x: number; y: number; z: number };
  vaultPeak: number;
  /** Carrying a large object (slower). */
  carrying: boolean;
  /** 0..1 how deep in water (0 until the flooded tunnel exists). */
  wade: number;
  /** In a vent or other low space: stance is forced to crawl. */
  forcedCrawl: boolean;
  /** Last grounded spot where the body fitted, for recovery from bad teleports or corrections. */
  safe: { x: number; y: number; z: number };
}

export interface FrInput {
  /** -1..1 */
  fwd: number;
  /** -1..1, +1 is right. */
  strafe: number;
  yaw: number;
  pitch: number;
  sprint: boolean;
  /** Wanted stance. The body may refuse to stand if something is overhead. */
  stance: Stance;
  jump: boolean;
}

export type BodyEvent =
  | { type: 'step'; radius: number }
  | { type: 'land'; radius: number }
  | { type: 'jump'; radius: number }
  | { type: 'vault'; radius: number };

const P = FR.player;
const N = FR.noise;

export function newBody(x: number, z: number, y = 0, yaw = 0): Body {
  return {
    x,
    y,
    z,
    vy: 0,
    yaw,
    pitch: 0,
    stance: 0,
    height: P.HEIGHT_STAND,
    stamina: 100,
    staminaDelay: 0,
    grounded: true,
    sprinting: false,
    speed: 0,
    stride: 0,
    vault: 0,
    vaultFrom: { x, y, z },
    vaultTo: { x, y, z },
    vaultPeak: 0,
    carrying: false,
    wade: 0,
    forcedCrawl: false,
    safe: { x, y, z },
  };
}

export function heightFor(s: Stance): number {
  return s === 0 ? P.HEIGHT_STAND : s === 1 ? P.HEIGHT_CROUCH : P.HEIGHT_CRAWL;
}

export function eyeHeight(b: Body): number {
  // Eye sits 0.13 m below the top of the body, matching the config's stand/crouch/crawl numbers.
  const t = Math.max(0, Math.min(1, (b.height - P.HEIGHT_CRAWL) / (P.HEIGHT_STAND - P.HEIGHT_CRAWL)));
  const lowEye = P.EYE_CRAWL;
  const highEye = P.EYE_STAND;
  return lowEye + (highEye - lowEye) * t;
}

/** Forward vector on the ground plane for a yaw. yaw 0 faces -Z (north). */
export function forward(yaw: number): [number, number] {
  return [-Math.sin(yaw), -Math.cos(yaw)];
}

export function moveSpeed(b: Body, wantSprint: boolean): number {
  if (b.stance === 2) return P.CRAWL;
  if (b.stance === 1) return b.carrying ? P.CRAWL : P.CROUCH;
  if (wantSprint) return b.carrying ? P.CARRY_SPRINT : P.SPRINT;
  const base = b.carrying ? P.CARRY_WALK : P.WALK;
  return b.wade > 0.3 ? Math.min(base, P.WADE) : base;
}

const scratch: BodyEvent[] = [];

/** Advance one body by dt seconds. Returns the events (footsteps, landings) it produced; the array is reused. */
export function stepBody(b: Body, inp: FrInput, dt: number, world: CollisionWorld): BodyEvent[] {
  scratch.length = 0;
  b.yaw = inp.yaw;
  b.pitch = Math.max(-1.45, Math.min(1.45, inp.pitch));

  if (b.vault > 0) {
    stepVault(b, dt, world);
    return scratch;
  }

  // --- Stance ---
  let want: Stance = b.forcedCrawl ? 2 : inp.stance;
  if (want < b.stance) {
    // Standing up: only if the taller body fits.
    const h = heightFor(want);
    if (world.blocked(b.x, b.y, b.z, P.RADIUS, h, P.STEP_HEIGHT)) want = b.stance;
  }
  b.stance = want;
  const targetH = heightFor(b.stance);
  const dh = P.HEIGHT_RATE * dt;
  b.height = b.height < targetH ? Math.min(targetH, b.height + dh) : Math.max(targetH, b.height - dh);

  // --- Wish direction ---
  let fx = inp.fwd;
  let sx = inp.strafe;
  const mag = Math.hypot(fx, sx);
  if (mag > 1) {
    fx /= mag;
    sx /= mag;
  }
  const [fdx, fdz] = forward(b.yaw);
  const rdx = -fdz;
  const rdz = fdx;
  const wx = fdx * fx + rdx * sx;
  const wz = fdz * fx + rdz * sx;
  const moving = mag > 0.01;

  // --- Sprint and stamina ---
  const wantSprint = inp.sprint && moving && fx > 0 && b.stance === 0;
  if (wantSprint && (b.sprinting ? b.stamina > 0 : b.stamina >= P.STAMINA_MIN_TO_SPRINT)) {
    b.sprinting = true;
    b.stamina = Math.max(0, b.stamina - P.STAMINA_DRAIN * dt);
    b.staminaDelay = P.STAMINA_REGEN_DELAY;
  } else {
    b.sprinting = false;
    if (b.staminaDelay > 0) b.staminaDelay -= dt;
    else b.stamina = Math.min(100, b.stamina + P.STAMINA_REGEN * dt);
  }

  // --- Jump and vault ---
  if (inp.jump && b.grounded && b.stance === 0) {
    if (!tryVault(b, world, moving ? wx : fdx, moving ? wz : fdz)) {
      b.vy = Math.sqrt(2 * P.GRAVITY * P.JUMP_HEIGHT);
      b.grounded = false;
      scratch.push({ type: 'jump', radius: N.WALK });
    } else {
      scratch.push({ type: 'vault', radius: N.VAULT });
      return scratch;
    }
  }

  // --- Horizontal move with collision, in small steps so nothing tunnels ---
  const speed = moving ? moveSpeed(b, wantSprint && b.sprinting) : 0;
  const dist = speed * dt;
  const steps = Math.max(1, Math.ceil(dist / (P.RADIUS * 0.5)));
  const sdx = (wx / (Math.hypot(wx, wz) || 1)) * (dist / steps);
  const sdz = (wz / (Math.hypot(wx, wz) || 1)) * (dist / steps);
  const startX = b.x;
  const startZ = b.z;
  for (let i = 0; i < steps && moving; i++) {
    b.x += sdx;
    b.z += sdz;
    resolve(b, world);
  }
  if (!moving) resolve(b, world);
  const moved = Math.hypot(b.x - startX, b.z - startZ);
  b.speed = dt > 0 ? moved / dt : 0;

  // --- Vertical ---
  const ground = world.groundAt(b.x, b.y, b.z, P.RADIUS, P.STEP_HEIGHT);
  if (b.grounded && ground > -Infinity && ground - b.y <= P.STEP_HEIGHT + 1e-4 && b.vy <= 0) {
    // Walking: snap to ground (step up or down).
    if (ground >= b.y - 0.6) b.y = ground;
    else {
      b.grounded = false;
    }
  }
  if (!b.grounded || ground < b.y - 1e-3) {
    b.grounded = false;
    b.vy -= P.GRAVITY * dt;
    let ny = b.y + b.vy * dt;
    const ceil = world.ceilingAt(b.x, b.y + 0.05, b.z, P.RADIUS);
    if (ny + b.height > ceil) {
      ny = ceil - b.height;
      if (b.vy > 0) b.vy = 0;
    }
    const g2 = world.groundAt(b.x, b.y, b.z, P.RADIUS, P.STEP_HEIGHT + Math.max(0, b.y - ny));
    if (b.vy <= 0 && g2 > -Infinity && ny <= g2) {
      const fall = -b.vy;
      b.y = g2;
      b.vy = 0;
      b.grounded = true;
      if (fall > 4.5) scratch.push({ type: 'land', radius: N.LAND });
    } else b.y = ny;
  }
  // Fell out of the world, or left inside something solid by a teleport or a large correction: go back to the
  // last spot where the body stood and fitted. Otherwise remember this one.
  const stuck = world.blocked(b.x, b.y, b.z, P.RADIUS * 0.9, b.height, P.STEP_HEIGHT);
  if (b.y < -30 || stuck) {
    if (!world.blocked(b.safe.x, b.safe.y, b.safe.z, P.RADIUS * 0.9, b.height, P.STEP_HEIGHT)) {
      b.x = b.safe.x;
      b.y = b.safe.y;
      b.z = b.safe.z;
      b.vy = 0;
      b.grounded = true;
    }
  } else if (b.grounded) {
    b.safe.x = b.x;
    b.safe.y = b.y;
    b.safe.z = b.z;
  }

  // --- Footsteps ---
  if (b.grounded && moving) {
    b.stride += moved;
    if (b.stride >= P.STRIDE) {
      b.stride -= P.STRIDE;
      const r = b.stance === 2 ? N.CRAWL_SOFT : b.stance === 1 ? N.CROUCH : b.sprinting ? N.SPRINT : N.WALK;
      scratch.push({ type: 'step', radius: b.wade > 0.3 ? N.WADE : r });
    }
  }
  return scratch;
}

/** Push the cylinder out of every solid box it overlaps. */
function resolve(b: Body, world: CollisionWorld): void {
  const r = P.RADIUS;
  for (let iter = 0; iter < 3; iter++) {
    let any = false;
    const near = world.query(b.x - r, b.z - r, b.x + r, b.z + r, []);
    for (const c of near) {
      if (!world.isActive(c) || c.kind === 'floor') continue;
      // Skip ground-level boxes the body can step onto and boxes entirely above the head.
      if (c.y2 <= b.y + P.STEP_HEIGHT + 1e-4 || c.y1 >= b.y + b.height) continue;
      const p = pushOut(b.x, b.z, r, c);
      if (p) {
        b.x += p.x;
        b.z += p.z;
        any = true;
      }
    }
    if (!any) break;
  }
}

function tryVault(b: Body, world: CollisionWorld, dx: number, dz: number): boolean {
  const len = Math.hypot(dx, dz) || 1;
  const ux = dx / len;
  const uz = dz / len;
  // Find a low obstacle straight ahead.
  const probe = P.RADIUS + 0.45;
  const px = b.x + ux * probe;
  const pz = b.z + uz * probe;
  const near = world.query(px - 0.1, pz - 0.1, px + 0.1, pz + 0.1, []);
  let top = -Infinity;
  for (const c of near) {
    if (!world.isActive(c) || c.kind === 'floor' || c.kind === 'ceiling') continue;
    if (c.y2 <= b.y + P.STEP_HEIGHT || c.y1 > b.y + 0.2) continue;
    if (px < c.x1 || px > c.x2 || pz < c.z1 || pz > c.z2) continue;
    if (c.y2 > top) top = c.y2;
  }
  if (top === -Infinity || top - b.y > P.VAULT_MAX + 1e-6) return false;
  // Landing spot: first free ground beyond the obstacle, within 2.4 m. The body passes over the obstacle's
  // top on the way, so anything taller than that on the line (a wall behind a low table) ends the search:
  // vaulting must never carry you through a wall into the next room.
  const clear = (t: number) => !world.blocked(b.x + ux * t, top, b.z + uz * t, P.RADIUS * 0.6, P.HEIGHT_CROUCH, 0.02);
  for (let s = 0.1; s < probe + 0.25; s += 0.1) if (!clear(s)) return false;
  for (let t = probe + 0.25; t <= 2.4; t += 0.2) {
    if (!clear(t - 0.1) || !clear(t)) return false;
    const lx = b.x + ux * t;
    const lz = b.z + uz * t;
    if (world.blocked(lx, b.y, lz, P.RADIUS, P.HEIGHT_STAND, P.STEP_HEIGHT)) continue;
    const g = world.groundAt(lx, b.y, lz, P.RADIUS, P.STEP_HEIGHT);
    if (g === -Infinity || Math.abs(g - b.y) > P.STEP_HEIGHT) continue;
    // Everything between must be at most vault height, and there has to be headroom to clear it.
    if (world.ceilingAt(lx, b.y, lz, P.RADIUS) < b.y + top - b.y + 1.0) continue;
    b.vault = P.VAULT_TIME;
    b.vaultFrom = { x: b.x, y: b.y, z: b.z };
    b.vaultTo = { x: lx, y: g, z: lz };
    b.vaultPeak = top - b.y + 0.2;
    b.grounded = false;
    b.vy = 0;
    return true;
  }
  return false;
}

function stepVault(b: Body, dt: number, world: CollisionWorld): void {
  b.vault = Math.max(0, b.vault - dt);
  const s = 1 - b.vault / P.VAULT_TIME;
  b.x = b.vaultFrom.x + (b.vaultTo.x - b.vaultFrom.x) * s;
  b.z = b.vaultFrom.z + (b.vaultTo.z - b.vaultFrom.z) * s;
  b.y = b.vaultFrom.y + (b.vaultTo.y - b.vaultFrom.y) * s + Math.sin(Math.PI * s) * b.vaultPeak;
  b.speed = Math.hypot(b.vaultTo.x - b.vaultFrom.x, b.vaultTo.z - b.vaultFrom.z) / P.VAULT_TIME;
  if (b.vault === 0) {
    b.x = b.vaultTo.x;
    b.y = b.vaultTo.y;
    b.z = b.vaultTo.z;
    b.grounded = true;
    resolve(b, world);
    scratch.push({ type: 'land', radius: N.LAND });
  }
}
