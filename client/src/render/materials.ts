import * as THREE from 'three';
import { circuitTex, dirtTex, furTex, metalTex } from './textures';

const mats = new Map<string, THREE.Material>();

function memo<T extends THREE.Material>(key: string, make: () => T): T {
  const m = mats.get(key) as T | undefined;
  if (m) return m;
  const n = make();
  mats.set(key, n);
  return n;
}

export function fur(color: string, wear = 0.5, glossy = false): THREE.MeshStandardMaterial {
  return memo(`fur:${color}:${wear}:${glossy}`, () => {
    if (glossy) {
      return new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15, metalness: 0 });
    }
    const t = furTex('#ffffff', Math.floor(wear * 10) + 1, wear);
    return new THREE.MeshStandardMaterial({ color, map: t.map, normalMap: t.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.95, metalness: 0 });
  });
}

export function plain(color: string, roughness = 0.7, metalness = 0, emissive?: string, emissiveIntensity = 1): THREE.MeshStandardMaterial {
  return memo(`plain:${color}:${roughness}:${metalness}:${emissive}:${emissiveIntensity}`, () =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive: emissive ?? '#000000', emissiveIntensity }),
  );
}

export function endoMetal(color = '#3a3d42'): THREE.MeshStandardMaterial {
  return memo(`endo:${color}`, () => {
    const t = metalTex(21, 'scratched', color);
    return new THREE.MeshStandardMaterial({ color: '#ffffff', map: t.map, roughnessMap: t.rough, normalMap: t.normal, metalness: 0.9, roughness: 0.35 });
  });
}

export function circuit(): THREE.MeshStandardMaterial {
  return memo('circuit', () => new THREE.MeshStandardMaterial({ map: circuitTex(), roughness: 0.5, metalness: 0.2 }));
}

export function eyeWhite(): THREE.MeshPhysicalMaterial {
  return memo('eyewhite', () => new THREE.MeshPhysicalMaterial({ color: '#e8e4dc', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 })) as THREE.MeshPhysicalMaterial;
}

export function glow(color: string, intensity = 3): THREE.MeshStandardMaterial {
  return memo(`glow:${color}:${intensity}`, () => new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity, roughness: 1 }));
}

export function dirty(color: string, roughness = 0.8): THREE.MeshStandardMaterial {
  return memo(`dirty:${color}:${roughness}`, () => new THREE.MeshStandardMaterial({ color, map: dirtTex(), roughness }));
}

export function textured(key: string, map: THREE.Texture, opts: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return memo(`tex:${key}`, () => new THREE.MeshStandardMaterial({ map, roughness: 0.85, ...opts }));
}
