import * as THREE from 'three';
import { ROSTER_BY_ID, type CharacterLook, type RosterMode } from '@fnaf/shared';
import { buildEndo, frayedEnd, wireBundle, type EndoRig } from './endo';
import { fur, glow, plain, eyeWhite, textured } from '../materials';
import { bibTex } from '../textures';

export type PoseName = 'idle' | 'stare' | 'lean' | 'slumped' | 'walk' | 'crawl' | 'sitting' | 'lunge';

export interface CharacterRig {
  id: string;
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  eyes: THREE.Mesh[];
  pupils: THREE.Mesh[];
  costume: THREE.Group;
  endo: EndoRig;
  sparkPoints: THREE.Object3D[];
  sparkRate: number;
  height: number;
  look: CharacterLook;
  userGlitch?: boolean;
  pose(p: PoseName): void;
  setEndo(on: boolean): void;
  setXray(on: boolean): void;
  setEyesOnly(on: boolean): void;
  tick(t: number): void;
}

/** Original-mode looks: same silhouettes, different characters (Part 6.3). */
const ORIGINAL_LOOKS: Record<string, Partial<CharacterLook>> = {
  freddy: { fur: '#5a6a7a', belly: '#a8b4c0', accent: '#c41e1e', prop: 'banjo', hat: 'bowler', eye: '#ffd21a' },
  bonnie: { fur: '#5ac8a0', belly: '#c8f0e0', accent: '#d8b020', prop: 'tambourine', eye: '#ff7ad8' },
  chica: { fur: '#f2f2f2', belly: '#ff8a2a', accent: '#ff7a1a', prop: 'tray', eye: '#2a8ad8' },
  foxy: { fur: '#c8662a', belly: '#e8c8a0', accent: '#3a2a1a', prop: 'telescope', eye: '#7af0ff' },
  golden: { fur: '#8a6a3a', belly: '#a88a5a', hat: 'none' },
  puppet: { accent: '#3a6ad8', fur: '#1a1a3a' },
};

export function lookFor(id: string, mode: RosterMode, variant = ''): CharacterLook {
  const base = ROSTER_BY_ID[id]?.look ?? { body: 'endo', fur: '#444', belly: '#444', eye: '#f00', accent: '#888', height: 1.9 };
  let look: CharacterLook = { ...base };
  if (mode === 'original') look = { ...look, ...(ORIGINAL_LOOKS[id] ?? {}) };
  // Showtime animatronic skins.
  if (variant === 'shadow') look = { ...look, shadow: true, fur: '#1a0f2a' };
  if (variant === 'withered') look = { ...look, withered: true };
  if (variant === 'rockstar') look = { ...look, glossy: true, accent: '#2a2a8a' };
  if (variant === 'glamrock') look = { ...look, glossy: true, fur: '#ff3ad8', belly: '#5af0ff' };
  if (variant === 'party') look = { ...look, prop: 'balloon' };
  if (variant === 'captain') look = { ...look, accent: '#2a1a5a', hat: 'top' };
  if (variant === 'glitched') look = { ...look, phantom: true };
  return look;
}

const sph = (r: number, m: THREE.Material, seg = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), m);
const cap = (r: number, len: number, m: THREE.Material) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), m);
const cyl = (r1: number, r2: number, h: number, m: THREE.Material, seg = 14) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m);
const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const cone = (r: number, h: number, m: THREE.Material, seg = 10) => new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m);

function at<T extends THREE.Object3D>(o: T, x: number, y: number, z: number, parent?: THREE.Object3D): T {
  o.position.set(x, y, z);
  parent?.add(o);
  return o;
}

/** Limb segment as a capsule from a to b. */
function seg(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material, parent: THREE.Object3D): THREE.Mesh {
  const len = Math.max(0.01, a.distanceTo(b) - r * 2);
  const c = cap(r, len, m);
  c.position.copy(a).add(b).multiplyScalar(0.5);
  c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  parent.add(c);
  return c;
}

function bowTie(color: string, parent: THREE.Object3D, y: number, z: number, s: number): void {
  const m = plain(color, 0.6);
  for (const side of [-1, 1]) {
    const c = cone(0.05 * s, 0.09 * s, m, 6);
    c.rotation.z = (side * Math.PI) / 2;
    at(c, side * 0.045 * s, y, z, parent);
  }
  at(sph(0.025 * s, m, 8), 0, y, z + 0.01, parent);
}

