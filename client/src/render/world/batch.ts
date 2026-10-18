import * as THREE from 'three';

/** Accumulates quads for one material, then bakes them into a single BufferGeometry. */
export class Batch {
  private pos: number[] = [];
  private nor: number[] = [];
  private uv: number[] = [];
  private idx: number[] = [];

  constructor(readonly material: THREE.Material) {}

  /** A quad from four corners (any winding); the normal decides which way it faces. */
  quad(c: [number, number, number][], n: [number, number, number], uv: [number, number][]): void {
    const base = this.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      this.pos.push(...c[i]);
      this.nor.push(...n);
      this.uv.push(...uv[i]);
    }
    const ax = c[1][0] - c[0][0];
    const ay = c[1][1] - c[0][1];
    const az = c[1][2] - c[0][2];
    const bx = c[2][0] - c[0][0];
    const by = c[2][1] - c[0][1];
    const bz = c[2][2] - c[0][2];
    const cx = ay * bz - az * by;
    const cy = az * bx - ax * bz;
    const cz = ax * by - ay * bx;
    const flip = cx * n[0] + cy * n[1] + cz * n[2] < 0;
    if (!flip) this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else this.idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }

  /** Face perpendicular to X at x, facing dir (+1/-1). UVs in world units / tile. */
  faceX(x: number, y1: number, y2: number, z1: number, z2: number, dir: 1 | -1, tile: number): void {
    this.quad(
      [[x, y1, z1], [x, y1, z2], [x, y2, z2], [x, y2, z1]],
      [dir, 0, 0],
      [[z1 / tile, y1 / tile], [z2 / tile, y1 / tile], [z2 / tile, y2 / tile], [z1 / tile, y2 / tile]],
    );
  }

  faceZ(z: number, y1: number, y2: number, x1: number, x2: number, dir: 1 | -1, tile: number): void {
    this.quad(
      [[x1, y1, z], [x2, y1, z], [x2, y2, z], [x1, y2, z]],
      [0, 0, dir],
      [[x1 / tile, y1 / tile], [x2 / tile, y1 / tile], [x2 / tile, y2 / tile], [x1 / tile, y2 / tile]],
    );
  }

  faceY(y: number, x1: number, x2: number, z1: number, z2: number, dir: 1 | -1, tile: number): void {
    this.quad(
      [[x1, y, z1], [x2, y, z1], [x2, y, z2], [x1, y, z2]],
      [0, dir, 0],
      [[x1 / tile, z1 / tile], [x2 / tile, z1 / tile], [x2 / tile, z2 / tile], [x1 / tile, z2 / tile]],
    );
  }

  get empty(): boolean {
    return this.idx.length === 0;
  }

  build(): THREE.Mesh | null {
    if (this.empty) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    const m = new THREE.Mesh(g, this.material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}

/** A set of batches keyed by material, for one room. */
export class BatchSet {
  private map = new Map<THREE.Material, Batch>();
  get(m: THREE.Material): Batch {
    let b = this.map.get(m);
    if (!b) {
      b = new Batch(m);
      this.map.set(m, b);
    }
    return b;
  }
  meshes(): THREE.Mesh[] {
    const out: THREE.Mesh[] = [];
    for (const b of this.map.values()) {
      const m = b.build();
      if (m) out.push(m);
    }
    return out;
  }
}
