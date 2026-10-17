export interface Preset {
  id: string;
  name: string;
  ai: { freddy: number; bonnie: number; chica: number; foxy: number };
  puppet?: number; // unwind rate %/s, 0 = off
  extended?: Record<string, number>;
  reward: string[];
  rewardText: string;
}

export const PRESETS: Preset[] = [
  { id: 'golden', name: 'Golden Freddy', ai: { freddy: 1, bonnie: 9, chica: 8, foxy: 7 }, reward: ['office_golden_hour'], rewardText: '"It\'s Me" achievement and the Golden Hour desk' },
  { id: 'old_friends', name: 'Old Friends', ai: { freddy: 20, bonnie: 0, chica: 0, foxy: 0 }, reward: ['guard_top_hat'], rewardText: 'Top Hat guard uniform' },
  { id: 'pirates_revenge', name: "Pirate's Revenge", ai: { freddy: 0, bonnie: 0, chica: 0, foxy: 20 }, reward: ['acc_eyepatch'], rewardText: 'Eyepatch accessory' },
  { id: 'ladies_night', name: "Ladies' Night", ai: { freddy: 0, bonnie: 0, chica: 20, foxy: 0 }, reward: ['office_cupcake'], rewardText: 'Cupcake desk prop' },
  { id: 'four_twenty', name: '4/20', ai: { freddy: 4, bonnie: 20, chica: 20, foxy: 20 }, reward: ['guard_golden', 'badge_star3'], rewardText: 'Golden Guard uniform and the third star' },
  { id: 'ten_twenty', name: '10/20', ai: { freddy: 20, bonnie: 20, chica: 20, foxy: 20 }, puppet: 1.8, reward: ['flash_endo'], rewardText: 'Endo Mask flashlight' },
  {
    id: 'everyone',
    name: 'Everyone',
    ai: { freddy: 20, bonnie: 20, chica: 20, foxy: 20 },
    puppet: 1.8,
    extended: { endo: 10, toy_freddy: 10, mangle: 10, bb: 10, shadow_freddy: 10, springtrap: 10, phantom_foxy: 10, nightmare: 10 },
    reward: ['title_ultimate', 'tablet_glitch'],
    rewardText: '"Ultimate" title and the Glitch tablet',
  },
];

export function matchPreset(ai: { freddy: number; bonnie: number; chica: number; foxy: number }): Preset | null {
  return (
    PRESETS.find(
      (p) => p.ai.freddy === ai.freddy && p.ai.bonnie === ai.bonnie && p.ai.chica === ai.chica && p.ai.foxy === ai.foxy,
    ) ?? null
  );
}
