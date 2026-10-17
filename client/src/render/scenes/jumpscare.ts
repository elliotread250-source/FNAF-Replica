import * as THREE from 'three';
import { buildCharacter, type CharacterRig } from '../characters/build';
import { store } from '../../store';

/** The money shot: a close-up lunge with a key light from below and a red rim. */
export class Jumpscare {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 20);
  private rig: CharacterRig | null = null;
  private t = 0;
  private dur = 1;
  private basePos = new THREE.Vector3();
  active = false;
  kind = '';

  constructor() {
    this.scene.background = new THREE.Color('#000');
    const key = new THREE.SpotLight('#ffe8d0', 40, 6, 0.9, 0.4, 1);
    key.position.set(0, -0.3, 1.2);
    key.target.position.set(0, 1.6, -0.5);
    this.scene.add(key, key.target);
    const rim = new THREE.PointLight('#ff2020', 30, 4, 2);
    rim.position.set(0.8, 2.2, -1.2);
    this.scene.add(rim);
    this.scene.add(new THREE.AmbientLight('#301010', 0.4));
    this.camera.position.set(0, 1.65, 1.2);
  }

  start(id: string, kind: string): number {
    if (this.rig) this.scene.remove(this.rig.root);
    const charId = kind === 'powerout' ? 'freddy' : id;
    this.rig = buildCharacter(charId, store.roster.mode);
    this.kind = kind;
    this.scene.add(this.rig.root);
    const h = this.rig.height;
    const fromSide = id === 'foxy' ? -1.2 : 0;
    this.basePos.set(fromSide, 1.65 - h * 0.82, -1.2);
    this.rig.root.position.copy(this.basePos);
    this.rig.pose(id === 'golden' ? 'lunge' : 'lunge');
    this.t = 0;
    this.dur = id === 'golden' ? 1.4 : id === 'puppet' ? 1.3 : 1.0;
    this.active = true;
    return this.dur;
  }

  /** Returns post uniforms (flash, aberration, shake) for this frame. */
  update(dt: number): { flash: number; aberration: number; done: boolean } {
    if (!this.rig || !this.active) return { flash: 0, aberration: 0, done: true };
    this.t += dt;
    const t = this.t;
    const reduced = store.settings.reducedJumpscares || store.settings.photosensitive;
    const r = this.rig;
    const h = r.height;
    let lunge = Math.min(1, t / 0.25);
    lunge = 1 - Math.pow(1 - lunge, 3);
    if (this.kind === 'puppet') lunge = t < 0.6 ? t / 0.6 * 0.4 : 0.4 + Math.min(1, (t - 0.6) / 0.12) * 0.6;
    if (this.kind === 'golden') lunge = 1;
    r.root.position.set(this.basePos.x * (1 - lunge), this.basePos.y + lunge * 0.05, this.basePos.z + lunge * 1.55);
    r.head.rotation.x = -0.3 + Math.sin(t * 40) * 0.05;
    r.jaw.rotation.x = 0.5 + Math.sin(t * 30) * 0.12;
    for (const p of r.pupils) p.rotation.z = t * 20;
    r.body.position.x = (Math.random() - 0.5) * 0.03;
    // Camera shake: 2 to 6 px equivalent at 60 Hz.
    const shake = reduced ? 0 : 0.015 + Math.random() * 0.03;
    this.camera.position.set((Math.random() - 0.5) * shake, 1.65 + (Math.random() - 0.5) * shake, 1.2);
    this.camera.lookAt(0, 1.6 - h * 0.05, -1);
    const flash = reduced ? 0 : t < 0.05 ? 1 : t < 0.1 ? 0.5 : 0;
    const done = t >= this.dur;
    if (done) this.active = false;
    return { flash, aberration: reduced ? 0.002 : 0.02, done };
  }
}
