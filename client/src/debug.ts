import * as THREE from 'three';
import { CLASSIC_MAP, COOP_MAP } from '@fnaf/shared';
import { getRenderer } from './render/renderer';
import { buildRoom, stageCharacters } from './render/scenes/rooms';
import { buildOffice } from './render/scenes/office';
import { setFrame } from './app';

/** Localhost-only visual check: ?gallery=<node|office:station> renders one room with the cast staged. */
export function runGallery(target: string): void {
  const R = getRenderer();
  const rt = new THREE.WebGLRenderTarget(640, 480, { colorSpace: THREE.SRGBColorSpace });
  if (target.startsWith('office:')) {
    const st = target.slice(7) as 'west';
    const doors = { office: [{ id: 'left', side: 'left' as const, kind: 'door' as const }, { id: 'right', side: 'right' as const, kind: 'door' as const }], west: [{ id: 'west', side: 'left' as const, kind: 'door' as const }], control: [{ id: 'vent', side: 'right' as const, kind: 'vent' as const }], south: [{ id: 'south_l', side: 'left' as const, kind: 'door' as const }, { id: 'south_r', side: 'right' as const, kind: 'door' as const }] }[st as 'west'] ?? [];
    const o = buildOffice({ station: st, doors, decor: 'office_plush', guardEquip: {}, shadowSize: 1024, leaderName: 'Freddy' });
    const yaw = Number(new URLSearchParams(location.search).get('yaw') ?? '0');
    const light = new URLSearchParams(location.search).get('light');
    setFrame((dt, t) => {
      o.camera.aspect = window.innerWidth / window.innerHeight;
      o.camera.updateProjectionMatrix();
      o.camera.rotation.set(-0.06, yaw, 0);
      for (const d of o.doors) {
        const on = light === d.id;
        d.spot.intensity = on ? 26 : 0;
        d.cone.visible = on;
        d.motes.visible = on;
        if (on) o.place('bonnie', { pos: d.blindSpot.clone(), rotY: d.side === 'left' ? Math.PI / 2 : -Math.PI / 2, pose: 'stare' });
      }
      o.update(dt, t);
      R.render(o.scene, o.camera);
    });
    return;
  }
  const map = COOP_MAP.nodes[target] ? COOP_MAP : CLASSIC_MAP;
  const room = buildRoom(map.nodes[target], { west_hall: 4, party_a: 1, east_hall: 3 }, target === 'west_corner');
  const cast = ['freddy', 'bonnie', 'chica'].slice(0, room.spots.length);
  setFrame((_dt, t) => {
    for (const f of room.flickers) f.update(1 / 60, t);
    stageCharacters(room, target === 'cove' ? [{ id: 'foxy', slot: 0, pose: 'lean', offset: new THREE.Vector3(0.3, 0, 0.15) }] : cast.map((id, i) => ({ id, slot: i, eyesOnly: id === 'freddy' && !['stage', 'dining'].includes(target) })));
    R.renderTo(room.scene, room.camera, rt);
    R.renderCrt(rt.texture, { staticAmt: 0.05, tint: new THREE.Vector3(0.75, 1.05, 0.8), mono: 0, glitch: 0 });
  });
}
