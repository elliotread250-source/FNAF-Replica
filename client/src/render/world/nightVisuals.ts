import * as THREE from 'three';
import { BREAKER_GROUPS, FUSE_BOXES, PLATE_TABLES, type CircuitId, type FrSim } from '@fnaf/shared';

// Everything the night's jobs need to show in the world: loose items, the breaker panel's labels and
// lamps, fuse boxes, zone switch plates, the music box gauge and the birthday cards and cupcakes.

const mat = (color: string, emissive = '#000000', ei = 0, rough = 0.6, metal = 0) =>
  new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: rough, metalness: metal });

function cupcakeMesh(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.05, 12), mat('#e88aa8', '#000', 0, 0.7));
  base.position.y = 0.025;
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#fff0f4', '#000', 0, 0.5));
  top.position.y = 0.05;
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), mat('#9ad0ff'));
  candle.position.y = 0.12;
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), mat('#000', '#ffb030', 4));
  flame.position.y = 0.155;
  flame.name = 'flame';
  g.add(base, top, candle, flame);
  return g;
}

function itemMesh(type: string): THREE.Object3D {
  if (type === 'cupcake') return cupcakeMesh();
  if (type === 'fuse') {
    // Glows faintly orange so a dropped one can be found.
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), mat('#d8c8a0', '#ff7a1a', 0.8, 0.4, 0.3));
    m.rotation.z = Math.PI / 2;
    m.position.y = 0.03;
    const g = new THREE.Group();
    g.add(m);
    return g;
  }
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.06), mat('#2a2a2a', '#3aff6a', 0.25, 0.5));
  b.position.y = 0.03;
  const g = new THREE.Group();
  g.add(b);
  return g;
}

export class NightVisuals {
  readonly root = new THREE.Group();
  private items = new Map<number, THREE.Object3D>();
  private panelCanvas = document.createElement('canvas');
  private panelTex: THREE.CanvasTexture;
  private panelKey = '';
  private fuseLamps: THREE.MeshStandardMaterial[][] = [];
  private switchLamps = new Map<CircuitId, THREE.MeshStandardMaterial>();
  private gaugeNeedle: THREE.Mesh;
  private cards = new Map<number, THREE.Mesh>();
  private t = 0;

