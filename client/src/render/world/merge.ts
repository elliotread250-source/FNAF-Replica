import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Bake a group of static meshes into one mesh per material, in the group's parent space. Set dressing is built
 * from hundreds of small boxes and cylinders; drawn one by one that was ~1,000 draw calls in the dining hall.
 * Instanced meshes and anything marked `userData.dynamic` are left alone. Returns the replacement group.
 */
export function mergeStatic(src: THREE.Group): THREE.Group {
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
  const buckets = new Map<THREE.Material, { geos: THREE.BufferGeometry[]; shadow: boolean }>();
  const keep: THREE.Object3D[] = [];
  // Walk the tree by hand so a dynamic object's children stay with it (Object3D.traverse can't skip subtrees).
  const visit = (o: THREE.Object3D, fn: (o: THREE.Object3D) => void): void => {
    fn(o);
    if (o.userData.dynamic) return;
    for (const c of [...o.children]) visit(c, fn);
  };
  visit(src, (o) => {
    if (o === src) return;
    if (o.userData.dynamic) {
      keep.push(o);
      return;
    }
    if (!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || Array.isArray(o.material)) {
      if (o instanceof THREE.InstancedMesh || (o instanceof THREE.Mesh && Array.isArray(o.material))) keep.push(o);
      return;
    }
    let g = (o.geometry as THREE.BufferGeometry).clone();
    if (g.index) g = g.toNonIndexed();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(name)) g.deleteAttribute(name);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count as number) * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const b = buckets.get(o.material as THREE.Material) ?? { geos: [], shadow: false };
    b.geos.push(g);
    b.shadow ||= o.castShadow;
    buckets.set(o.material as THREE.Material, b);
  });
  const out = new THREE.Group();
  out.name = src.name;
  out.position.copy(src.position);
  out.quaternion.copy(src.quaternion);
  out.scale.copy(src.scale);
  for (const [mat, b] of buckets) {
    // Vertex colours only survive if every piece has them.
    const withColor = b.geos.every((g) => g.attributes.color);
    if (!withColor) for (const g of b.geos) if (g.attributes.color) g.deleteAttribute('color');
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = b.shadow;
    m.receiveShadow = true;
    out.add(m);
  }
  for (const o of keep) {
    // Re-parent with its world transform kept.
    const world = o.matrixWorld.clone();
    o.removeFromParent();
    out.add(o);
    o.matrix.multiplyMatrices(inv, world);
    o.matrix.decompose(o.position, o.quaternion, o.scale);
  }
  return out;
}