function topHat(color: string, parent: THREE.Object3D, y: number, s: number, kind: 'top' | 'bowler' | 'propeller'): void {
  const m = plain(color, 0.5);
  if (kind === 'top') {
    at(cyl(0.12 * s, 0.12 * s, 0.015 * s, m), 0, y, 0, parent);
    at(cyl(0.075 * s, 0.08 * s, 0.13 * s, m), 0, y + 0.07 * s, 0, parent);
  } else if (kind === 'bowler') {
    at(cyl(0.13 * s, 0.13 * s, 0.015 * s, m), 0, y, 0, parent);
    const d = sph(0.09 * s, m);
    d.scale.y = 0.8;
    at(d, 0, y + 0.03 * s, 0, parent);
  } else {
    const d = sph(0.11 * s, plain('#2a5bd8', 0.5));
    d.scale.y = 0.6;
    at(d, 0, y, 0, parent);
    at(cyl(0.01 * s, 0.01 * s, 0.08 * s, plain('#888', 0.4)), 0, y + 0.08 * s, 0, parent);
    const blade = box(0.25 * s, 0.01 * s, 0.04 * s, plain('#ffd21a', 0.5));
    at(blade, 0, y + 0.12 * s, 0, parent);
  }
}

function prop(kind: CharacterLook['prop'], parent: THREE.Object3D, s: number, look: CharacterLook): void {
  if (!kind || kind === 'none') return;
  const p = new THREE.Group();
  parent.add(p);
  if (kind === 'mic') {
    at(cyl(0.012 * s, 0.015 * s, 0.22 * s, plain('#111', 0.4, 0.3)), 0, 0.05 * s, 0, p);
    at(sph(0.035 * s, plain('#222', 0.3, 0.6)), 0, 0.17 * s, 0, p);
    p.rotation.x = -0.4;
  } else if (kind === 'guitar' || kind === 'banjo') {
    const body = kind === 'banjo' ? cyl(0.16 * s, 0.16 * s, 0.05 * s, plain('#d8c8a0', 0.6)) : box(0.3 * s, 0.38 * s, 0.05 * s, plain('#c41e1e', 0.35, 0.1));
    if (kind === 'banjo') body.rotation.x = Math.PI / 2;
    at(body, 0, -0.1 * s, 0.1 * s, p);
    at(box(0.05 * s, 0.55 * s, 0.03 * s, plain('#3a2a1a', 0.6)), 0.1 * s, 0.3 * s, 0.1 * s, p).rotation.z = -0.35;
    p.rotation.z = 0.6;
  } else if (kind === 'cupcake' || kind === 'tray') {
    at(cyl(0.12 * s, 0.1 * s, 0.015 * s, plain('#d8d8d8', 0.3, 0.3)), 0, 0, 0.05 * s, p);
    if (kind === 'cupcake') {
      at(cyl(0.05 * s, 0.04 * s, 0.05 * s, plain('#c88a4a', 0.7)), 0, 0.035 * s, 0.05 * s, p);
      at(sph(0.055 * s, plain('#ff7ab8', 0.6)), 0, 0.075 * s, 0.05 * s, p).scale.y = 0.7;
      at(cyl(0.004 * s, 0.004 * s, 0.05 * s, plain('#ffffff', 0.5)), 0, 0.13 * s, 0.05 * s, p);
      at(sph(0.006 * s, glow('#ffaa30', 3), 6), 0, 0.16 * s, 0.05 * s, p);
      for (const x of [-0.02, 0.02]) {
        at(sph(0.012 * s, plain('#ffffff', 0.3), 8), x * s, 0.09 * s, 0.1 * s, p);
        at(sph(0.006 * s, plain('#000', 0.3), 6), x * s, 0.09 * s, 0.11 * s, p);
      }
    } else {
      for (let i = 0; i < 3; i++) at(cone(0.05 * s, 0.01 * s, plain('#e8a040', 0.7), 3), (i - 1) * 0.07 * s, 0.015 * s, 0.05 * s, p);
    }
  } else if (kind === 'hook') {
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05 * s, 0.01 * s, 6, 14, Math.PI * 1.3), plain('#c8c8c8', 0.2, 1));
    at(hook, 0, -0.05 * s, 0, p);
    at(cyl(0.03 * s, 0.03 * s, 0.04 * s, plain('#6a6a6a', 0.3, 0.9)), 0, 0.02 * s, 0, p);
  } else if (kind === 'balloon') {
    at(cyl(0.002 * s, 0.002 * s, 0.6 * s, plain('#ddd', 0.5)), 0, 0.3 * s, 0, p);
    at(sph(0.12 * s, new THREE.MeshPhysicalMaterial({ color: look.accent, roughness: 0.2, clearcoat: 1 })), 0, 0.68 * s, 0, p).scale.y = 1.2;
  } else if (kind === 'tambourine') {
    at(new THREE.Mesh(new THREE.TorusGeometry(0.1 * s, 0.02 * s, 6, 16), plain('#c8a030', 0.4, 0.5)), 0, 0, 0, p);
  } else if (kind === 'telescope') {
    const t = cyl(0.025 * s, 0.04 * s, 0.35 * s, plain('#a87830', 0.3, 0.8));
    t.rotation.x = Math.PI / 2;
    at(t, 0, 0, 0.1 * s, p);
  }
}

