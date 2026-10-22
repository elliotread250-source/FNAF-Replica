import * as THREE from 'three';
import { createRng, next, type Rng } from '@fnaf/shared';

// Every texture in the game is drawn here on a <canvas>. Generators take a seed so skins can vary them.
const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d') as CanvasRenderingContext2D];
}

function tex(key: string, c: HTMLCanvasElement, repeat = 1, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  return cache.get(key) ?? make();
}

const r = (rng: Rng, a: number, b: number) => a + next(rng) * (b - a);

function grime(ctx: CanvasRenderingContext2D, w: number, h: number, rng: Rng, amount: number, color = '0,0,0'): void {
  for (let i = 0; i < 60 * amount; i++) {
    const x = r(rng, 0, w);
    const y = r(rng, 0, h);
    const rad = r(rng, w * 0.02, w * 0.18);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${color},${r(rng, 0.05, 0.22)})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // Speckle.
  const img = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (next(rng) - 0.5) * 22;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

/** Sobel-filter a height canvas into a tangent-space normal map. */
function normalFrom(src: HTMLCanvasElement, strength = 2): HTMLCanvasElement {
  const w = src.width;
  const h = src.height;
  const s = (src.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, w, h).data;
  const [c, ctx] = canvas(w, h);
  const out = ctx.createImageData(w, h);
  const L = (x: number, y: number) => s[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (L(x + 1, y - 1) + 2 * L(x + 1, y) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x - 1, y) - L(x - 1, y + 1)) * strength;
      const dy = (L(x - 1, y + 1) + 2 * L(x, y + 1) + L(x + 1, y + 1) - L(x - 1, y - 1) - 2 * L(x, y - 1) - L(x + 1, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = (1 / len) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  return c;
}

export function checkerFloor(seed = 1): { map: THREE.Texture; normal: THREE.Texture; rough: THREE.Texture } {
  const key = `floor:${seed}`;
  const map = cached(key, () => {
    const [c, ctx] = canvas(512);
    const rng = createRng(seed);
    const n = 8;
    const s = 512 / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = (x + y) % 2 ? r(rng, 225, 240) : r(rng, 18, 30);
        ctx.fillStyle = `rgb(${v},${v},${v - 4})`;
        ctx.fillRect(x * s, y * s, s, s);
        ctx.strokeStyle = 'rgba(40,40,30,0.6)';
        ctx.strokeRect(x * s + 0.5, y * s + 0.5, s - 1, s - 1);
      }
    // Scuffs.
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(30,25,20,${r(rng, 0.05, 0.3)})`;
      ctx.lineWidth = r(rng, 1, 4);
      ctx.beginPath();
      const x = r(rng, 0, 512);
      const y = r(rng, 0, 512);
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + r(rng, -40, 40), y + r(rng, -10, 10), x + r(rng, -80, 80), y + r(rng, -20, 20));
      ctx.stroke();
    }
    grime(ctx, 512, 512, rng, 1.5, '40,30,10');
    return tex(key, c, 4);
  });
  const normal = cached(`${key}:n`, () => {
    const [c, ctx] = canvas(256);
    const rng = createRng(seed + 7);
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#303030';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 64, 0);
      ctx.lineTo(i * 64, 256);
      ctx.moveTo(0, i * 64);
      ctx.lineTo(256, i * 64);
      ctx.stroke();
    }
    grime(ctx, 256, 256, rng, 0.5, '0,0,0');
    return tex(`${key}:n`, normalFrom(c, 1.5), 4, false);
  });
  const rough = cached(`${key}:r`, () => {
    const [c, ctx] = canvas(256);
    const rng = createRng(seed + 3);
    ctx.fillStyle = '#9a9a9a';
    ctx.fillRect(0, 0, 256, 256);
    grime(ctx, 256, 256, rng, 1, '255,255,255');
    return tex(`${key}:r`, c, 4, false);
  });
  return { map, normal, rough };
}

export function confettiWall(seed = 2, base = '#3a2f4a'): THREE.Texture {
  return cached(`wall:${seed}:${base}`, () => {
    const [c, ctx] = canvas(512);
    const rng = createRng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    // Lower wainscot band.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 380, 512, 132);
    ctx.fillStyle = '#5a1a1a';
    ctx.fillRect(0, 372, 512, 10);
    const colors = ['#c43a3a', '#3a8ac4', '#e8c22c', '#3ab05a', '#c44fd0', '#ffffff'];
    for (let i = 0; i < 260; i++) {
      ctx.save();
      ctx.translate(r(rng, 0, 512), r(rng, 0, 370));
      ctx.rotate(r(rng, 0, Math.PI));
      ctx.fillStyle = colors[Math.floor(next(rng) * colors.length)];
      ctx.globalAlpha = r(rng, 0.35, 0.8);
      if (next(rng) < 0.5) ctx.fillRect(-5, -2, 10, 4);
      else {
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(4, 4);
        ctx.lineTo(-4, 4);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    grime(ctx, 512, 512, rng, 2.2, '20,15,5');
    // Water streaks.
    for (let i = 0; i < 8; i++) {
      const x = r(rng, 0, 512);
      const g = ctx.createLinearGradient(x, 0, x, r(rng, 100, 400));
      g.addColorStop(0, 'rgba(40,30,10,0.4)');
      g.addColorStop(1, 'rgba(40,30,10,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, r(rng, 3, 12), 512);
    }
    return tex(`wall:${seed}:${base}`, c, 2);
  });
}

/**
 * The Security Office wall, 3 m square at world scale (v = 0 at the floor): dark skirting, grey lower tiles,
 * a black-and-white checker band with a thin red trim over it, then mottled dingy grey block paint above with
 * water marks running down from the ceiling and exposed nail heads.
 */
export function officeWall(seed = 31): THREE.Texture {
  return cached(`officewall:${seed}`, () => {
    const [c, ctx] = canvas(512);
    const rng = createRng(seed);
    const px = 512 / 3; // pixels per metre
    const Y = (m: number) => 512 - m * px; // canvas y for a height in metres
    // Upper wall: painted block, mottled.
    ctx.fillStyle = '#5f5c56';
    ctx.fillRect(0, 0, 512, Y(1.24));
    for (let row = 0; row < 9; row++) {
      const y0 = Y(1.24 + (row + 1) * 0.2);
      const off = (row % 2) * 0.2 * px;
      ctx.strokeStyle = 'rgba(30,28,24,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y0 + 0.5);
      ctx.lineTo(512, y0 + 0.5);
      for (let x = -off; x < 512; x += 0.4 * px) {
        ctx.moveTo(x + 0.5, y0);
        ctx.lineTo(x + 0.5, y0 + 0.2 * px);
      }
      ctx.stroke();
    }
    // Lower wall: grey ceramic tiles.
    ctx.fillStyle = '#3c3c3a';
    ctx.fillRect(0, Y(0.9), 512, Y(0.12) - Y(0.9));
    for (let y = 0.12; y < 0.9; y += 0.15)
      for (let x = 0; x < 3; x += 0.15) {
        const v = r(rng, 70, 92);
        ctx.fillStyle = `rgb(${v},${v},${v - 3})`;
        ctx.fillRect(x * px + 1, Y(Math.min(0.9, y + 0.15)) + 1, 0.15 * px - 2, Math.min(0.15, 0.9 - y) * px - 2);
      }
    // Checker band, two rows of 0.15 m tiles.
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 20; i++) {
        const v = (i + row) % 2 ? r(rng, 210, 230) : r(rng, 14, 26);
        ctx.fillStyle = `rgb(${v},${v},${v - 4})`;
        ctx.fillRect(i * 0.15 * px, Y(0.9 + (row + 1) * 0.15), 0.15 * px, 0.15 * px);
        ctx.strokeStyle = 'rgba(40,36,28,0.7)';
        ctx.strokeRect(i * 0.15 * px + 0.5, Y(0.9 + (row + 1) * 0.15) + 0.5, 0.15 * px - 1, 0.15 * px - 1);
      }
    // Red trim and dark skirting.
    ctx.fillStyle = '#8a1414';
    ctx.fillRect(0, Y(1.24), 512, 0.04 * px);
    ctx.fillStyle = '#1c1a18';
    ctx.fillRect(0, Y(0.12), 512, 0.12 * px);
    grime(ctx, 512, 512, rng, 1.8, '30,24,10');
    // Water marks from the ceiling and grime pooled along the skirting.
    for (let i = 0; i < 5; i++) {
      const x = r(rng, 0, 500);
      const g = ctx.createLinearGradient(x, 0, x, r(rng, 120, 300));
      g.addColorStop(0, 'rgba(50,38,16,0.45)');
      g.addColorStop(1, 'rgba(50,38,16,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, r(rng, 4, 16), 320);
    }
    const sk = ctx.createLinearGradient(0, Y(0.3), 0, 512);
    sk.addColorStop(0, 'rgba(20,16,8,0)');
    sk.addColorStop(1, 'rgba(20,16,8,0.45)');
    ctx.fillStyle = sk;
    ctx.fillRect(0, Y(0.3), 512, 0.3 * px);
    ctx.fillStyle = '#1a1612';
    for (let i = 0; i < 6; i++) ctx.fillRect(r(rng, 0, 510), r(rng, 20, Y(1.4)), 2, 2);
    return tex(`officewall:${seed}`, c, 1);
  });
}

/** Grey 0.3 m floor tiles with dirt packed into the grout, at world scale (one repeat = 2.4 m). */
export function officeFloor(seed = 32): THREE.Texture {
  return cached(`officefloor:${seed}`, () => {
    const [c, ctx] = canvas(512);
    const rng = createRng(seed);
    ctx.fillStyle = '#211e1a';
    ctx.fillRect(0, 0, 512, 512);
    const n = 8;
    const s = 512 / n;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const v = r(rng, 92, 112);
        ctx.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
        ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
        // Speckled vinyl composition tile.
        for (let k = 0; k < 40; k++) {
          ctx.fillStyle = `rgba(${next(rng) < 0.5 ? '40,38,34' : '170,166,156'},0.5)`;
          ctx.fillRect(x * s + r(rng, 3, s - 4), y * s + r(rng, 3, s - 4), 2, 2);
        }
      }
    grime(ctx, 512, 512, rng, 1.6, '30,24,12');
    return tex(`officefloor:${seed}`, c, 1);
  });
}

export function tileWall(seed = 3, base = '#9ab8b0'): THREE.Texture {
  return cached(`tile:${seed}:${base}`, () => {
    const [c, ctx] = canvas(256);
    const rng = createRng(seed);
    ctx.fillStyle = '#444';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = base;
        ctx.globalAlpha = r(rng, 0.8, 1);
        ctx.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
      }
    ctx.globalAlpha = 1;
    grime(ctx, 256, 256, rng, 1.2, '30,40,20');
    return tex(`tile:${seed}:${base}`, c, 3);
  });
}

export function ceilingTiles(seed = 4): THREE.Texture {
  return cached(`ceil:${seed}`, () => {
    const [c, ctx] = canvas(256);
    const rng = createRng(seed);
    ctx.fillStyle = '#b8b4a6';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#6a665a';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 128, 128);
    ctx.strokeRect(128, 0, 128, 128);
    ctx.strokeRect(0, 128, 128, 128);
    ctx.strokeRect(128, 128, 128, 128);
    for (let i = 0; i < 2000; i++) {
      ctx.fillStyle = `rgba(80,70,60,${r(rng, 0.05, 0.25)})`;
      ctx.fillRect(r(rng, 0, 256), r(rng, 0, 256), 1.5, 1.5);
    }
    for (let i = 0; i < 4; i++) {
      const x = r(rng, 0, 256);
      const y = r(rng, 0, 256);
      for (let k = 3; k > 0; k--) {
        ctx.fillStyle = `rgba(120,90,40,${0.12 * k})`;
        ctx.beginPath();
        ctx.ellipse(x, y, k * r(rng, 6, 14), k * r(rng, 4, 12), r(rng, 0, 3), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    return tex(`ceil:${seed}`, c, 3);
  });
}

export function metalTex(seed = 5, kind: 'scratched' | 'rust' | 'brushed' = 'scratched', base = '#5a5e64'): { map: THREE.Texture; rough: THREE.Texture; normal: THREE.Texture } {
  const key = `metal:${seed}:${kind}:${base}`;
  const make = () => {
    const [c, ctx] = canvas(256);
    const [hc, hctx] = canvas(256);
    const rng = createRng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    hctx.fillStyle = '#808080';
    hctx.fillRect(0, 0, 256, 256);
    if (kind === 'brushed')
      for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(255,255,255,${r(rng, 0, 0.06)})`;
        ctx.fillRect(0, r(rng, 0, 256), 256, 1);
      }
    for (let i = 0; i < 140; i++) {
      ctx.strokeStyle = `rgba(220,220,220,${r(rng, 0.03, 0.2)})`;
      hctx.strokeStyle = '#606060';
      const x = r(rng, 0, 256);
      const y = r(rng, 0, 256);
      const dx = r(rng, -30, 30);
      const dy = r(rng, -6, 6);
      for (const k of [ctx, hctx]) {
        k.lineWidth = r(rng, 0.5, 1.5);
        k.beginPath();
        k.moveTo(x, y);
        k.lineTo(x + dx, y + dy);
        k.stroke();
      }
    }
    if (kind === 'rust') grime(ctx, 256, 256, rng, 2.5, '110,50,20');
    else grime(ctx, 256, 256, rng, 0.8, '10,10,10');
    // Rivets.
    for (let i = 0; i < 4; i++) {
      for (const [x, y] of [
        [16, 16 + i * 64],
        [240, 16 + i * 64],
      ]) {
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        hctx.fillStyle = '#ffffff';
        hctx.beginPath();
        hctx.arc(x, y, 5, 0, Math.PI * 2);
        hctx.fill();
      }
    }
    const map = tex(key, c, 1);
    const rough = tex(`${key}:r`, hc, 1, false);
    const normal = tex(`${key}:n`, normalFrom(hc, 3), 1, false);
    return { map, rough, normal };
  };
  if (cache.has(key)) return { map: cache.get(key)!, rough: cache.get(`${key}:r`)!, normal: cache.get(`${key}:n`)! };
  return make();
}

/** Fur: base noise, strand streaks, and a matching Sobel normal map. */
export function furTex(color: string, seed = 6, wear = 0.5): { map: THREE.Texture; normal: THREE.Texture } {
  const key = `fur:${color}:${seed}:${wear}`;
  if (cache.has(key)) return { map: cache.get(key)!, normal: cache.get(`${key}:n`)! };
  const [c, ctx] = canvas(256);
  const [hc, hctx] = canvas(256);
  const rng = createRng(seed);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  hctx.fillStyle = '#808080';
  hctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3500; i++) {
    const x = r(rng, 0, 256);
    const y = r(rng, 0, 256);
    const len = r(rng, 3, 9);
    const a = r(rng, -0.4, 0.4) + Math.PI / 2;
    const light = next(rng) < 0.5;
    ctx.strokeStyle = light ? `rgba(255,255,255,${r(rng, 0.02, 0.08)})` : `rgba(0,0,0,${r(rng, 0.03, 0.12)})`;
    hctx.strokeStyle = light ? '#b0b0b0' : '#505050';
    for (const k of [ctx, hctx]) {
      k.lineWidth = 1;
      k.beginPath();
      k.moveTo(x, y);
      k.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      k.stroke();
    }
  }
  grime(ctx, 256, 256, rng, wear * 2.5, '25,18,8');
  const map = tex(key, c, 2);
  const normal = tex(`${key}:n`, normalFrom(hc, 1.2), 2, false);
  return { map, normal };
}

export function woodTex(seed = 7, base = '#5a3a22'): THREE.Texture {
  return cached(`wood:${seed}:${base}`, () => {
    const [c, ctx] = canvas(256);
    const rng = createRng(seed);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 2) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + 0.08 * Math.abs(Math.sin(y * 0.09 + r(rng, 0, 0.6)))})`;
      ctx.fillRect(0, y, 256, 2);
    }
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = 'rgba(20,10,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(r(rng, 0, 256), r(rng, 0, 256), r(rng, 8, 20), r(rng, 3, 6), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    grime(ctx, 256, 256, rng, 0.7);
    return tex(`wood:${seed}:${base}`, c, 1);
  });
}

export function curtainTex(base = '#3a1450', stars = true): THREE.Texture {
  return cached(`curtain:${base}:${stars}`, () => {
    const [c, ctx] = canvas(256);
    const rng = createRng(9);
    for (let x = 0; x < 256; x++) {
      const v = 0.6 + 0.4 * Math.sin(x * 0.18);
      ctx.fillStyle = base;
      ctx.globalAlpha = 1;
      ctx.fillRect(x, 0, 1, 256);
      ctx.fillStyle = `rgba(0,0,0,${0.55 * (1 - v)})`;
      ctx.fillRect(x, 0, 1, 256);
    }
    if (stars) {
      ctx.fillStyle = '#d8c060';
      for (let i = 0; i < 18; i++) star(ctx, r(rng, 10, 246), r(rng, 10, 246), r(rng, 5, 9));
    }
    grime(ctx, 256, 256, rng, 0.8);
    return tex(`curtain:${base}:${stars}`, c, 1);
  });
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 ? s * 0.45 : s;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

export function circuitTex(seed = 10): THREE.Texture {
  return cached(`circuit:${seed}`, () => {
    const [c, ctx] = canvas(128);
    const rng = createRng(seed);
    ctx.fillStyle = '#0f3a1a';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = '#c8a040';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 30; i++) {
      let x = r(rng, 0, 128);
      let y = r(rng, 0, 128);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        if (next(rng) < 0.5) x += r(rng, -30, 30);
        else y += r(rng, -30, 30);
        ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = '#d8b050';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = '#111';
      ctx.fillRect(r(rng, 5, 100), r(rng, 5, 100), r(rng, 12, 24), r(rng, 8, 16));
    }
    return tex(`circuit:${seed}`, c, 1);
  });
}

export function stripesTex(): THREE.Texture {
  return cached('stripes', () => {
    const [c, ctx] = canvas(128);
    ctx.fillStyle = '#d8b020';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#111';
    for (let i = -128; i < 256; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 16, 0);
      ctx.lineTo(i + 16 + 128, 128);
      ctx.lineTo(i + 128, 128);
      ctx.fill();
    }
    return tex('stripes', c, 1);
  });
}

/** A poster: band poster, "Celebrate!", or a kid drawing. */
export function posterTex(kind: 'celebrate' | 'leader' | 'drawing' | 'eyeless' | 'rules', seed = 11, names: string[] = []): THREE.Texture {
  return cached(`poster:${kind}:${seed}:${names.join()}`, () => {
    const [c, ctx] = canvas(256, 352);
    const rng = createRng(seed);
    if (kind === 'drawing') {
      ctx.fillStyle = '#f2ecdc';
      ctx.fillRect(0, 0, 256, 352);
      const cols = ['#c41e1e', '#2a5bd8', '#e8c22c', '#3ab05a', '#7a3ac4', '#6b4423'];
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = cols[i % cols.length];
        ctx.lineWidth = 4;
        const x = 30 + i * 46;
        ctx.beginPath();
        ctx.arc(x, 140, 16, 0, Math.PI * 2);
        ctx.moveTo(x, 156);
        ctx.lineTo(x, 220);
        ctx.moveTo(x - 18, 180);
        ctx.lineTo(x + 18, 180);
        ctx.moveTo(x, 220);
        ctx.lineTo(x - 14, 260);
        ctx.moveTo(x, 220);
        ctx.lineTo(x + 14, 260);
        ctx.stroke();
      }
      ctx.fillStyle = '#e8c22c';
      ctx.beginPath();
      ctx.arc(220, 50, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = 'bold 28px "Courier Prime", monospace';
      ctx.fillStyle = '#c41e1e';
      ctx.fillText(next(rng) < 0.5 ? 'MY FRENDS' : 'PARTY!!', 30, 320);
      return tex(`poster:${kind}:${seed}:${names.join()}`, c, 1);
    }
    if (kind === 'rules') {
      ctx.fillStyle = '#e8e2cc';
      ctx.fillRect(0, 0, 256, 352);
      ctx.fillStyle = '#7a1a1a';
      ctx.font = 'bold 24px "Special Elite", monospace';
      ctx.fillText('STAFF RULES', 40, 40);
      ctx.font = '15px "Courier Prime", monospace';
      ctx.fillStyle = '#222';
      ['1. Doors stay OPEN', '2. Lights: brief use', '3. Share the power', '4. Do not stare', '5. 6 AM = go home', '6. Do NOT open', '   the parts locker'].forEach((l, i) =>
        ctx.fillText(l, 20, 90 + i * 30),
      );
      grime(ctx, 256, 352, rng, 1.2, '60,40,10');
      return tex(`poster:${kind}:${seed}:${names.join()}`, c, 1);
    }
    const g = ctx.createLinearGradient(0, 0, 0, 352);
    g.addColorStop(0, '#1a1a6a');
    g.addColorStop(1, '#6a1a4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 352);
    ctx.fillStyle = '#ffd21a';
    for (let i = 0; i < 20; i++) star(ctx, r(rng, 0, 256), r(rng, 0, 352), r(rng, 3, 7));
    ctx.font = 'bold 40px "Rubik Glitch", "Special Elite", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(kind === 'leader' ? (names[0] ?? 'FREDDY').toUpperCase() : 'CELEBRATE!', 128, 52);
    // Cartoon heads.
    const heads = kind === 'leader' ? [['#6b4423', 128, 200, 70]] : [['#5b5fb8', 60, 200, 34], ['#6b4423', 128, 190, 40], ['#e8c22c', 196, 200, 34]];
    for (const [col, x, y, s] of heads as [string, number, number, number][]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,230,200,0.7)';
      ctx.beginPath();
      ctx.ellipse(x, y + s * 0.35, s * 0.5, s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      if (kind === 'eyeless') {
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(x - s * 0.35, y - s * 0.15, s * 0.2, 0, Math.PI * 2);
        ctx.arc(x + s * 0.35, y - s * 0.15, s * 0.2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        for (const ex of [-0.35, 0.35]) {
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.arc(x + s * ex, y - s * 0.15, s * 0.18, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath();
          ctx.arc(x + s * ex, y - s * 0.12, s * 0.08, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = '#c41e1e';
      ctx.beginPath();
      ctx.arc(x, y + s * 0.18, s * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    grime(ctx, 256, 352, rng, 1.6, '40,30,10');
    return tex(`poster:${kind}:${seed}:${names.join()}`, c, 1);
  });
}

/** A newspaper clipping, fully readable when zoomed. */
export function newspaperTex(headline: string, body: [string, string], seed = 12): THREE.CanvasTexture {
  const key = `news:${headline}`;
  const hit = cache.get(key) as THREE.CanvasTexture | undefined;
  if (hit) return hit;
  const [c, ctx] = canvas(512, 640);
  const rng = createRng(seed);
  ctx.fillStyle = '#d8ccaa';
  ctx.fillRect(0, 0, 512, 640);
  grime(ctx, 512, 640, rng, 1.4, '110,80,30');
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '42px "UnifrakturMaguntia", serif';
  ctx.textAlign = 'center';
  ctx.fillText('The Hurricane Herald', 256, 60);
  ctx.fillRect(30, 76, 452, 3);
  ctx.font = 'bold 30px "Special Elite", monospace';
  wrap(ctx, headline, 256, 130, 452, 34);
  ctx.textAlign = 'left';
  ctx.font = '19px "Courier Prime", monospace';
  let y = 280;
  for (const p of body) y = wrap(ctx, p, 30, y, 452, 24) + 16;
  return tex(key, c, 1) as THREE.CanvasTexture;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, w: number, lh: number): number {
  const words = text.split(' ');
  let line = '';
  for (const word of words) {
    const t = line ? `${line} ${word}` : word;
    if (ctx.measureText(t).width > w && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lh;
    } else line = t;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lh;
}

export function bibTex(text: string, base = '#ffffff'): THREE.Texture {
  return cached(`bib:${text}:${base}`, () => {
    const [c, ctx] = canvas(256, 256);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = '#c41e1e';
    ctx.font = 'bold 44px "Rubik Glitch", "Special Elite", sans-serif';
    ctx.textAlign = 'center';
    const parts = text.split(' ');
    parts.forEach((p, i) => ctx.fillText(p, 128, 110 + i * 54));
    grime(ctx, 256, 256, createRng(13), 0.8, '60,40,0');
    return tex(`bib:${text}:${base}`, c, 1);
  });
}

export function signTex(text: string, bg = '#3a1a10', fg = '#ffd21a'): THREE.Texture {
  return cached(`sign:${text}:${bg}`, () => {
    const [c, ctx] = canvas(512, 160);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 144);
    ctx.fillStyle = fg;
    ctx.font = 'bold 54px "Special Elite", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.split('\n');
    lines.forEach((l, i) => ctx.fillText(l, 256, 80 + (i - (lines.length - 1) / 2) * 56));
    grime(ctx, 512, 160, createRng(14), 1, '0,0,0');
    return tex(`sign:${text}:${bg}`, c, 1);
  });
}

/** Grunge overlay used for dirt on characters and props. */
export function dirtTex(seed = 15): THREE.Texture {
  return cached(`dirt:${seed}`, () => {
    const [c, ctx] = canvas(256);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 256, 256);
    grime(ctx, 256, 256, createRng(seed), 2.5, '80,60,40');
    return tex(`dirt:${seed}`, c, 1);
  });
}

/** Soft radial sprite for sparks, dust and glows. */
export function glowSprite(): THREE.Texture {
  return cached('glow', () => {
    const [c, ctx] = canvas(64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    cache.set('glow', t);
    return t;
  });
}

export function textureCount(): number {
  return cache.size;
}
