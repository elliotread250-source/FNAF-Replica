export interface Achievement {
  id: string;
  name: string;
  description: string;
  reward?: string;
  icon: string; // a tiny glyph used by the procedural SVG icon
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_shift', name: 'First Shift', description: 'Survive Night 1 in any mode', icon: '1' },
  { id: 'night5', name: 'Employee of the Week', description: 'Beat Night 5 in Night Shift', reward: 'badge_night5', icon: '5' },
  { id: 'classic5', name: 'Old School', description: 'Beat Night 5 in Classic Office', reward: 'title_pizza_purist', icon: 'C' },
  { id: 'night6', name: 'Overtime', description: 'Beat Night 6', reward: 'badge_star2', icon: '6' },
  { id: 'four_twenty', name: 'Twenty Twenty Twenty', description: 'Beat the 4/20 preset', icon: '★' },
  { id: 'its_me', name: "It's Me", description: 'Get caught by Golden Freddy', reward: 'title_its_me', icon: '?' },
  { id: 'no_doors', name: 'Open Door Policy', description: 'Survive a night without closing a door', icon: 'D' },
  { id: 'no_cams', name: 'Blind Faith', description: 'Survive a night without raising the tablet', icon: 'B' },
  { id: 'last_one_standing', name: 'Last Guard Standing', description: 'Be the only survivor at 6 AM in a 4-player lobby', icon: 'L' },
  { id: 'full_team', name: 'Nobody Left Behind', description: 'All four guards survive Night 5', icon: '4' },
  { id: 'zero_power', name: 'Running On Fumes', description: 'Survive with 0% power at 6 AM', icon: '0' },
  { id: 'toreador', name: 'Saved By The Bell', description: 'Survive the power-out sequence by reaching 6 AM', icon: '♪' },
  { id: 'fox_bounce', name: 'Not Today, Captain', description: 'Send the fox back with the flashlight 3 times in one night', icon: 'F' },
  { id: 'mask_master', name: 'Fooled You', description: 'Fool 5 animatronics with the mask in one night', icon: 'M' },
  { id: 'technician', name: 'Duct Tape Hero', description: 'Reboot 10 systems in one night', icon: 'T' },
  { id: 'lullaby', name: 'Lullaby', description: 'Never let the music box drop below 25% on Night 5', icon: '♫' },
  { id: 'ghost_help', name: 'Ghost Whisperer', description: 'As a Ghost, ping an animatronic within 5 seconds before a teammate closes the door on it', reward: 'badge_ghost', icon: 'G' },
  { id: 'puppeteer', name: 'Showtime!', description: 'Win as the Puppeteer', reward: 'title_puppeteer', icon: 'P' },
  { id: 'wipe', name: 'Full House', description: 'Wipe four guards as the Puppeteer', icon: 'W' },
  { id: 'honk', name: 'Honk', description: 'Boop the nose on the poster in your office', icon: 'H' },
  { id: 'collector', name: 'Collector', description: 'Own 25 cosmetics', icon: '$' },
  { id: 'fashion', name: 'Dressed To Kill', description: 'Change your skin 10 times', icon: 'S' },
  { id: 'newspaper', name: 'Investigative Reporter', description: 'Zoom into all six newspaper clippings', icon: 'N' },
  { id: 'cipher', name: 'Code Breaker', description: 'Find the hidden backstage secret', icon: 'X' },
  { id: 'minigame_all', name: 'Save Them', description: 'Complete all three after-hours minigames', reward: 'office_drawings', icon: '8' },
  { id: 'spectator', name: 'Front Row Seat', description: 'Spend 5 minutes as a Ghost in a single night', icon: 'E' },
  { id: 'hundred', name: 'Lifer', description: 'Play 100 nights', icon: 'C' },
  { id: 'bonnie_x10', name: 'Bunny Trouble', description: 'Get caught by the rabbit 10 times', icon: 'R' },
  { id: 'speedrun', name: 'Clock Watcher', description: "Win a night with your team's total tablet time under 60 seconds", icon: 'K' },
  { id: 'golden_star', name: 'Golden Star', description: 'Beat every Custom Night preset', reward: 'tablet_golden', icon: '✦' },
  { id: 'first_blood', name: 'Bad First Day', description: 'Get caught for the first time', icon: '!' },
  { id: 'shadow_seen', name: 'Not Really There', description: 'Stare into the glitch dimension', icon: '~' },
];

export const ACHIEVEMENTS_BY_ID: Record<string, Achievement> = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