/** Build any character in the roster from primitives. */
export function buildCharacter(id: string, mode: RosterMode = 'tribute', variant = ''): CharacterRig {
  const look = lookFor(id, mode, variant);
  const H = look.height;
  const s = H / 2;
  const wear = look.withered ? 1 : look.glossy ? 0 : 0.5;
  const shadowMat = new THREE.MeshStandardMaterial({ color: '#08040e', roughness: 1 });
  const furM = look.shadow ? shadowMat : look.phantom ? new THREE.MeshStandardMaterial({ color: look.fur, roughness: 1, emissive: '#ff5a10', emissiveIntensity: 0.15 }) : fur(look.fur, wear, look.glossy);
  const bellyM = look.shadow ? shadowMat : fur(look.belly, wear, look.glossy);
  const accentM = plain(look.accent, 0.6);

  const root = new THREE.Group();
  root.name = id;
  const body = new THREE.Group();
  root.add(body);
  const costume = new THREE.Group();
  costume.name = 'costume';
  body.add(costume);
  const endo = buildEndo(H, look.eye, look.body === 'endo' ? look.fur : '#3a3d42');
  body.add(endo.group);

  // The head and arms are shared with the endo so poses move both layers together.
  const head = endo.head;
  const jaw = endo.jaw;
  const armL = endo.armL;
  const armR = endo.armR;
  const sparkPoints = [...endo.sparkPoints];
  const eyes: THREE.Mesh[] = [];
  const pupils: THREE.Mesh[] = [...endo.eyes];
  const headCostume = new THREE.Group();
  head.add(headCostume);
  const jawCostume = new THREE.Group();
  jaw.add(jawCostume);

  const kind = look.body;
  const hasCostume = kind !== 'endo';
  // Head and arms move to the body so they stay visible when the endo metal is hidden.
  body.add(head, armL, armR);
  const setEndo = (on: boolean) => {
    root.traverse((o) => {
      if (o.userData.endoPart) o.visible = on;
    });
  };
  const endoShown = !hasCostume || Boolean(look.withered);

  const addEyes = (y: number, z: number, spread: number, r: number, eyeless = false) => {
    for (const side of [-1, 1]) {
      const w = sph(r, look.shadow ? shadowMat : eyeWhite(), 14);
      at(w, side * spread, y, z, headCostume);
      eyes.push(w);
      const ir = new THREE.Mesh(new THREE.CircleGeometry(r * (eyeless ? 0.25 : 0.5), 14), glow(look.eye, look.shadow || eyeless ? 6 : 1.2));
      at(ir, side * spread, y, z + r * 0.98, headCostume);
      const pu = new THREE.Mesh(new THREE.CircleGeometry(r * 0.18, 10), glow(look.shadow || eyeless ? '#ffffff' : '#fff8e0', eyeless ? 8 : 3));
      at(pu, side * spread, y, z + r * 1.0, headCostume);
      pupils.push(pu);
      if (eyeless) w.visible = false;
    }
  };

  if (hasCostume) {
    if (kind === 'bear' || kind === 'rabbit' || kind === 'bird' || kind === 'fox' || kind === 'blob') {
      const fat = kind === 'bear' || kind === 'blob' ? 1.15 : kind === 'bird' ? 1.05 : 0.85;
      const torso = sph(0.36 * s, furM, 20);
      torso.scale.set(fat, kind === 'rabbit' || kind === 'fox' ? 1.35 : 1.15, 0.85);
      at(torso, 0, 1.18 * s, 0, costume);
      const belly = sph(0.3 * s, bellyM, 18);
      belly.scale.set(fat * 0.85, 1.05, 0.5);
      at(belly, 0, 1.12 * s, 0.17 * s, costume);
      // Hips and legs.
      for (const side of [-1, 1]) {
        const hip = new THREE.Vector3(side * 0.13 * s, 0.9 * s, 0);
        const knee = new THREE.Vector3(side * 0.14 * s, 0.5 * s, 0.03 * s);
        const ankle = new THREE.Vector3(side * 0.13 * s, 0.12 * s, 0);
        const torn = look.withered && side === 1;
        if (!torn) seg(hip, knee, 0.12 * s, furM, costume);
        if (!(look.withered && kind === 'fox')) seg(knee, ankle, 0.1 * s, kind === 'fox' ? plain('#5a3a22', 0.9) : furM, costume);
        const foot = sph(0.11 * s, furM, 12);
        foot.scale.set(0.9, 0.45, 1.5);
        at(foot, side * 0.13 * s, 0.06 * s, 0.07 * s, costume);
      }
      // Head.
      const headW = kind === 'bear' || kind === 'blob' ? 0.26 : kind === 'bird' ? 0.24 : 0.22;
      const hs = sph(headW * s, furM, 22);
      hs.scale.set(1, kind === 'rabbit' ? 1.05 : 0.95, 0.95);
      at(hs, 0, 0.12 * s, 0.02 * s, headCostume);
      if (look.withered && kind === 'rabbit' && id.includes('withered')) hs.visible = false; // faceless
      // Muzzle and snout.
      if (kind === 'fox') {
        const snout = cap(0.08 * s, 0.16 * s, bellyM);
        snout.rotation.x = Math.PI / 2;
        at(snout, 0, 0.06 * s, 0.24 * s, headCostume);
        at(sph(0.03 * s, plain('#111', 0.4)), 0, 0.08 * s, 0.38 * s, headCostume);
        const lower = cap(0.06 * s, 0.14 * s, bellyM);
        lower.rotation.x = Math.PI / 2;
        at(lower, 0, -0.03 * s, 0.3 * s, jawCostume);
        for (let i = 0; i < 8; i++) {
          const t = cone(0.012 * s, 0.035 * s, plain('#e8e0c8', 0.4), 4);
          t.rotation.x = Math.PI;
          at(t, (i % 2 ? 1 : -1) * 0.04 * s, 0.035 * s, (0.24 + Math.floor(i / 2) * 0.035) * s, headCostume);
        }
      } else if (kind === 'bird') {
        const beak = cone(0.09 * s, 0.17 * s, plain(look.accent, 0.5), 12);
        beak.rotation.x = Math.PI / 2;
        beak.scale.y = 1;
        at(beak, 0, 0.07 * s, 0.3 * s, headCostume);
        const lb = cone(0.08 * s, 0.13 * s, plain(look.accent, 0.5), 12);
        lb.rotation.x = Math.PI / 2;
        at(lb, 0, -0.02 * s, 0.27 * s, jawCostume);
        for (let i = 0; i < 3; i++) at(cone(0.025 * s, 0.1 * s, furM, 6), (i - 1) * 0.04 * s, 0.37 * s, 0, headCostume).rotation.z = (i - 1) * 0.4;
      } else {
        const muz = sph(0.13 * s, bellyM, 16);
        muz.scale.set(1.15, 0.75, 0.9);
        at(muz, 0, 0.04 * s, 0.2 * s, headCostume);
        at(sph(0.035 * s, plain(kind === 'rabbit' ? '#ff7ab8' : '#111', 0.3)), 0, 0.09 * s, 0.31 * s, headCostume);
        const lower = sph(0.11 * s, bellyM, 14);
        lower.scale.set(1.05, 0.45, 0.9);
        at(lower, 0, -0.04 * s, 0.22 * s, jawCostume);
      }
      // Teeth rows: flat, slightly dirty.
      if (kind !== 'bird') {
        for (let i = 0; i < 6; i++) {
          at(box(0.025 * s, 0.03 * s, 0.015 * s, plain('#e8e0c8', 0.6)), (i - 2.5) * 0.028 * s, -0.005 * s, 0.3 * s, headCostume);
          at(box(0.025 * s, 0.03 * s, 0.015 * s, plain('#d8d0b8', 0.6)), (i - 2.5) * 0.028 * s, 0.0, 0.29 * s, jawCostume);
        }
      }
      if (look.nightmare) {
        for (let i = 0; i < 10; i++) {
          const t = cone(0.015 * s, 0.07 * s, plain('#f0e8d0', 0.4), 4);
          t.rotation.x = Math.PI;
          at(t, (i - 4.5) * 0.025 * s, 0.0, 0.31 * s, headCostume);
          const b = cone(0.015 * s, 0.07 * s, plain('#f0e8d0', 0.4), 4);
          at(b, (i - 4.5) * 0.025 * s, 0.03 * s, 0.3 * s, jawCostume);
        }
        for (let i = 0; i < 5; i++) at(cone(0.04 * s, 0.14 * s, furM, 5), 0, (1.0 + i * 0.12) * s, -0.3 * s, costume).rotation.x = -0.8;
      }
      // Ears.
      if (kind === 'bear' || kind === 'blob') {
        for (const side of [-1, 1]) {
          const e = sph(0.075 * s, furM, 12);
          e.scale.z = 0.5;
          at(e, side * 0.18 * s, 0.32 * s, 0, headCostume);
          at(new THREE.Mesh(new THREE.CircleGeometry(0.045 * s, 12), plain(look.belly, 0.9)), side * 0.18 * s, 0.32 * s, 0.04 * s, headCostume);
        }
      } else if (kind === 'rabbit') {
        for (const side of [-1, 1]) {
          const e = new THREE.Group();
          at(e, side * 0.09 * s, 0.3 * s, 0, headCostume);
          const ear = cap(0.05 * s, 0.32 * s, furM);
          ear.scale.z = 0.45;
          at(ear, 0, 0.2 * s, 0, e);
          const inner = cap(0.03 * s, 0.26 * s, plain('#ff9ac8', 0.8));
          inner.scale.z = 0.3;
          at(inner, 0, 0.2 * s, 0.02 * s, e);
          e.rotation.z = side * -0.15 + (side > 0 ? -0.35 : 0);
          if (side > 0 && (look.withered || id === 'springtrap')) e.rotation.x = 0.9;
        }
      } else if (kind === 'fox') {
        for (const side of [-1, 1]) {
          const e = cone(0.07 * s, 0.17 * s, furM, 4);
          at(e, side * 0.14 * s, 0.32 * s, -0.02 * s, headCostume).rotation.z = side * -0.25;
        }
      }
      // Eyes and brows.
      const eyeY = kind === 'bird' ? 0.15 * s : 0.15 * s;
      addEyes(eyeY, (kind === 'bird' ? 0.2 : 0.17) * s, (kind === 'bear' ? 0.095 : 0.085) * s, 0.052 * s, Boolean(look.slumped) || Boolean(look.shadow));
      for (const side of [-1, 1]) {
        at(box(0.07 * s, 0.015 * s, 0.02 * s, plain('#1a1a1a', 0.8)), side * 0.09 * s, 0.22 * s, 0.2 * s, headCostume).rotation.z = side * 0.25;
      }
      if (kind === 'fox' && !look.glossy) {
        const patch = new THREE.Mesh(new THREE.CircleGeometry(0.05 * s, 10), plain('#111', 0.8));
        at(patch, 0.09 * s, 0.27 * s, 0.2 * s, headCostume).rotation.z = 0.5;
      }
      if (look.glossy) for (const side of [-1, 1]) at(new THREE.Mesh(new THREE.CircleGeometry(0.035 * s, 12), plain('#ff7a9a', 0.5)), side * 0.15 * s, 0.05 * s, 0.22 * s, headCostume);
      // Arms.
      for (const [side, armG] of [
        [-1, armL],
        [1, armR],
      ] as [number, THREE.Group][]) {
        const sh = new THREE.Vector3(0, 0, 0);
        const el = new THREE.Vector3(side * 0.04 * s, -0.3 * s, 0.02 * s);
        const wr = new THREE.Vector3(side * 0.05 * s, -0.56 * s, 0.06 * s);
        const ac = new THREE.Group();
        ac.name = 'armCostume';
        armG.add(ac);
        seg(sh, el, (kind === 'bird' ? 0.07 : 0.085) * s, furM, ac);
        const bareForearm = look.withered && side === 1;
        if (!bareForearm) seg(el, wr, (kind === 'bird' ? 0.06 : 0.075) * s, furM, ac);
        else {
          const fe = frayedEnd(el.clone().add(new THREE.Vector3(0, -0.04 * s, 0)));
          armG.add(fe);
          sparkPoints.push(fe);
        }
        const hand = sph(0.075 * s, furM, 12);
        hand.scale.set(1, 1.1, 0.7);
        at(hand, wr.x, wr.y - 0.06 * s, wr.z, ac);
        if (kind === 'fox' && side === 1 && look.prop === 'hook') {
          hand.visible = false;
          const ph = new THREE.Group();
          at(ph, wr.x, wr.y - 0.08 * s, wr.z, armG);
          prop('hook', ph, s, look);
        } else if (side === 1 || look.prop === 'cupcake' || look.prop === 'tray') {
          if ((side === 1 && look.prop !== 'cupcake' && look.prop !== 'tray') || (side === -1 && (look.prop === 'cupcake' || look.prop === 'tray'))) {
            const ph = new THREE.Group();
            at(ph, wr.x, wr.y - 0.1 * s, wr.z + 0.04 * s, armG);
            prop(look.prop, ph, s, look);
          }
        }
        // Glimpse of the endo at the wrist.
        at(cyl(0.03 * s, 0.03 * s, 0.04 * s, plain('#2a2c30', 0.4, 0.9), 8), wr.x, wr.y + 0.01 * s, wr.z, armG);
      }
      if (kind === 'bear' && look.hat !== 'none') topHat(look.accent === '#111111' ? '#111111' : look.accent, headCostume, 0.35 * s, s, look.hat ?? 'top');
      if (look.hat === 'propeller') topHat('#2a5bd8', headCostume, 0.33 * s, s, 'propeller');
      if (kind !== 'bird') bowTie(kind === 'rabbit' ? look.accent : kind === 'bear' ? (id === 'golden' ? '#5a2a7a' : '#111111') : look.accent, costume, 1.48 * s, 0.24 * s, s);
      if (kind === 'bird') {
        const bib = new THREE.Mesh(new THREE.PlaneGeometry(0.34 * s, 0.34 * s), textured(`bib:${id}`, bibTex(id === 'toy_chica' ? "LET'S PARTY!!!" : id === 'chica' && look.fur === '#f2f2f2' ? 'MORE PIZZA!' : "LET'S EAT!!!")));
        at(bib, 0, 1.3 * s, 0.3 * s, costume).rotation.x = -0.15;
      }
      if (kind === 'fox') {
        // Torn pants.
        const pants = sph(0.3 * s, plain('#5a3a22', 0.95), 14);
        pants.scale.set(1, 0.6, 0.8);
        at(pants, 0, 0.9 * s, 0, costume);
      }
    } else if (kind === 'puppet') {
      const black = plain(look.fur, 0.9);
      const torso = cap(0.12 * s, 0.6 * s, black);
      at(torso, 0, 1.25 * s, 0, costume);
      for (let i = 0; i < 3; i++) at(sph(0.02 * s, plain('#ffffff', 0.4), 8), 0, (1.2 + i * 0.12) * s, 0.12 * s, costume);
      for (const side of [-1, 1]) {
        seg(new THREE.Vector3(side * 0.08 * s, 0.9 * s, 0), new THREE.Vector3(side * 0.09 * s, 0.1 * s, 0), 0.04 * s, black, costume);
        for (const y of [0.18, 0.24]) at(new THREE.Mesh(new THREE.TorusGeometry(0.045 * s, 0.012 * s, 5, 12), plain('#ffffff', 0.5)), side * 0.09 * s, y * s, 0, costume).rotation.x = Math.PI / 2;
      }
      for (const [side, armG] of [
        [-1, armL],
        [1, armR],
      ] as [number, THREE.Group][]) {
        seg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.06 * s, -0.75 * s, 0.05 * s), 0.035 * s, black, armG);
        at(new THREE.Mesh(new THREE.TorusGeometry(0.04 * s, 0.01 * s, 5, 12), plain('#fff', 0.5)), side * 0.055 * s, -0.68 * s, 0.045 * s, armG).rotation.x = Math.PI / 2;
        for (let f = 0; f < 4; f++) seg(new THREE.Vector3(side * 0.06 * s, -0.75 * s, 0.05 * s), new THREE.Vector3((side * 0.06 + (f - 1.5) * 0.02) * s, -0.92 * s, 0.07 * s), 0.008 * s, black, armG);
      }
      // Mask: smooth white face with painted features.
      const mask = sph(0.16 * s, plain('#f2eee4', 0.3), 22);
      mask.scale.set(0.9, 1.15, 0.8);
      at(mask, 0, 0.12 * s, 0.03 * s, headCostume);
      for (const side of [-1, 1]) {
        at(new THREE.Mesh(new THREE.CircleGeometry(0.035 * s, 14), plain('#d83a4a', 0.6)), side * 0.08 * s, 0.05 * s, 0.155 * s, headCostume);
        const tear = box(0.01 * s, 0.1 * s, 0.005 * s, plain('#7a3ac4', 0.6));
        at(tear, side * 0.06 * s, 0.08 * s, 0.158 * s, headCostume);
      }
      const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.05 * s, 0.008 * s, 5, 14, Math.PI), plain('#c41e1e', 0.5));
      at(mouth, 0, -0.01 * s, 0.15 * s, jawCostume).rotation.z = Math.PI;
      addEyes(0.15 * s, 0.11 * s, 0.06 * s, 0.035 * s, true);
    } else if (kind === 'human' || kind === 'small' || kind === 'clown') {
      buildHumanoid(look, s, costume, headCostume, armL, armR, furM, bellyM, accentM);
      addEyes(0.15 * s, 0.17 * s, 0.07 * s, 0.035 * s, kind !== 'clown' && look.shadow === true);
    } else if (kind === 'spider') {
      const core = sph(0.3 * s, furM, 18);
      at(core, 0, 1.3 * s, 0, costume);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const leg = seg(new THREE.Vector3(0, 1.3 * s, 0), new THREE.Vector3(Math.cos(a) * 0.9 * s, 0.1 * s, Math.sin(a) * 0.9 * s), 0.04 * s, plain('#2a2a2a', 0.5, 0.6), costume);
        void leg;
        at(new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.12 * s, 0.01 * s, 16), plain('#c8a830', 0.2, 1)), Math.cos(a) * 0.6 * s, 0.9 * s, Math.sin(a) * 0.6 * s, costume);
      }
      const face = sph(0.2 * s, plain('#f2f2f2', 0.4), 16);
      at(face, 0, 0.12 * s, 0.05 * s, headCostume);
      addEyes(0.15 * s, 0.2 * s, 0.07 * s, 0.04 * s);
    }
  } else {
    // Bare endo: its own eyes glow.
    for (const e of endo.eyes) eyes.push(e);
  }

  // Exposed endo wiring at tears for damaged characters.
  if (look.withered) {
    const wb = wireBundle([new THREE.Vector3(0.1 * s, 1.0 * s, 0.25 * s), new THREE.Vector3(0.15 * s, 0.8 * s, 0.22 * s), new THREE.Vector3(0.13 * s, 0.6 * s, 0.15 * s)], 5, 0.005 * s, 7);
    costume.add(wb);
    const fe = frayedEnd(new THREE.Vector3(0.13 * s, 0.6 * s, 0.15 * s));
    costume.add(fe);
    sparkPoints.push(fe);
  }
  if (id === 'golden') {
    for (const side of [-1, 1]) {
      const wb = wireBundle([new THREE.Vector3(side * 0.09 * s, 0.15 * s, 0.2 * s), new THREE.Vector3(side * 0.1 * s, 0.05 * s, 0.24 * s), new THREE.Vector3(side * 0.09 * s, -0.08 * s, 0.25 * s)], 3, 0.004 * s, side > 0 ? 1 : 3);
      headCostume.add(wb);
    }
  }

  root.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  setEndo(endoShown);

  // Slight asymmetry: nothing about them is quite right.
  const tiltSeed = id.length * 0.37;
  head.rotation.z = Math.sin(tiltSeed) * 0.08;

  let current: PoseName = 'idle';
  const rig: CharacterRig = {
    id,
    root,
    body,
    head,
    jaw,
    armL,
    armR,
    eyes,
    pupils,
    costume,
    endo,
    sparkPoints,
    sparkRate: ROSTER_BY_ID[id]?.sparkRate ?? 0.1,
    height: H,
    look,
    setEndo,
    pose(p) {
      current = p;
      body.rotation.set(0, 0, 0);
      body.position.set(0, 0, 0);
      head.rotation.set(0, 0, Math.sin(tiltSeed) * 0.08);
      armL.rotation.set(0, 0, 0.1);
      armR.rotation.set(0, 0, -0.1);
      jaw.rotation.x = 0;
      switch (p) {
        case 'stare':
          head.rotation.set(-0.15, 0, 0.18);
          break;
        case 'lean':
          body.rotation.x = 0.18;
          head.rotation.x = -0.25;
          armL.rotation.x = -0.4;
          armR.rotation.x = -0.4;
          break;
        case 'slumped':
          body.position.y = -0.85 * s;
          body.rotation.x = -0.25;
          head.rotation.set(0.55, 0.1, 0.25);
          armL.rotation.set(0.2, 0, 0.5);
          armR.rotation.set(0.2, 0, -0.5);
          break;
        case 'sitting':
          body.position.y = -0.6 * s;
          head.rotation.x = 0.2;
          break;
        case 'crawl':
          body.rotation.x = 1.3;
          body.position.set(0, 0.25 * s, -0.7 * s);
          head.rotation.x = -1.1;
          armL.rotation.x = -1.3;
          armR.rotation.x = -1.3;
          break;
        case 'walk':
          armL.rotation.x = 0.3;
          armR.rotation.x = -0.3;
          break;
        case 'lunge':
          body.rotation.x = 0.35;
          armL.rotation.set(-1.4, 0, 0.4);
          armR.rotation.set(-1.4, 0, -0.4);
          jaw.rotation.x = 0.55;
          break;
        default:
          break;
      }
    },
    setXray(on) {
      costume.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          const m = o.material as THREE.MeshStandardMaterial;
          if (on) {
            if (!o.userData.orig) o.userData.orig = m;
            o.material = XRAY;
          } else if (o.userData.orig) o.material = o.userData.orig as THREE.Material;
        }
      });
      headCostume.traverse((o) => {
        if (o instanceof THREE.Mesh && o.parent !== null) {
          if (on) {
            if (!o.userData.orig) o.userData.orig = o.material;
            o.material = XRAY;
          } else if (o.userData.orig) o.material = o.userData.orig as THREE.Material;
        }
      });
      setEndo(on || endoShown);
      for (const w of endo.wires) {
        const mat = w.material as THREE.MeshStandardMaterial;
        if (on) {
          if (!w.userData.orig) w.userData.orig = mat;
          w.material = new THREE.MeshStandardMaterial({ color: mat.color, emissive: mat.color, emissiveIntensity: 1.5 });
        } else if (w.userData.orig) w.material = w.userData.orig as THREE.Material;
      }
    },
    setEyesOnly(on) {
      // In pitch darkness only the pupils render.
      costume.visible = !on;
      for (const c of headCostume.children) c.visible = !on || pupils.includes(c as THREE.Mesh);
      for (const a of [armL, armR]) for (const c of a.children) if (!c.userData.endoPart) c.visible = !on;
      setEndo(!on && endoShown);
      // A bare endo in the dark still shows its eyes.
      if (on && !hasCostume) for (const e of endo.eyes) e.visible = true;
    },
    tick(t) {
      // Idle life: tiny head drift, occasional twitch, LED blink.
      if (current === 'slumped' || current === 'crawl') return;
      head.rotation.y = Math.sin(t * 0.3 + tiltSeed) * 0.04 + (Math.sin(t * 7.3 + tiltSeed * 9) > 0.995 ? 0.25 : 0);
      (endo.led.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * 6) > 0 ? 4 : 0.2;
    },
  };
  rig.pose(look.slumped ? 'slumped' : 'idle');
  return rig;
}