  constructor(private readonly sim: FrSim) {
    // Breaker panel face: a canvas with twelve labelled breakers, the needle and the band.
    this.panelCanvas.width = 512;
    this.panelCanvas.height = 384;
    this.panelTex = new THREE.CanvasTexture(this.panelCanvas);
    this.panelTex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.9), new THREE.MeshStandardMaterial({ map: this.panelTex, emissive: '#ffffff', emissiveMap: this.panelTex, emissiveIntensity: 0.35, roughness: 0.6 }));
    face.position.set(22.62, -4.5 + 1.5, 60);
    face.rotation.y = Math.PI / 2;
    this.root.add(face);

    // Fuse boxes with one lamp per protected group.
    FUSE_BOXES.forEach((f) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.14), mat('#5a6068', '#000', 0, 0.5, 0.6));
      box.position.set(f.x, f.y, f.z + 0.06);
      box.rotation.y = (f.ry * Math.PI) / 180;
      this.root.add(box);
      const lamps: THREE.MeshStandardMaterial[] = [];
      f.groups.forEach((_, k) => {
        const m = mat('#111', '#3aff5a', 2);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), m);
        lamp.position.set(f.x - 0.2 + k * 0.13, f.y + 0.28, f.z + 0.14);
        this.root.add(lamp);
        lamps.push(m);
      });
      this.fuseLamps.push(lamps);
    });

    // Zone switch plates with an indicator lamp.
    for (const it of sim.level.interactables) {
      if (it.type !== 'zoneSwitch' || !it.circuit) continue;
      const g = new THREE.Group();
      g.position.set(it.x, it.y, it.z);
      g.rotation.y = (it.ry * Math.PI) / 180;
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.05), mat('#6a6e72', '#000', 0, 0.5, 0.5));
      const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), mat('#222'));
      toggle.position.z = 0.04;
      const m = mat('#111', '#ff3a2a', 1.5);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), m);
      lamp.position.set(0, 0.12, 0.035);
      g.add(plate, toggle, lamp);
      this.root.add(g);
      this.switchLamps.set(it.circuit, m);
    }

    // Music box gauge: a brass dial above the box with a needle 0..100.
    const mb = sim.level.interactables.find((i) => i.id === 'musicbox');
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), mat('#e8dcc0', '#000', 0, 0.6));
    const gx = mb ? mb.x : 25;
    const gz = (mb ? mb.z : 5.2) - 0.9;
    dial.position.set(gx, 2.3, gz);
    this.root.add(dial);
    const red = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 16, 1, Math.PI * 0.85, Math.PI * 0.3), mat('#c41e1e'));
    red.position.set(gx, 2.3, gz + 0.002);
    this.root.add(red);
    this.gaugeNeedle = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.22, 0.01), mat('#111'));
    this.gaugeNeedle.geometry.translate(0, 0.11, 0);
    this.gaugeNeedle.position.set(gx, 2.3, gz + 0.01);
    this.root.add(this.gaugeNeedle);
  }

  update(dt: number): void {
    this.t += dt;
    const sim = this.sim;
    const n = sim.night;
    // Loose items.
    for (const it of n.items) {
      let o = this.items.get(it.id);
      if (!o) {
        o = itemMesh(it.type);
        this.items.set(it.id, o);
        this.root.add(o);
      }
      o.visible = !it.holder && it.y > -100;
      o.position.set(it.x, it.y, it.z);
      if (it.plate < 0 && o.visible) o.rotation.y += dt * 0.6;
      const flame = o.getObjectByName('flame');
      if (flame) {
        flame.visible = it.plate >= 0;
        flame.scale.setScalar(0.85 + Math.sin(this.t * 17 + it.id) * 0.15);
      }
    }
    // Birthday cards on tonight's tables.
    for (const plate of n.plates) {
      if (this.cards.has(plate)) continue;
      const t = PLATE_TABLES[plate];
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 0.01), mat('#ffd21a', '#ffb000', 0.4));
      card.position.set(t.x - 0.35, 0.88, t.z + 0.12);
      card.rotation.y = 0.4;
      this.root.add(card);
      this.cards.set(plate, card);
    }
    // Panel.
    const key = `${n.breakers.join('')}|${sim.power.main}|${Math.round(n.loadOn())}|${Math.ceil(n.masterCooldown)}|${Math.round(n.power)}`;
    if (key !== this.panelKey) {
      this.panelKey = key;
      this.drawPanel();
    }
    // Fuse lamps.
    FUSE_BOXES.forEach((f, i) => {
      f.groups.forEach((gid, k) => {
        const g = BREAKER_GROUPS.findIndex((b) => b.id === gid);
        const m = this.fuseLamps[i][k];
        const bad = n.blown.has(g);
        m.emissive.set(bad ? '#ff3a1a' : '#3aff5a');
        m.emissiveIntensity = bad ? (Math.sin(this.t * 9 + k) > 0 ? 3 : 0.2) : 1.5;
      });
    });
    for (const [c, m] of this.switchLamps) {
      const on = sim.circuitOn(c);
      const live = sim.power.main && n.groupLive(c);
      m.emissive.set(on ? '#3aff5a' : live ? '#ffb030' : '#ff3a2a');
      m.emissiveIntensity = on ? 2 : live ? 1.2 : sim.power.main ? 0.8 : 0.1;
    }
    // Gauge: 0% points left-down, 100% right-down, through the top.
    this.gaugeNeedle.rotation.z = Math.PI * 0.75 - (n.musicBox / 100) * Math.PI * 1.5;
  }

  private drawPanel(): void {
    const c = this.panelCanvas;
    const x = c.getContext('2d') as CanvasRenderingContext2D;
    const n = this.sim.night;
    x.fillStyle = '#2a2e32';
    x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = '#11151a';
    x.lineWidth = 6;
    x.strokeRect(3, 3, c.width - 6, c.height - 6);
    x.font = 'bold 18px monospace';
    x.fillStyle = '#d8d4c8';
    x.textAlign = 'center';
    x.fillText('MAIN DISTRIBUTION  •  DANGER 480V', c.width / 2, 26);
    // Breakers: two rows of six. Row 0 is the upper row (indices 0..5).
    for (let i = 0; i < 12; i++) {
      const row = i < 6 ? 0 : 1;
      const col = i % 6;
      // The panel faces +X, so +Z runs to the left on screen.
      const cx = c.width - (40 + col * 86);
      const cy = 70 + row * 120;
      const on = n.breakers[i];
      x.fillStyle = '#15181c';
      x.fillRect(cx - 26, cy, 52, 80);
      x.fillStyle = on ? '#3ad05a' : '#c42a1e';
      x.fillRect(cx - 14, on ? cy + 8 : cy + 40, 28, 32);
      x.fillStyle = '#e8e4d8';
      x.font = 'bold 15px monospace';
      x.fillText(BREAKER_GROUPS[i].id.toUpperCase().slice(0, 8), cx, cy + 98);
      x.font = 'bold 20px monospace';
      x.fillStyle = '#ffd21a';
      x.fillText(String(n.loads[i]), cx + 36, cy + 26);
    }
    // Load needle with the green band.
    const load = n.loadOn();
    const bx = 40;
    const by = 330;
    const bw = c.width - 80;
    const max = 30;
    x.fillStyle = '#111';
    x.fillRect(bx, by, bw, 18);
    x.fillStyle = '#2aa04a';
    x.fillRect(bx + (n.band[0] / max) * bw, by, ((n.band[1] - n.band[0]) / max) * bw, 18);
    x.fillStyle = '#ffd21a';
    x.fillRect(bx + (Math.min(max, load) / max) * bw - 2, by - 6, 4, 30);
    x.font = 'bold 16px monospace';
    x.fillStyle = '#d8d4c8';
    x.textAlign = 'left';
    x.fillText(`LOAD ${load}`, bx, by - 10);
    x.textAlign = 'right';
    const status = this.sim.power.main ? `MAIN ON  ${Math.round(n.power)}%` : n.masterCooldown > 0 ? `COOLING ${Math.ceil(n.masterCooldown)}s` : 'MAIN OFF';
    x.fillStyle = this.sim.power.main ? '#3aff5a' : '#ff5a3a';
    x.fillText(status, bx + bw, by - 10);
    this.panelTex.needsUpdate = true;
  }
}
