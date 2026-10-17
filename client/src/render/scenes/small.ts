import * as THREE from 'three';
import { buildCharacter, type CharacterRig } from '../characters/build';
import { buildGuard } from '../characters/guard';
import { checkerFloor, confettiWall } from '../textures';
import { volumetricCone } from '../fx/effects';
import { store } from '../../store';

/** Title: the four core animatronics in a dim close-up, slow drifting camera, twitching heads. */
export class TitleScene {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 30);
  rigs: CharacterRig[] = [];
  private t = 0;
  private glitchFrame = -1;
  bobble = false;

  constructor() {
    this.scene.background = new THREE.Color('#000');
    this.scene.fog = new THREE.FogExp2('#000', 0.18);
    const f = checkerFloor(1);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 8), new THREE.MeshStandardMaterial({ map: f.map, normalMap: f.normal }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), new THREE.MeshStandardMaterial({ map: confettiWall(2, '#1a1428') }));
    wall.position.set(0, 2.5, -2);
    this.scene.add(wall);
    const ids = ['bonnie', 'freddy', 'chica', 'foxy'];
    ids.forEach((id, i) => {
      const r = buildCharacter(id, store.roster.mode);
      r.root.position.set(-2.1 + i * 1.4, 0, -0.6 + (i === 1 ? -0.2 : 0));
      r.root.rotation.y = (1.5 - i) * 0.12;
      this.scene.add(r.root);
      this.rigs.push(r);
    });
    const key = new THREE.SpotLight('#ffd8b0', 70, 12, 0.5, 0.7, 1.5);
    key.position.set(0.5, 4.5, 2.5);
    key.target.position.set(0, 1.5, -0.6);
    key.castShadow = true;
    this.scene.add(key, key.target);
    const cone = volumetricCone('#ffd8b0', 5, 1.6, 0.08);
    cone.position.copy(key.position);
    cone.lookAt(new THREE.Vector3(0, -3, -1));
    cone.rotateX(-Math.PI / 2);
    this.scene.add(cone);
    this.scene.add(new THREE.AmbientLight('#203050', 0.15));
    if (Math.random() < 1 / 20) this.glitchFrame = 60 + Math.floor(Math.random() * 300);
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    this.camera.position.set(Math.sin(t * 0.07) * 0.6, 1.75 + Math.sin(t * 0.11) * 0.1, 3.6 + Math.sin(t * 0.05) * 0.3);
    this.camera.lookAt(0, 1.55, -0.6);
    for (const [i, r] of this.rigs.entries()) {
      r.tick(t + i * 3);
      const s = this.bobble ? 1 : 1;
      r.head.scale.setScalar(this.bobble ? 2.2 : s);
    }
    // Very rarely, one of them is an endoskeleton for a single frame.
    const frame = Math.floor(t * 60);
    const g = frame === this.glitchFrame;
    if (g !== this.rigs[2].userGlitch) {
      this.rigs[2].costume.visible = !g;
      this.rigs[2].setEndo(g);
      this.rigs[2].userGlitch = g;
    }
  }
}

/** A turntable: guard (Locker Room) or any roster character (Archives, with x-ray). */
export class Turntable {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(35, 1, 0.1, 20);
  readonly pivot = new THREE.Group();
  rig: CharacterRig | null = null;
  yaw = 0.4;
  drag = false;

  constructor() {
    this.scene.background = new THREE.Color('#050308');
    this.scene.add(this.pivot);
    const key = new THREE.SpotLight('#ffe0c0', 60, 10, 0.6, 0.6, 1.4);
    key.position.set(1.5, 4, 3);
    key.target.position.set(0, 1, 0);
    key.castShadow = true;
    this.scene.add(key, key.target);
    const rim = new THREE.PointLight('#5a7aff', 20, 6, 2);
    rim.position.set(-2, 2, -2);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight('#303040', 0.6));
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.06, 32), new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.4, metalness: 0.6 }));
    disc.position.y = -0.03;
    disc.receiveShadow = true;
    this.scene.add(disc);
    this.camera.position.set(0, 1.3, 4.2);
    this.camera.lookAt(0, 1, 0);
  }

  showGuard(equipped: Record<string, string>): void {
    this.clear();
    const g = buildGuard(equipped);
    this.pivot.add(g.root);
    this.camera.position.set(0, 1.1, 3.4);
    this.camera.lookAt(0, 0.95, 0);
  }

  showCharacter(id: string, xray = false): CharacterRig {
    this.clear();
    this.rig = buildCharacter(id, store.roster.mode);
    this.pivot.add(this.rig.root);
    this.rig.setXray(xray);
    const h = this.rig.height;
    this.camera.position.set(0, h * 0.6, h * 2.2);
    this.camera.lookAt(0, h * 0.5, 0);
    return this.rig;
  }

  clear(): void {
    while (this.pivot.children.length) this.pivot.remove(this.pivot.children[0]);
    this.rig = null;
  }

  update(dt: number, t: number): void {
    if (!this.drag) this.yaw += dt * 0.35;
    this.pivot.rotation.y = this.yaw;
    this.rig?.tick(t);
    if (this.rig) {
      for (const w of this.rig.endo.wires) {
        const m = w.material as THREE.MeshStandardMaterial;
        if (m.emissiveIntensity !== undefined && m.emissive && m.emissive.getHex() !== 0) m.emissiveIntensity = 1 + Math.sin(t * 8 + w.id) * 0.8;
      }
    }
  }
}