const XRAY = new THREE.MeshPhysicalMaterial({ color: '#5ad8ff', transparent: true, opacity: 0.15, roughness: 0.2, emissive: '#1a4a8a', emissiveIntensity: 0.6, depthWrite: false });

function buildHumanoid(
  look: CharacterLook,
  s: number,
  costume: THREE.Group,
  headCostume: THREE.Group,
  armL: THREE.Group,
  armR: THREE.Group,
  shirt: THREE.Material,
  pants: THREE.Material,
  accent: THREE.Material,
): void {
  const torso = cap(0.17 * s, 0.38 * s, shirt);
  at(torso, 0, 1.22 * s, 0, costume);
  for (const side of [-1, 1]) {
    seg(new THREE.Vector3(side * 0.09 * s, 0.95 * s, 0), new THREE.Vector3(side * 0.1 * s, 0.12 * s, 0.02 * s), 0.075 * s, pants, costume);
    const shoe = box(0.11 * s, 0.07 * s, 0.22 * s, plain('#151515', 0.5));
    at(shoe, side * 0.1 * s, 0.04 * s, 0.05 * s, costume);
  }
  const skin = plain(look.body === 'clown' ? '#f2e0d8' : '#e0b48c', 0.7);
  const hd = sph(0.14 * s, skin, 18);
  hd.scale.set(0.95, 1.1, 1);
  at(hd, 0, 0.13 * s, 0.03 * s, headCostume);
  for (const [side, armG] of [
    [-1, armL],
    [1, armR],
  ] as [number, THREE.Group][]) {
    seg(new THREE.Vector3(0, 0, 0), new THREE.Vector3(side * 0.03 * s, -0.3 * s, 0.02 * s), 0.06 * s, shirt, armG);
    seg(new THREE.Vector3(side * 0.03 * s, -0.3 * s, 0.02 * s), new THREE.Vector3(side * 0.04 * s, -0.55 * s, 0.06 * s), 0.05 * s, shirt, armG);
    at(sph(0.05 * s, skin, 10), side * 0.04 * s, -0.62 * s, 0.06 * s, armG);
  }
  if (look.body === 'clown') {
    for (const side of [-1, 1]) at(sph(0.07 * s, plain('#c41e1e', 0.8)), side * 0.13 * s, 0.22 * s, 0, headCostume);
    at(sph(0.03 * s, plain('#c41e1e', 0.5)), 0, 0.1 * s, 0.17 * s, headCostume);
  }
  if (look.hat === 'propeller') topHat('#2a5bd8', headCostume, 0.28 * s, s, 'propeller');
  if (look.prop === 'balloon') {
    const p = new THREE.Group();
    at(p, 0.04 * s, -0.66 * s, 0.06 * s, armR);
    prop('balloon', p, s, look);
  }
  void accent;
}
