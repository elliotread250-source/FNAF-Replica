import { hashString, createRng, next } from '../rng';

export type CosmeticCategory = 'guard' | 'accessory' | 'flashlight' | 'tablet' | 'office' | 'badge' | 'title' | 'animatronic';
export type Rarity = 'standard' | 'rare' | 'epic' | 'legendary' | 'golden';

export interface Cosmetic {
  id: string;
  category: CosmeticCategory;
  name: string;
  description: string;
  rarity: Rarity;
  price: number | null;
  unlock?: { achievement?: string; preset?: string; night?: { mode: string; n: number } };
  /** For animatronic skins: which character. */
  target?: string;
  params: Record<string, string | number | boolean>;
}

const g = (
  id: string,
  name: string,
  description: string,
  rarity: Rarity,
  price: number | null,
  params: Cosmetic['params'],
  unlock?: Cosmetic['unlock'],
): Cosmetic => ({ id, category: 'guard', name, description, rarity, price, params, unlock });

export const COSMETICS: Cosmetic[] = [
  // Guard uniforms
  g('guard_classic_blue', 'Classic Blue', 'Standard issue. Smells faintly of pizza.', 'standard', null, { shirt: '#2f4f8f', pants: '#1c2440', cap: '#1c2440', skin: '#e0b48c', pattern: 'plain' }),
  g('guard_graveyard_grey', 'Graveyard Grey', 'For the guard who has seen things.', 'standard', null, { shirt: '#6a6e72', pants: '#34373a', cap: '#2a2c2e', skin: '#d8a880', pattern: 'plain' }),
  g('guard_midnight_black', 'Midnight Black', 'Blends into the dark. Mostly.', 'standard', 150, { shirt: '#18181c', pants: '#0c0c0e', cap: '#0c0c0e', skin: '#c89070', pattern: 'plain' }),
  g('guard_pizza_red', 'Pizza Red', 'Matches the sauce stains.', 'standard', 120, { shirt: '#a8221c', pants: '#2a1a1a', cap: '#a8221c', skin: '#e8c0a0', pattern: 'plain' }),
  g('guard_mustard', 'Mustard Yellow', 'Bright enough to be found.', 'standard', 120, { shirt: '#c8a020', pants: '#3a3020', cap: '#3a3020', skin: '#b07850', pattern: 'plain' }),
  g('guard_purple_night', 'Purple Night', 'A cheeky nod. Nobody will suspect a thing.', 'epic', 1200, { shirt: '#4a2a7a', pants: '#2a1a4a', cap: '#2a1a4a', skin: '#a080c0', pattern: 'plain', badgeGlow: true }),
  g('guard_golden', 'Golden Guard', 'Earned at 4/20. Shines in the dark.', 'golden', null, { shirt: '#c8a030', pants: '#6a5018', cap: '#c8a030', skin: '#e0b48c', pattern: 'gold' }, { preset: 'four_twenty' }),
  g('guard_retro_1987', 'Retro 1987', 'Found behind the stage.', 'legendary', null, { shirt: '#3a6a8a', pants: '#2a2a3a', cap: '#c41e1e', skin: '#e0b48c', pattern: 'stripes' }, { achievement: 'cipher' }),
  g('guard_top_hat', 'Top Hat', 'Old friends dress for the occasion.', 'epic', null, { shirt: '#2a1a12', pants: '#1a120a', cap: '#111111', skin: '#e0b48c', pattern: 'plain', hat: 'top' }, { preset: 'old_friends' }),
  g('guard_endo_chic', 'Endo Chic', 'Exposed-wire print. Very in.', 'epic', 1400, { shirt: '#3a3d42', pants: '#222', cap: '#222', skin: '#e0b48c', pattern: 'wires' }),
  g('guard_party_staff', 'Party Staff', 'Party hat and stripes. Mandatory fun.', 'rare', 450, { shirt: '#d84a8a', pants: '#2a2a5a', cap: '#ffd21a', skin: '#e8c0a0', pattern: 'stripes', hat: 'party' }),
  g('guard_janitor', 'Janitor', 'Overalls. Someone has to mop.', 'rare', 400, { shirt: '#4a6a3a', pants: '#3a5a8a', cap: '#3a5a8a', skin: '#c89070', pattern: 'overalls' }),
  g('guard_day_manager', 'Day Manager', 'Tie and lanyard. Leaves voicemails.', 'rare', 550, { shirt: '#e8e8e0', pants: '#2a2a2a', cap: '#2a2a2a', skin: '#e0b48c', pattern: 'tie' }),
  // Accessories
  ...([
    ['acc_nvg', 'Night-Vision Goggles', 'Do not actually see in the dark.', 'rare', 500, 'goggles'],
    ['acc_eyepatch', 'Eyepatch', 'Arr.', 'epic', null, 'eyepatch'],
    ['acc_party_hat', 'Party Hat', 'Every night is somebody\'s birthday.', 'standard', 100, 'partyhat'],
    ['acc_headset', 'Headset', 'For the radio professional.', 'standard', 150, 'headset'],
    ['acc_bow_tie', 'Bow Tie', 'Just like the band.', 'standard', 120, 'bowtie'],
    ['acc_bunny_ears', 'Bunny Ears', 'Questionable choice, given everything.', 'rare', 450, 'ears'],
    ['acc_chef_hat', 'Chef Hat', 'Kitchen-adjacent.', 'standard', 180, 'chef'],
    ['acc_lucky_scarf', 'Lucky Scarf', 'Statistically no luckier.', 'rare', 500, 'scarf'],
  ] as const).map(([id, name, description, rarity, price, model]) => ({
    id,
    category: 'accessory' as const,
    name,
    description,
    rarity: rarity as Rarity,
    price,
    params: { model },
    unlock: id === 'acc_eyepatch' ? { preset: 'pirates_revenge' } : undefined,
  })),
  // Flashlights
  ...([
    ['flash_standard', 'Standard', 'Battery not included. Battery included.', 'standard', null, '#fff4d8'],
    ['flash_red', 'Red Lens', 'Easier on the eyes. Theirs.', 'standard', 150, '#ffb0a0'],
    ['flash_candy', 'Candy Cane', 'Festive.', 'rare', 400, '#ffe0e8'],
    ['flash_endo', 'Endo Mask', 'Earned at 10/20.', 'epic', null, '#d0f0ff'],
    ['flash_gold', 'Gold', 'For the guard with taste.', 'legendary', 3000, '#ffe8a0'],
  ] as const).map(([id, name, description, rarity, price, tint]) => ({
    id,
    category: 'flashlight' as const,
    name,
    description,
    rarity: rarity as Rarity,
    price,
    params: { tint },
    unlock: id === 'flash_endo' ? { preset: 'ten_twenty' } : undefined,
  })),
  // Tablets
  ...([
    ['tablet_green', 'Green CRT', 'Standard security issue.', 'standard', null, 'green', '#2a2a2a'],
    ['tablet_amber', 'Amber CRT', 'Warm, like old terminals.', 'standard', 150, 'amber', '#3a2a1a'],
    ['tablet_ice', 'Ice Blue', 'Cold comfort.', 'rare', 450, 'blue', '#1a2a3a'],
    ['tablet_glitch', 'Glitch', 'Something is in the system.', 'epic', null, 'glitch', '#2a1a3a'],
    ['tablet_sticker', 'Sticker Bomb', 'Covered in party stickers.', 'rare', 500, 'green', '#c84a8a'],
    ['tablet_golden', 'Golden', 'For people who have seen him.', 'golden', null, 'amber', '#c8a030'],
  ] as const).map(([id, name, description, rarity, price, theme, frame]) => ({
    id,
    category: 'tablet' as const,
    name,
    description,
    rarity: rarity as Rarity,
    price,
    params: { theme, frame },
    unlock: id === 'tablet_glitch' ? { preset: 'everyone' } : id === 'tablet_golden' ? { achievement: 'golden_star' } : undefined,
  })),
  // Office decor
  ...([
    ['office_default', 'Default Desk', 'A fan, a cup, some paperwork.', 'standard', null, 'default'],
    ['office_cupcake', 'Cupcake', 'Earned on Ladies\' Night. It is watching you.', 'epic', null, 'cupcake'],
    ['office_plush', 'Plush Pals', 'Small plush versions of the band.', 'rare', 600, 'plush'],
    ['office_drawings', 'Kid Drawings', 'Crayon drawings taped to the wall.', 'rare', null, 'drawings'],
    ['office_golden_hour', 'Golden Hour', 'Gold-tinted desk props.', 'golden', null, 'golden'],
    ['office_arcade', 'Retro Arcade', 'A tiny arcade cabinet on the desk.', 'epic', 1500, 'arcade'],
    ['office_haunted', 'Haunted', 'Flickering candles and cobwebs.', 'epic', 1200, 'haunted'],
  ] as const).map(([id, name, description, rarity, price, theme]) => ({
    id,
    category: 'office' as const,
    name,
    description,
    rarity: rarity as Rarity,
    price,
    params: { theme },
    unlock:
      id === 'office_cupcake'
        ? { preset: 'ladies_night' }
        : id === 'office_drawings'
          ? { achievement: 'minigame_all' }
          : id === 'office_golden_hour'
            ? { preset: 'golden' }
            : undefined,
  })),
  // Badges
  ...([
    ['badge_rookie', 'Rookie', null, 'standard', '#8a8a8a', undefined],
    ['badge_night5', 'Night 5 Survivor', null, 'rare', '#3ab03a', { achievement: 'night5' }],
    ['badge_star1', 'Star 1', null, 'rare', '#ffd21a', { achievement: 'night5' }],
    ['badge_star2', 'Star 2', null, 'epic', '#ffd21a', { achievement: 'night6' }],
    ['badge_star3', 'Star 3', null, 'legendary', '#ffd21a', { preset: 'four_twenty' }],
    ['badge_ultimate', 'Ultimate', null, 'golden', '#ff3a3a', { preset: 'everyone' }],
    ['badge_puppeteer', 'Puppeteer', null, 'epic', '#c44fd0', { achievement: 'puppeteer' }],
    ['badge_ghost', 'Ghost Whisperer', null, 'epic', '#9ad8ff', { achievement: 'ghost_help' }],
  ] as const).map(([id, name, price, rarity, color, unlock]) => ({
    id,
    category: 'badge' as const,
    name,
    description: `A ${name} badge for your name.`,
    rarity: rarity as Rarity,
    price,
    params: { color },
    unlock: unlock as Cosmetic['unlock'],
  })),
  // Titles
  ...([
    ['title_rookie', 'Rookie', null, 'standard', undefined],
    ['title_night_owl', 'Night Owl', 300, 'standard', undefined],
    ['title_door_slammer', 'Door Slammer', 300, 'standard', undefined],
    ['title_camera_hog', 'Camera Hog', 300, 'standard', undefined],
    ['title_pizza_purist', 'Pizza Purist', null, 'rare', { achievement: 'classic5' }],
    ['title_puppeteer', 'Puppeteer', null, 'epic', { achievement: 'puppeteer' }],
    ['title_ultimate', 'Ultimate', null, 'golden', { preset: 'everyone' }],
    ['title_its_me', "It's Me", null, 'legendary', { achievement: 'its_me' }],
  ] as const).map(([id, name, price, rarity, unlock]) => ({
    id,
    category: 'title' as const,
    name,
    description: `Shows "${name}" under your name.`,
    rarity: rarity as Rarity,
    price,
    params: { text: name },
    unlock: unlock as Cosmetic['unlock'],
  })),
  // Animatronic skins (Showtime and your solo games)
  ...([
    ['anim_freddy_classic', 'freddy', 'Classic', 'standard', null, ''],
    ['anim_freddy_shadow', 'freddy', 'Shadow', 'epic', 1200, 'shadow'],
    ['anim_freddy_rockstar', 'freddy', 'Rockstar', 'rare', 500, 'rockstar'],
    ['anim_freddy_withered', 'freddy', 'Withered', 'rare', 500, 'withered'],
    ['anim_bonnie_classic', 'bonnie', 'Classic', 'standard', null, ''],
    ['anim_bonnie_glamrock', 'bonnie', 'Glamrock', 'epic', 1300, 'glamrock'],
    ['anim_bonnie_withered', 'bonnie', 'Withered', 'rare', 500, 'withered'],
    ['anim_chica_classic', 'chica', 'Classic', 'standard', null, ''],
    ['anim_chica_rockstar', 'chica', 'Rockstar', 'rare', 500, 'rockstar'],
    ['anim_chica_party', 'chica', 'Party', 'rare', 450, 'party'],
    ['anim_foxy_classic', 'foxy', 'Classic', 'standard', null, ''],
    ['anim_foxy_captain', 'foxy', 'Captain', 'epic', 1100, 'captain'],
    ['anim_foxy_glitched', 'foxy', 'Glitched', 'legendary', 3000, 'glitched'],
  ] as const).map(([id, target, name, rarity, price, variant]) => ({
    id,
    category: 'animatronic' as const,
    target,
    name,
    description: `${name} look for one animatronic, used when you're the Puppeteer.`,
    rarity: rarity as Rarity,
    price,
    params: { variant },
  })),
];

