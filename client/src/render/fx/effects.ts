import * as THREE from 'three';
import { glowSprite } from '../textures';
import { store } from '../../store';

/** Volumetric cone: additive, fades from the apex and at grazing angles, with scrolling noise for dust. */
export function volumetricCone(color: THREE.ColorRepresentation, length: number, radius: number, intensity = 0.5): THREE.Mesh {
  const geo = new THREE.ConeGeometry(radius, length, 32, 1, true);
  geo.translate(0, -length / 2, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, time: { value: 0 }, intensity: { value: intensity }, len: { value: length } },
    vertexShader: /* glsl */ `
      varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
      void main(){ vPos = position; vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0); vView = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color; uniform float time, intensity, len; varying vec3 vPos; varying vec3 vNormal; varying vec3 vView;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      float noise(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        float along = clamp(-vPos.y / len, 0.0, 1.0);
        float fres = pow(abs(dot(vNormal, vView)), 1.5);
        float dust = 0.6 + 0.4 * noise(vPos * 3.0 + vec3(0.0, time * 0.15, time * 0.1));
        float a = intensity * (1.0 - along) * fres * dust;
        gl_FragColor = vec4(color * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 10;
  m.userData.volumetric = true;
  return m;
}

/** Dust motes drifting inside a light cone. */
export function dustMotes(count: number, size: THREE.Vector3): THREE.Points {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * size.x;
    pos[i * 3 + 1] = Math.random() * size.y;
    pos[i * 3 + 2] = (Math.random() - 0.5) * size.z;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: 0.012, map: glowSprite(), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, color: '#fff4dc' });
  const p = new THREE.Points(geo, mat);
  p.userData.drift = size;
  return p;
}

export function driftMotes(p: THREE.Points, t: number): void {
  const pos = p.geometry.getAttribute('position') as THREE.BufferAttribute;
  const size = p.userData.drift as THREE.Vector3;
  for (let i = 0; i < pos.count; i++) {
    let y = pos.getY(i) + Math.sin(t * 0.5 + i) * 0.0006 - 0.0004;
    if (y < 0) y = size.y;
    pos.setY(i, y);
    pos.setX(i, pos.getX(i) + Math.sin(t * 0.3 + i * 1.3) * 0.0004);
  }
  pos.needsUpdate = true;
}

/** Light flicker: layered noise plus random full-off stutters. */
export class Flicker {
  private off = 0;
  constructor(
    public light: THREE.Light,
    public base: number,
    public rate = 0.02,
  ) {}
  /** Returns true while the light is in a dropout (for buzz audio sync). */
  update(dt: number, t: number, extra = 0): boolean {
    if (store.settings.photosensitive) {
      this.light.intensity = this.base;
      return false;
    }
    if (this.off > 0) {
      this.off -= dt;
      this.light.intensity = 0;
      return true;
    }
    if (Math.random() < (this.rate + extra) * dt * 60) this.off = 0.03 + Math.random() * 0.17;
    const n = 0.85 + 0.1 * Math.sin(t * 13.1) * Math.sin(t * 7.7) + 0.05 * Math.sin(t * 31);
    this.light.intensity = this.base * n;
    return false;
  }
}

interface Spark {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  max: number;
}

/** Spark bursts with a pooled point light (never allocate lights at runtime: it recompiles shaders). */
export class SparkSystem {
  readonly points: THREE.Points;
  private sparks: Spark[] = [];
  private lights: THREE.PointLight[] = [];
  private lightLife: number[] = [];
  private max = 200;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.max * 3), 3));
    const mat = new THREE.PointsMaterial({ size: 0.03, map: glowSprite(), color: '#fff2a0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight('#ffe8a0', 0, 2.5, 2);
      scene.add(l);
      this.lights.push(l);
      this.lightLife.push(0);
    }
  }

  burst(at: THREE.Vector3, n = 16): void {
    if (store.settings.photosensitive) n = Math.min(n, 4);
    for (let i = 0; i < n && this.sparks.length < this.max; i++) {
      this.sparks.push({
        pos: at.clone(),
        vel: new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 2, (Math.random() - 0.5) * 2.5),
        life: 0,
        max: 0.2 + Math.random() * 0.4,
      });
    }
    const idx = this.lightLife.indexOf(Math.min(...this.lightLife));
    this.lights[idx].position.copy(at);
    this.lights[idx].intensity = store.settings.photosensitive ? 0.3 : 2.5;
    this.lightLife[idx] = 0.08;
  }

  update(dt: number): void {
    this.sparks = this.sparks.filter((s) => (s.life += dt) < s.max);
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.max; i++) {
      const s = this.sparks[i];
      if (s) {
        s.vel.y -= 9.8 * dt;
        s.pos.addScaledVector(s.vel, dt);
        pos.setXYZ(i, s.pos.x, s.pos.y, s.pos.z);
      } else pos.setXYZ(i, 0, -100, 0);
    }
    pos.needsUpdate = true;
    for (let i = 0; i < this.lights.length; i++) {
      this.lightLife[i] -= dt;
      if (this.lightLife[i] <= 0) this.lights[i].intensity = 0;
    }
  }
}

/** Electrical arc: jagged polyline regenerated every 50 to 80 ms. */
export class LightningArc {
  readonly line: THREE.Line;
  private next = 0;
  constructor(
    private a: THREE.Vector3,
    private b: THREE.Vector3,
  ) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
    this.line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: '#bfe8ff', transparent: true, blending: THREE.AdditiveBlending }));
  }
  update(t: number): void {
    if (t < this.next) return;
    this.next = t + 0.05 + Math.random() * 0.03;
    const pos = this.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < 16; i++) {
      const p = this.a.clone().lerp(this.b, i / 15);
      if (i > 0 && i < 15) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1));
      pos.setXYZ(i, p.x, p.y, p.z);
    }
    pos.needsUpdate = true;
  }
}
