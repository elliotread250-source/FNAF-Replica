import * as THREE from 'three';
import { endoMetal, circuit, glow, plain } from '../materials';

const WIRE_COLORS = ['#b01818', '#151515', '#d8b018', '#1a40b0', '#1a8a2a'];

export interface EndoRig {
  group: THREE.Group;
  head: THREE.Group;
  jaw: THREE.Group;
  eyes: THREE.Mesh[];
  armL: THREE.Group;
  armR: THREE.Group;
  /** Frayed wire ends (local to the group) where sparks come from. */
  sparkPoints: THREE.Object3D[];
  wires: THREE.Mesh[];
  led: THREE.Mesh;
}

const sphere = (r: number, m: THREE.Material, seg = 12) => new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4)), m);
const cyl = (r1: number, r2: number, h: number, m: THREE.Material, seg = 10) => new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m);
const box = (w: number, h: number, d: number, m: THREE.Material) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);

/** A wire bundle following a sagging curve between points. */
export function wireBundle(points: THREE.Vector3[], count = 5, radius = 0.006, seed = 1): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const off = new THREE.Vector3(Math.sin(i * 2.1 + seed) * 0.012, Math.cos(i * 1.7 + seed) * 0.012, Math.sin(i * 3.3) * 0.01);
    const pts = points.map((p, k) => {
      const sag = k > 0 && k < points.length - 1 ? -0.015 * Math.sin(i + k) : 0;
      return p.clone().add(off).add(new THREE.Vector3(0, sag, 0));
    });
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), radius, 5, false);
    const m = new THREE.Mesh(geo, plain(WIRE_COLORS[(i + seed) % WIRE_COLORS.length], 0.5));
    m.castShadow = false;
    g.add(m);
  }
  // Cable ties.
  for (let k = 1; k < points.length - 1; k++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.004, 4, 10), plain('#e8e8e0', 0.6));
    t.position.copy(points[k]);
    t.lookAt(points[k + 1]);
    g.add(t);
  }
  return g;
}

/** Frayed copper strands at a torn wire end. */
export function frayedEnd(at: THREE.Vector3): THREE.Object3D {
  const o = new THREE.Group();
  o.position.copy(at);
  for (let i = 0; i < 6; i++) {
    const s = cyl(0.0015, 0.0008, 0.05, plain('#d88a3a', 0.3, 0.9), 3);
    s.rotation.set(Math.random() * 1.6 - 0.8, 0, Math.random() * 1.6 - 0.8);
    s.position.y = -0.02;
    o.add(s);
  }
  return o;
}