export const COSMETICS_BY_ID: Record<string, Cosmetic> = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));

export const DEFAULT_COSMETICS = [
  'guard_classic_blue',
  'guard_graveyard_grey',
  'flash_standard',
  'tablet_green',
  'office_default',
  'badge_rookie',
  'title_rookie',
  'anim_freddy_classic',
  'anim_bonnie_classic',
  'anim_chica_classic',
  'anim_foxy_classic',
];

export const DEFAULT_EQUIPPED: Record<string, string> = {
  guard: 'guard_classic_blue',
  flashlight: 'flash_standard',
  tablet: 'tablet_green',
  office: 'office_default',
  badge: 'badge_rookie',
  title: 'title_rookie',
};

/** Slot key a cosmetic equips into. Animatronic skins use `animatronic.<id>`. */
export function slotFor(c: Cosmetic): string {
  return c.category === 'animatronic' ? `animatronic.${c.target}` : c.category;
}

/** Daily rotation: four purchasable items, seeded by UTC date so everyone sees the same shop. */
export function shopRotation(date: Date): string[] {
  const key = date.toISOString().slice(0, 10);
  const rng = createRng(hashString(`shop:${key}`));
  const pool = COSMETICS.filter((c) => c.price !== null && c.rarity !== 'standard').map((c) => c.id);
  const out: string[] = [];
  while (out.length < 4 && pool.length) {
    const i = Math.floor(next(rng) * pool.length);
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

/** Items buyable today: the rotation plus every standard item with a price. */
export function buyableToday(date: Date): Set<string> {
  const s = new Set(shopRotation(date));
  for (const c of COSMETICS) if (c.price !== null && c.rarity === 'standard') s.add(c.id);
  return s;
}
