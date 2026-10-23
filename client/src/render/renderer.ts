import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { store } from '../store';

export type Quality = 'low' | 'medium' | 'high';

// Office post: grain, vignette, chromatic aberration, plus hallucination and danger uniforms.
const PostShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    grain: { value: 0.06 },
    vignette: { value: 1 },
    aberration: { value: 0.0015 },
    redTint: { value: 0 },
    wobble: { value: 0 },
    flash: { value: 0 },
    pulse: { value: 0 },
    brightness: { value: 1 },
    darkness: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float time, grain, vignette, aberration, redTint, wobble, flash, pulse, brightness, darkness;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      uv += wobble * vec2(sin(uv.y*18.0 + time*5.0), cos(uv.x*14.0 + time*4.0)) * 0.006;
      vec2 c = uv - 0.5;
      float ab = aberration * (1.0 + wobble * 6.0) * length(c) * 2.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ab).b;
      col *= brightness;
      float n = hash(uv * vec2(1024.0, 768.0) + fract(time) * 100.0) - 0.5;
      col += n * grain;
      float v = smoothstep(0.85, 0.25, length(c) * (1.0 + pulse * 0.35));
      col *= mix(1.0, v, vignette);
      col = mix(col, col * vec3(1.4, 0.35, 0.3), redTint);
      col = mix(col, vec3(1.0, 0.9, 0.9), flash);
      col *= 1.0 - darkness;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// The camera tablet: barrel distortion, scanlines, phosphor mask, grain, rolling band, tint, static.
