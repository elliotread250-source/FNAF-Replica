import { z } from 'zod';

export const StationIdZ = z.enum(['office', 'solo', 'west', 'east', 'south', 'control']);
export const ModeZ = z.enum(['classic', 'nightshift', 'showtime']);
const NodeZ = z.string().min(1).max(32);
const DoorZ = z.string().min(1).max(16);
const SystemZ = z.string().regex(/^(cameras|audio|ventilation|power|doors_[a-z]+|all)$/);

export const InputZ = z.discriminatedUnion('action', [
  z.object({ action: z.literal('door'), door: DoorZ, closed: z.boolean() }),
  z.object({ action: z.literal('light'), door: DoorZ, on: z.boolean() }),
  z.object({ action: z.literal('tablet'), up: z.boolean() }),
  z.object({ action: z.literal('camera'), node: NodeZ }),
  z.object({ action: z.literal('ping'), node: NodeZ }),
  z.object({
    action: z.literal('tool'),
    tool: z.enum(['flashlight', 'mic', 'mask', 'wind', 'panel', 'reboot', 'lure', 'boost']),
    on: z.boolean().optional(),
    system: SystemZ.optional(),
    node: NodeZ.optional(),
    station: StationIdZ.optional(),
  }),
  z.object({ action: z.literal('nose') }),
  z.object({ action: z.literal('vote_mute') }),
  z.object({ action: z.literal('locker_click') }),
  z.object({ action: z.literal('showtime_move'), anim: z.string().max(24), node: NodeZ.optional(), door: DoorZ.optional() }),
  z.object({ action: z.literal('showtime_ability'), ability: z.enum(['lights_out', 'static']), station: StationIdZ }),
]);
export type InputMsg = z.infer<typeof InputZ>;

export const CustomAiZ = z.object({
  freddy: z.number().int().min(0).max(20),
  bonnie: z.number().int().min(0).max(20),
  chica: z.number().int().min(0).max(20),
  foxy: z.number().int().min(0).max(20),
});

export const LobbyOptionsZ = z.object({
  public: z.boolean().default(false),
  ghostsTalk: z.boolean().default(false),
  fillBots: z.boolean().default(false),
});

export const C2S = {
  'lobby:create': z.object({ mode: ModeZ, night: z.number().int().min(1).max(7), options: LobbyOptionsZ.partial().optional() }),
  'lobby:join': z.object({ code: z.string().regex(/^[A-Za-z]{4}$/) }),
  'lobby:leave': z.object({}).optional(),
  'lobby:list': z.object({}).optional(),
  'lobby:quick': z.object({}).optional(),
  'lobby:station': z.object({ station: StationIdZ }),
  'lobby:ready': z.object({ ready: z.boolean() }),
  'lobby:settings': z.object({
    mode: ModeZ.optional(),
    night: z.number().int().min(1).max(7).optional(),
    customAi: CustomAiZ.optional(),
    puppet: z.number().min(0).max(3).optional(),
    extended: z.record(z.string().max(24), z.number().int().min(0).max(20)).optional(),
    options: LobbyOptionsZ.partial().optional(),
  }),
  'lobby:start': z.object({}).optional(),
  'lobby:kick': z.object({ userId: z.string().max(64) }),
  'lobby:puppeteer': z.object({ userId: z.string().max(64) }),
  'lobby:skin': z.object({}).optional(),
  input: z.object({ seq: z.number().int().min(0), input: InputZ }),
  look: z.object({ yaw: z.number().min(-3.2).max(3.2) }),
  chat: z.object({ text: z.string().min(1).max(120) }),
  callout: z.object({ id: z.number().int().min(0).max(7) }),
  'voice:signal': z.object({ to: z.string().max(64), data: z.unknown() }),
  'voice:speaking': z.object({ on: z.boolean() }),
  resume: z.object({ lobbyCode: z.string().max(8), lastAckTick: z.number().int().min(0) }),
  'ping:clock': z.object({ t0: z.number() }),
} as const;

export type C2SName = keyof typeof C2S;

export const CALLOUTS = ['Left door!', 'Right door!', 'Check cams!', 'Low power!', "Foxy's running!", "Freddy's moving!", "I'm fine", 'Help!'];

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ';

export interface LobbyPlayer {
  userId: string;
  name: string;
  stars: number;
  station: string | null;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
  isBot: boolean;
  puppeteer: boolean;
  equipped: Record<string, string>;
  badge: string | null;
  title: string | null;
}

export interface LobbyState {
  code: string;
  hostId: string;
  mode: 'classic' | 'nightshift' | 'showtime';
  night: number;
  customAi: { freddy: number; bonnie: number; chica: number; foxy: number };
  puppet: number;
  extended: Record<string, number>;
  options: { public: boolean; ghostsTalk: boolean; fillBots: boolean };
  players: LobbyPlayer[];
  state: 'waiting' | 'in_night' | 'results';
  rosterMode: 'tribute' | 'original';
  hostHighestNight: number;
}

export interface LobbySummary {
  code: string;
  mode: string;
  night: number;
  players: number;
  max: number;
  host: string;
  stars: number;
}
