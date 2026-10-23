import type { Collider } from './types';

/** True for rotations that are whole quarter turns (to within a hundredth of a degree). */
export function isQuarterTurn(ryDeg: number): boolean {
  const r = ((ryDeg % 90) + 90) % 90;
  return r < 0.01 || r > 89.99;
}

/** cos/sin rounded to 9 places, so every JS engine (server and any browser) builds the identical box. */
const trig = (ryDeg: number): [number, number] => {
  const a = (ryDeg * Math.PI) / 180;
  return [Math.round(Math.cos(a) * 1e9) / 1e9, Math.round(Math.sin(a) * 1e9) / 1e9];
};

/** World-axis bounds of a rotated w x d rectangle. */
export function rotatedExtent(w: number, d: number, ryDeg: number): [number, number] {
  const [c, s] = trig(ryDeg);
  return [Math.abs(c) * w + Math.abs(s) * d, Math.abs(s) * w + Math.abs(c) * d];
}

/**
 * Collider for a w x d rectangle centred on (cx, cz) and turned `ryDeg` about Y the way the renderer turns it
 * (three.js: local (x, z) -> (x cos + z sin, -x sin + z cos)). Quarter turns give a plain box. Any other angle
 * gives an oriented box (`rot`): its x1..z2 are the bounding box for the spatial hash, and the circle, push-out,
 * ray and ground tests in collision.ts use the true rectangle.
 */
export function rotatedBoxes(cx: number, cz: number, w: number, d: number, ryDeg: number, y1: number, y2: number, base: Partial<Collider> = {}): Collider[] {
  if (isQuarterTurn(ryDeg)) {
    const q = Math.round((((ryDeg % 360) + 360) % 360) / 90) % 4;
    const [rw, rd] = q % 2 ? [d, w] : [w, d];
    return [{ kind: 'prop', ...base, x1: cx - rw / 2, x2: cx + rw / 2, z1: cz - rd / 2, z2: cz + rd / 2, y1, y2 }];
  }
  const [c, s] = trig(ryDeg);
  const [ex, ez] = rotatedExtent(w, d, ryDeg);
  return [{ kind: 'prop', ...base, x1: cx - ex / 2, x2: cx + ex / 2, z1: cz - ez / 2, z2: cz + ez / 2, y1, y2, rot: { cx, cz, hw: w / 2, hd: d / 2, c, s } }];
}