export const CrtShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    tint: { value: new THREE.Vector3(0.75, 1.05, 0.8) },
    grain: { value: 0.12 },
    scan: { value: 1 },
    staticAmt: { value: 0 },
    crt: { value: 0.7 },
    jitter: { value: 0 },
    mono: { value: 0 },
    phosphor: { value: 0 },
    glitch: { value: 0 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec3 tint; uniform float time, grain, scan, staticAmt, crt, jitter, mono, phosphor, glitch;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    vec2 barrel(vec2 uv){ vec2 c = uv*2.0-1.0; c *= 1.0 + crt*0.12*dot(c,c); return c*0.5+0.5; }
    void main(){
      vec2 uv = barrel(vUv);
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(0.0,0.0,0.0,1.0); return; }
      float row = floor(uv.y * 240.0);
      uv.x += (hash(vec2(row, floor(time*30.0))) - 0.5) * jitter * 0.02;
      if (glitch > 0.0 && hash(vec2(floor(uv.y*24.0), floor(time*12.0))) > 1.0 - glitch*0.3) uv.x += (hash(vec2(row, time)) - 0.5) * 0.15;
      vec2 c = uv - 0.5;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c*0.006*crt).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c*0.006*crt).b;
      float lum = dot(col, vec3(0.299,0.587,0.114));
      col = mix(col, vec3(lum), 0.55);
      col *= tint;
      col = mix(col, vec3(lum*0.6, lum*0.8, lum*1.3), mono);
      float n = hash(uv*vec2(640.0,480.0) + fract(time*7.0)*50.0);
      col += (n-0.5) * grain;
      col *= 1.0 - scan * 0.22 * (0.5 + 0.5*sin(uv.y*480.0*3.14159 + time*4.0));
      float band = smoothstep(0.0, 0.05, abs(fract(uv.y*0.7 - time*0.13) - 0.5)) ;
      col *= mix(1.06, 1.0, band);
      if (phosphor > 0.0) { float m = mod(gl_FragCoord.x, 3.0); col *= mix(vec3(1.0), vec3(m<1.0?1.2:0.85, m>=1.0&&m<2.0?1.2:0.85, m>=2.0?1.2:0.85), phosphor); }
      col = mix(col, vec3(n), staticAmt);
      float v = smoothstep(0.9, 0.3, length(c));
      col *= v;
      gl_FragColor = vec4(col * 1.15, 1.0);
    }`,
};

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloom: UnrealBloomPass;
  private smaa: SMAAPass | null = null;
  readonly post: ShaderPass;
  private crtScene = new THREE.Scene();
  private crtCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  readonly crtMat: THREE.ShaderMaterial;
  quality: Quality = 'medium';
  private clock = new THREE.Clock();

  constructor(parent: HTMLElement) {
    this.gl = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.canvas = this.gl.domElement;
    this.canvas.id = 'scene';
    parent.appendChild(this.canvas);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 0.9;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera();
    this.composer = new EffectComposer(this.gl);
    this.renderPass = new RenderPass(scene, cam);
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.9, 0.5, 0.82);
    this.composer.addPass(this.bloom);
    this.post = new ShaderPass(PostShader);
    this.composer.addPass(this.post);
    this.composer.addPass(new OutputPass());
    this.crtMat = new THREE.ShaderMaterial({ ...CrtShader, uniforms: THREE.UniformsUtils.clone(CrtShader.uniforms), depthTest: false, depthWrite: false });
    this.crtScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.crtMat));
    this.setQuality(resolveQuality());
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setQuality(q: Quality): void {
    this.quality = q;
    this.gl.shadowMap.enabled = true;
    if (q === 'high' && !this.smaa) {
      this.smaa = new SMAAPass(window.innerWidth, window.innerHeight);
      this.composer.insertPass(this.smaa, 2);
    }
    this.bloom.strength = q === 'low' ? 0.6 : 0.9;
    this.crtMat.uniforms.phosphor.value = q === 'high' ? 0.5 : 0;
    this.resize();
  }

  resize(): void {
    const s = store.settings.renderScale * (this.quality === 'low' ? 0.75 : 1);
    const pr = Math.min(window.devicePixelRatio, this.quality === 'high' ? 1.5 : 1) * s;
    this.gl.setPixelRatio(pr);
    this.gl.setSize(window.innerWidth, window.innerHeight);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  get shadowSize(): number {
    return this.quality === 'low' ? 512 : this.quality === 'high' ? 2048 : 1024;
  }

  get cameraTargetSize(): [number, number] {
    return this.quality === 'low' ? [480, 360] : [640, 480];
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    const t = this.clock.getElapsedTime();
    const s = store.settings;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    const u = this.post.uniforms;
    u.time.value = t;
    u.grain.value = 0.05 * s.grain * 2;
    u.vignette.value = s.vignette ? 1 : 0;
    u.brightness.value = s.brightness;
    this.composer.render();
  }

  /** Draw a camera render target through the CRT shader, straight to the screen. */
  renderCrt(target: THREE.Texture, opts: { staticAmt: number; tint: THREE.Vector3; mono: number; glitch: number }): void {
    const u = this.crtMat.uniforms;
    const s = store.settings;
    u.tDiffuse.value = target;
    u.time.value = this.clock.getElapsedTime();
    u.staticAmt.value = opts.staticAmt;
    u.tint.value = opts.tint;
    u.mono.value = opts.mono;
    u.glitch.value = opts.glitch;
    u.crt.value = s.crt;
    u.grain.value = 0.06 + s.grain * 0.14;
    u.scan.value = s.scanlines ? 1 : 0;
    u.jitter.value = Math.random() < 0.04 ? 1 : 0.1;
    this.gl.setRenderTarget(null);
    this.gl.render(this.crtScene, this.crtCam);
  }

  renderTo(scene: THREE.Scene, camera: THREE.Camera, target: THREE.WebGLRenderTarget): void {
    this.gl.setRenderTarget(target);
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
  }

  info(): string {
    const i = this.gl.info;
    return `calls ${i.render.calls} tris ${i.render.triangles} progs ${i.programs?.length ?? 0}`;
  }
}

function resolveQuality(): Quality {
  const q = store.settings.quality;
  if (q !== 'auto') return q;
  try {
    const stored = localStorage.getItem('fr_quality');
    if (stored === 'low' || stored === 'medium' || stored === 'high') return stored;
  } catch {
    /* storage blocked */
  }
  // Phones and tablets start on the light preset until the title-screen benchmark says otherwise.
  if (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches) return 'low';
  return 'medium';
}

/** First-run benchmark on the title screen: measure frame time for 3 s and pick a preset. */
export function benchmark(samples: number[]): Quality {
  if (samples.length < 20) return 'medium';
  const sorted = [...samples].sort((a, b) => a - b);
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  const q: Quality = p75 < 9 ? 'high' : p75 < 20 ? 'medium' : 'low';
  try {
    localStorage.setItem('fr_quality', q);
  } catch {
    /* storage blocked */
  }
  return q;
}

let instance: Renderer | null = null;
export function getRenderer(): Renderer {
  if (!instance) instance = new Renderer(document.getElementById('stage') as HTMLElement);
  return instance;
}
