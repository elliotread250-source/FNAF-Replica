import * as THREE from 'three';
import type { StyleId } from '@fnaf/shared';
import { checkerFloor, confettiWall, curtainTex, dirtTex, metalTex, officeFloor, officeWall, tileWall, woodTex } from '../textures';

export interface StyleMats {
  wall: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  ceil: THREE.MeshStandardMaterial;
  /** World metres per texture repeat. */
  wallTile: number;
  floorTile: number;
}

/** Textures from the shared generators, cloned so the world can use world-unit UVs (repeat 1). */
function world(t: THREE.Texture): THREE.Texture {
  const c = t.clone();
  c.repeat.set(1, 1);
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.needsUpdate = true;
  return c;
}

function mat(map: THREE.Texture | null, color: string, rough = 0.9, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map, color, roughness: rough, metalness: 0, ...extra });
}

const dirt = () => world(dirtTex(15));

/** A 3 m x 6 m wall texture on world UVs (one V unit = 3 m), so walls up to 6 m never repeat the band. */
function tall(t: THREE.Texture): THREE.Texture {
  const c = world(t);
  c.repeat.set(1, 0.5);
  return c;
}

export function makeStyles(): Record<StyleId, StyleMats> {
  const checker = checkerFloor(1);
  const checkerMap = world(checker.map);
  const checkerRough = world(checker.rough);
  const brushed = world(metalTex(5, 'brushed', '#8a9096').map);
  const tile = world(tileWall(3, '#a6c4bc'));
  const tileFloor = world(tileWall(8, '#788884'));
  const wood = world(woodTex(7, '#6a4426'));
  const curtain = world(curtainTex('#3a1450', true));
  const confetti = (seed: number, base: string) => world(confettiWall(seed, base));

  const floorChecker = () => mat(checkerMap, '#ffffff', 0.55, { roughnessMap: checkerRough });
  const ceilDark = (c = '#1b1618') => mat(null, c, 1);
  const ceilTiles = () => mat(dirt(), '#8a8478', 1);

  const S = (wall: THREE.MeshStandardMaterial, floor: THREE.MeshStandardMaterial, ceil: THREE.MeshStandardMaterial, wallTile = 3, floorTile = 4): StyleMats => ({ wall, floor, ceil, wallTile, floorTile });

  return {
    // The 2014 public rooms and halls: grimy grey block over a black-and-white checker band and red trim.
    dining: S(mat(tall(officeWall(34, '#55525e', true, true)), '#ffffff', 0.92), floorChecker(), ceilDark('#14100e')),
    lobby: S(mat(confetti(3, '#30445c'), '#ffffff'), floorChecker(), ceilTiles()),
    hall: S(mat(tall(officeWall(33, '#4e4c52', false, true)), '#ffffff', 0.92), floorChecker(), ceilTiles()),
    tile: S(mat(tile, '#ffffff', 0.4), mat(tileFloor, '#ffffff', 0.4), ceilTiles(), 2.4, 2.4),
    steel: S(mat(brushed, '#ffffff', 0.45, { metalness: 0.5 }), mat(tileFloor, '#b0b4b8', 0.5), ceilTiles(), 2.4, 2.4),
    concrete: S(mat(dirt(), '#7a766e', 1), mat(dirt(), '#5a5852', 0.95), mat(dirt(), '#4a4842', 1), 3, 3),
    // Checker band, red trim and grimy grey block above, as in the 2014 office; 0.3 m speckled floor tiles.
    office: S(mat(world(officeWall()), '#ffffff', 0.92), mat(world(officeFloor()), '#ffffff', 0.75), ceilTiles(), 3, 2.4),
    party1: S(mat(confetti(5, '#2a3a6a'), '#ffffff'), floorChecker(), ceilTiles()),
    party2: S(mat(confetti(6, '#6a4a2a'), '#ffffff'), mat(wood, '#ffffff', 0.7), ceilTiles(), 3, 2),
    party3: S(mat(confetti(7, '#7a3a5a'), '#ffffff'), floorChecker(), ceilTiles()),
    party4: S(mat(confetti(8, '#2a2a22'), '#ffffff'), mat(wood, '#9a9a9a', 0.8), ceilTiles(), 3, 2),
    stage: S(mat(curtain, '#ffffff', 0.9), mat(wood, '#ffffff', 0.6), ceilDark('#0e0a0c'), 3, 2),
    arcade: S(mat(dirt(), '#241438', 1), mat(null, '#140c24', 0.9), ceilDark('#0a0612')),
    wood: S(mat(wood, '#ffffff', 0.8), mat(wood, '#ffffff', 0.7), ceilTiles(), 2, 2),
    play: S(mat(dirt(), '#c46a9a', 0.9), mat(null, '#3a7ab8', 0.9), ceilTiles()),
    basement: S(mat(dirt(), '#58565a', 1), mat(dirt(), '#3e3d40', 0.95), mat(dirt(), '#2e2d30', 1), 3, 3),
    dirty: S(mat(dirt(), '#7d7566', 1), mat(dirt(), '#565048', 0.95), ceilTiles(), 3, 3),
    prize: S(mat(confetti(9, '#7a3a68'), '#ffffff'), floorChecker(), ceilDark('#1a1018')),
    cove: S(mat(curtain, '#ffffff', 0.95), mat(wood, '#ffffff', 0.7), ceilDark('#120a18'), 3, 2),
  };
}

export const TRIM = () => new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 0.9 });
export const EXTERIOR = () => new THREE.MeshStandardMaterial({ color: '#3a2c26', roughness: 1, map: dirt() });
