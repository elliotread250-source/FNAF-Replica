// Renders the level plan to docs/map.svg: rooms, walls, openings, doors, lights, spawns, switches.
import { writeFileSync } from 'node:fs';
import { getLevel, BASEMENT_Y } from '../shared/src/world';

const S = 12; // pixels per metre
const level = getLevel();
const { bounds } = level;
const pad = 4;
const W = (bounds.x2 - bounds.x1 + pad * 2) * S;
const floors = [0, BASEMENT_Y];
const H = (bounds.z2 - bounds.z1 + pad * 2) * S;
const px = (x: number) => ((x - bounds.x1 + pad) * S).toFixed(1);
const pz = (z: number) => ((z - bounds.z1 + pad) * S).toFixed(1);

const colours: Record<string, string> = {
  dining: '#f2d9a6', lobby: '#cfe3f2', hall: '#e5e0d0', tile: '#cdeee6', steel: '#d6d9de', concrete: '#c9c4bc', office: '#d9c9e6',
  stage: '#e8b4b4', arcade: '#c8b4ee', wood: '#d9bd96', play: '#f6c9dd', basement: '#a9b2bf', dirty: '#d8cfb9', prize: '#f6d2e8', cove: '#d4a5e6',
  party1: '#c9d8f5', party2: '#f5ddb4', party3: '#f5c9de', party4: '#cfc9b3',
};

function plan(floorY: number, title: string, offsetY: number): string {
  let s = `<g transform="translate(0,${offsetY})"><text x="10" y="18" font-size="16" fill="#222" font-family="sans-serif">${title}</text>`;
  for (const r of level.rooms.filter((q) => q.floorY === floorY)) {
    for (const [x1, z1, x2, z2] of r.rects) {
      s += `<rect x="${px(x1)}" y="${pz(z1)}" width="${(x2 - x1) * S}" height="${(z2 - z1) * S}" fill="${colours[r.style] ?? '#ddd'}" />`;
    }
    const [x1, z1, x2, z2] = r.rects[0];
    s += `<text x="${px((x1 + x2) / 2)}" y="${pz((z1 + z2) / 2)}" font-size="9" text-anchor="middle" fill="#222" font-family="sans-serif">${r.name.replace(/&/g, '&amp;')}</text>`;
  }
  for (const w of level.walls.filter((q) => q.y1 === floorY)) {
    s += w.axis === 'x'
      ? `<line x1="${px(w.line)}" y1="${pz(w.a)}" x2="${px(w.line)}" y2="${pz(w.b)}" stroke="#222" stroke-width="${w.thick * S}"/>`
      : `<line x1="${px(w.a)}" y1="${pz(w.line)}" x2="${px(w.b)}" y2="${pz(w.line)}" stroke="#222" stroke-width="${w.thick * S}"/>`;
  }
  for (const d of level.doors.filter((q) => q.floorY === floorY)) {
    const col = d.locked ? '#c00' : d.kind === 'shutter' ? '#06c' : '#a60';
    s += d.axis === 'x'
      ? `<line x1="${px(d.line)}" y1="${pz(d.from)}" x2="${px(d.line)}" y2="${pz(d.to)}" stroke="${col}" stroke-width="3"/>`
      : `<line x1="${px(d.from)}" y1="${pz(d.line)}" x2="${px(d.to)}" y2="${pz(d.line)}" stroke="${col}" stroke-width="3"/>`;
  }
  for (const p of level.props.filter((q) => (level.roomById[q.room]?.floorY ?? 0) === floorY)) {
    s += `<circle cx="${px(p.x)}" cy="${pz(p.z)}" r="2" fill="#7a5a3a" opacity="0.7"/>`;
  }
  for (const l of level.lights.filter((q) => (level.roomById[q.room]?.floorY ?? 0) === floorY)) {
    s += `<circle cx="${px(l.x)}" cy="${pz(l.z)}" r="2.5" fill="${l.kind === 'emergency' ? '#e22' : '#fc0'}"/>`;
  }
  for (const i of level.interactables.filter((q) => (level.roomById[q.room]?.floorY ?? 0) === floorY)) {
    s += `<rect x="${Number(px(i.x)) - 3}" y="${Number(pz(i.z)) - 3}" width="6" height="6" fill="#0a0"/>`;
  }
  if (floorY === 0) for (const sp of level.spawns) s += `<circle cx="${px(sp.x)}" cy="${pz(sp.z)}" r="4" fill="#09f"/>`;
  return s + '</g>';
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H * floors.length}" viewBox="0 0 ${W} ${H * floors.length}"><rect width="100%" height="100%" fill="#fafafa"/>${plan(0, 'Ground floor (y=0)', 0)}${plan(BASEMENT_Y, 'Basement (y=-4.5)', H)}<text x="10" y="${H * 2 - 8}" font-size="10" fill="#444" font-family="sans-serif">red = locked door, blue = shutter, brown = door, yellow = light, red dot = emergency light, green = switch, blue dot = spawn</text></svg>`;
writeFileSync(new URL('../docs/map.svg', import.meta.url), svg);
console.log('wrote docs/map.svg');