/** The parametric endoskeleton: every animatronic is built over one of these. */
export function buildEndo(height = 1.9, eyeColor = '#ff2a2a', color = '#3a3d42'): EndoRig {
  const s = height / 1.9;
  const M = endoMetal(color);
  const dark = plain('#1a1b1e', 0.5, 0.8);
  const g = new THREE.Group();
  g.name = 'endo';
  const sparkPoints: THREE.Object3D[] = [];
  const wires: THREE.Mesh[] = [];

  // Spine: stacked cylinders with disc spacers.
  for (let i = 0; i < 9; i++) {
    const v = cyl(0.03 * s, 0.03 * s, 0.05 * s, M);
    v.position.set(0, (0.95 + i * 0.065) * s, -0.04 * s);
    g.add(v);
    const d = cyl(0.045 * s, 0.045 * s, 0.01 * s, dark);
    d.position.set(0, (0.98 + i * 0.065) * s, -0.04 * s);
    g.add(d);
  }
  // Ribcage.
  for (let i = 0; i < 5; i++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry((0.13 - i * 0.008) * s, 0.008 * s, 5, 18, Math.PI * 1.4), M);
    r.rotation.x = Math.PI / 2;
    r.rotation.z = Math.PI * 0.8;
    r.position.set(0, (1.25 + i * 0.06) * s, 0);
    g.add(r);
  }
  // Pelvis.
  const pelvis = box(0.3 * s, 0.08 * s, 0.15 * s, M);
  pelvis.position.y = 0.92 * s;
  g.add(pelvis);
  // Circuit boards and battery with a blinking LED.
  const board = box(0.16 * s, 0.12 * s, 0.01 * s, circuit());
  board.position.set(0, 1.35 * s, 0.03 * s);
  g.add(board);
  const bat = box(0.1 * s, 0.14 * s, 0.06 * s, plain('#2a2a1a', 0.5, 0.3));
  bat.position.set(0.06 * s, 1.1 * s, 0);
  g.add(bat);
  const led = sphere(0.008 * s, glow('#30ff60', 4), 6);
  led.position.set(0.06 * s, 1.18 * s, 0.031 * s);
  g.add(led);

  // Head.
  const head = new THREE.Group();
  head.position.set(0, 1.62 * s, 0);
  g.add(head);
  const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.2 * s, 0.17 * s, 0.22 * s, 2, 2, 2), M);
  cranium.position.y = 0.1 * s;
  head.add(cranium);
  const backBoard = box(0.12 * s, 0.08 * s, 0.01 * s, circuit());
  backBoard.position.set(0, 0.12 * s, -0.115 * s);
  head.add(backBoard);
  // Eyes on stalks.
  const eyes: THREE.Mesh[] = [];
  for (const x of [-0.055, 0.055]) {
    const stalk = cyl(0.008 * s, 0.008 * s, 0.06 * s, dark, 6);
    stalk.rotation.x = Math.PI / 2;
    stalk.position.set(x * s, 0.1 * s, 0.1 * s);
    head.add(stalk);
    const eb = sphere(0.035 * s, plain('#d8d4c8', 0.2), 12);
    eb.position.set(x * s, 0.1 * s, 0.13 * s);
    head.add(eb);
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.014 * s, 12), glow(eyeColor, 5));
    iris.position.set(x * s, 0.1 * s, 0.166 * s);
    head.add(iris);
    eyes.push(iris);
  }
  // Jaw with hydraulic pistons and metal teeth.
  const jaw = new THREE.Group();
  jaw.position.set(0, 0.02 * s, -0.05 * s);
  head.add(jaw);
  const jawPlate = box(0.18 * s, 0.03 * s, 0.2 * s, M);
  jawPlate.position.set(0, -0.02 * s, 0.11 * s);
  jaw.add(jawPlate);
  for (let i = 0; i < 7; i++) {
    for (const [y, part] of [
      [0.005, jaw],
      [0.035, head],
    ] as [number, THREE.Group][]) {
      const tooth = box(0.018 * s, 0.022 * s, 0.012 * s, plain('#b8b4a8', 0.4, 0.6));
      tooth.position.set((-0.06 + i * 0.02) * s, y * s, (part === jaw ? 0.2 : 0.15) * s);
      part.add(tooth);
    }
  }
  for (const x of [-0.1, 0.1]) {
    const p = cyl(0.008 * s, 0.008 * s, 0.1 * s, dark, 6);
    p.rotation.x = 0.6;
    p.position.set(x * s, 0.04 * s, 0.02 * s);
    head.add(p);
  }

  // Limbs with ball joints and servo housings.
  const limb = (from: THREE.Vector3, to: THREE.Vector3, r: number) => {
    const len = from.distanceTo(to);
    const m = cyl(r, r, len, M, 8);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.lookAt(to);
    m.rotateX(Math.PI / 2);
    return m;
  };
  const joint = (p: THREE.Vector3, r: number) => {
    const j = new THREE.Group();
    j.position.copy(p);
    j.add(sphere(r, M, 10));
    const servo = box(r * 1.4, r * 1.2, r * 1.2, dark);
    servo.position.x = r * 1.1;
    j.add(servo);
    const screw = cyl(r * 0.3, r * 0.3, r * 0.2, plain('#9a9a9a', 0.3, 1), 6);
    screw.rotation.z = Math.PI / 2;
    screw.position.x = r * 1.85;
    j.add(screw);
    return j;
  };
  const arm = (side: number) => {
    const a = new THREE.Group();
    a.position.set(side * 0.2 * s, 1.5 * s, 0);
    const sh = new THREE.Vector3(0, 0, 0);
    const el = new THREE.Vector3(side * 0.04 * s, -0.3 * s, 0.02 * s);
    const wr = new THREE.Vector3(side * 0.05 * s, -0.58 * s, 0.06 * s);
    a.add(joint(sh, 0.04 * s), limb(sh, el, 0.022 * s), joint(el, 0.032 * s), limb(el, wr, 0.018 * s), joint(wr, 0.025 * s));
    // Fingers: four, three segments each.
    for (let f = 0; f < 4; f++) {
      let base = wr.clone().add(new THREE.Vector3((f - 1.5) * 0.018 * s, -0.03 * s, 0.01 * s));
      for (let k = 0; k < 3; k++) {
        const tip = base.clone().add(new THREE.Vector3(0, -0.03 * s, 0.01 * s * k));
        a.add(limb(base, tip, 0.006 * s));
        const kn = sphere(0.008 * s, M, 6);
        kn.position.copy(base);
        a.add(kn);
        base = tip;
      }
    }
    const wb = wireBundle([sh.clone(), el.clone().add(new THREE.Vector3(0, 0, 0.03 * s)), wr.clone()], 4, 0.004 * s, side > 0 ? 2 : 3);
    a.add(wb);
    wb.traverse((o) => o instanceof THREE.Mesh && wires.push(o));
    return a;
  };
  const armL = arm(-1);
  const armR = arm(1);
  g.add(armL, armR);
  for (const side of [-1, 1]) {
    const hip = new THREE.Vector3(side * 0.11 * s, 0.9 * s, 0);
    const knee = new THREE.Vector3(side * 0.12 * s, 0.48 * s, 0.03 * s);
    const ankle = new THREE.Vector3(side * 0.12 * s, 0.08 * s, 0);
    g.add(joint(hip, 0.045 * s), limb(hip, knee, 0.028 * s), joint(knee, 0.038 * s), limb(knee, ankle, 0.024 * s), joint(ankle, 0.03 * s));
    const foot = box(0.1 * s, 0.03 * s, 0.22 * s, M);
    foot.position.set(side * 0.12 * s, 0.03 * s, 0.06 * s);
    g.add(foot);
    for (let t = 0; t < 3; t++) {
      const toe = box(0.025 * s, 0.025 * s, 0.05 * s, M);
      toe.position.set((side * 0.12 + (t - 1) * 0.03) * s, 0.025 * s, 0.19 * s);
      g.add(toe);
    }
    const lw = wireBundle([hip, knee.clone().add(new THREE.Vector3(0, 0, 0.04 * s)), ankle], 3, 0.004 * s, side > 0 ? 4 : 5);
    g.add(lw);
    lw.traverse((o) => o instanceof THREE.Mesh && wires.push(o));
  }
  // Spine bundle and neck wires, plus one frayed end per shoulder.
  const spineWires = wireBundle(
    [new THREE.Vector3(0, 0.95 * s, -0.08 * s), new THREE.Vector3(0.02, 1.25 * s, -0.1 * s), new THREE.Vector3(0, 1.55 * s, -0.08 * s), new THREE.Vector3(0, 1.68 * s, -0.1 * s)],
    7,
    0.005 * s,
    6,
  );
  spineWires.traverse((o) => o instanceof THREE.Mesh && wires.push(o));
  g.add(spineWires);
  for (const side of [-1, 1]) {
    const fe = frayedEnd(new THREE.Vector3(side * 0.2 * s, 1.52 * s, 0.05 * s));
    g.add(fe);
    sparkPoints.push(fe);
  }
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
    // Tag the metal itself, so a costume can hide the endo without hiding the head and arms it hangs on.
    if (o !== g && o !== head && o !== jaw && o !== armL && o !== armR) o.userData.endoPart = true;
  });
  for (const e of eyes) e.userData.endoEye = true;
  return { group: g, head, jaw, eyes, armL, armR, sparkPoints, wires, led };
}
