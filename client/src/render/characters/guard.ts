import * as THREE from 'three';
import { COSMETICS_BY_ID } from '@fnaf/shared';
import { plain } from '../materials';

export interface GuardRig {
  root: THREE.Group;
  head: THREE.Group;
}

function p(id: string | undefined, key: string, fallback: string): string {
  return String((id && COSMETICS_BY_ID[id]?.params[key]) ?? fallback);
}

/** The player's guard, stylised and slightly toy-like, from the equipped cosmetics. */
export function buildGuard(equipped: Record<string, string>): GuardRig {
  const g = equipped.guard;
  const shirt = plain(p(g, 'shirt', '#2f4f8f'), 0.85);
  const pants = plain(p(g, 'pants', '#1c2440'), 0.85);
  const capM = plain(p(g, 'cap', '#1c2440'), 0.7);
  const skin = plain(p(g, 'skin', '#e0b48c'), 0.7);
  const pattern = p(g, 'pattern', 'plain');
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 4, 12), shirt);
  body.position.y = 1.05;
  root.add(body);
  if (pattern === 'stripes' || pattern === 'wires' || pattern === 'overalls' || pattern === 'tie' || pattern === 'gold') {
    const accent =
      pattern === 'stripes' ? '#f2f2f2' : pattern === 'wires' ? '#d8b018' : pattern === 'overalls' ? '#3a5a8a' : pattern === 'gold' ? '#ffe070' : '#7a1a1a';
    const m = plain(accent, 0.5, pattern === 'gold' ? 0.8 : 0);
    if (pattern === 'tie') {
      const tie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.02), m);
      tie.position.set(0, 1.12, 0.21);
      root.add(tie);
    } else if (pattern === 'overalls') {
      const bib = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), m);
      bib.position.set(0, 1.0, 0.19);
      root.add(bib);
    } else {
      for (let i = 0; i < 4; i++) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.015, 4, 20), m);
        band.rotation.x = Math.PI / 2;
        band.position.y = 0.88 + i * 0.12;
        root.add(band);
      }
    }
  }
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.035, 6), plain('#d8b020', 0.3, 0.9));
  badge.position.set(0.1, 1.2, 0.2);
  root.add(badge);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.55, 4, 8), pants);
    leg.position.set(side * 0.1, 0.42, 0);
    root.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.22), plain('#111', 0.5));
    shoe.position.set(side * 0.1, 0.04, 0.04);
    root.add(shoe);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.45, 4, 8), shirt);
    arm.position.set(side * 0.27, 1.05, 0);
    arm.rotation.z = side * 0.12;
    root.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
    hand.position.set(side * 0.3, 0.75, 0);
    root.add(hand);
  }
  const head = new THREE.Group();
  head.position.y = 1.55;
  root.add(head);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), skin);
  h.scale.y = 1.1;
  head.add(h);
  for (const side of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), plain('#111', 0.3));
    e.position.set(side * 0.05, 0.02, 0.135);
    head.add(e);
  }
  const hat = p(g, 'hat', 'cap');
  if (hat === 'top') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.015, 16), capM);
    brim.position.y = 0.13;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 16), capM);
    top.position.y = 0.25;
    head.add(brim, top);
  } else if (hat === 'party') {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 12), plain('#ffd21a', 0.6));
    c.position.y = 0.25;
    head.add(c);
  } else {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), capM);
    c.position.y = 0.05;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.015, 0.12), capM);
    visor.position.set(0, 0.06, 0.15);
    head.add(c, visor);
  }
  const acc = equipped.accessory ? String(COSMETICS_BY_ID[equipped.accessory]?.params.model ?? '') : '';
  if (acc === 'eyepatch') {
    const patch = new THREE.Mesh(new THREE.CircleGeometry(0.04, 10), plain('#111', 0.8));
    patch.position.set(0.05, 0.03, 0.145);
    head.add(patch);
  } else if (acc === 'goggles') {
    for (const side of [-1, 1]) {
      const gg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 10), plain('#2a4a2a', 0.3, 0.6));
      gg.rotation.x = Math.PI / 2;
      gg.position.set(side * 0.055, 0.03, 0.15);
      head.add(gg);
    }
  } else if (acc === 'partyhat') {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 12), plain('#e84a8a', 0.6));
    c.position.set(0.04, 0.26, 0);
    c.rotation.z = -0.25;
    head.add(c);
  } else if (acc === 'headset') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.012, 5, 20, Math.PI), plain('#222', 0.5));
    band.position.y = 0.02;
    head.add(band);
    const mic = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), plain('#111', 0.5));
    mic.position.set(-0.12, -0.08, 0.1);
    head.add(mic);
  } else if (acc === 'bowtie') {
    for (const side of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 6), plain('#c41e1e', 0.6));
      c.rotation.z = (side * Math.PI) / 2;
      c.position.set(side * 0.035, 1.36, 0.17);
      root.add(c);
    }
  } else if (acc === 'ears') {
    for (const side of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.2, 4, 8), plain('#f2f2f2', 0.8));
      e.position.set(side * 0.07, 0.3, 0);
      e.rotation.z = side * -0.2;
      head.add(e);
    }
  } else if (acc === 'chef') {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.18, 14), plain('#f2f2f2', 0.8));
    c.position.y = 0.2;
    head.add(c);
  } else if (acc === 'scarf') {
    const sc = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.04, 6, 16), plain('#c41e1e', 0.9));
    sc.rotation.x = Math.PI / 2;
    sc.position.y = 1.4;
    root.add(sc);
  }
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  return { root, head };
}
