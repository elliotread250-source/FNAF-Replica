import * as THREE from 'three';
import { Turntable } from '../render/scenes/small';

/** A small dedicated renderer for turntables in menus (Locker Room, Archives, profiles). */
export class TurntableView {
  readonly canvas: HTMLCanvasElement;
  readonly tt = new Turntable();
  private gl: THREE.WebGLRenderer;
  private raf = 0;
  private t0 = performance.now();
  private last = performance.now();

  constructor(w = 360, h = 420) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'turntable';
    this.canvas.width = w;
    this.canvas.height = h;
    this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.gl.setSize(w, h, false);
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.shadowMap.enabled = true;
    this.tt.camera.aspect = w / h;
    this.tt.camera.updateProjectionMatrix();
    let lastX = 0;
    this.canvas.addEventListener('pointerdown', (e) => {
      this.tt.drag = true;
      lastX = e.clientX;
      this.canvas.setPointerCapture(e.pointerId);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (!this.tt.drag) return;
      this.tt.yaw += (e.clientX - lastX) * 0.01;
      lastX = e.clientX;
    });
    this.canvas.addEventListener('pointerup', () => (this.tt.drag = false));
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const now = performance.now();
      this.tt.update((now - this.last) / 1000, (now - this.t0) / 1000);
      this.last = now;
      this.gl.render(this.tt.scene, this.tt.camera);
    };
    loop();
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.gl.dispose();
    this.gl.forceContextLoss();
  }
}
