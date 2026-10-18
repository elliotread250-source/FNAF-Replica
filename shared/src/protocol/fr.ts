import { z } from 'zod';
import type { HiddenState, FrEvent } from '../sim/fr/sim';
import type { Body } from '../sim/fr/controller';

// Free-roam wire protocol. Clients send one command per 30 Hz tick; the server answers with per-client
// snapshots at about 20 Hz (interest-managed) and acknowledges the last command it applied, so the
// client can reconcile its predicted movement.

const n = z.number().finite();

export const FrActZ = z.discriminatedUnion('type', [
  z.object({ type: z.literal('door'), id: z.number().int().min(0).max(255) }),
  z.object({ type: z.literal('item'), id: z.string().min(1).max(40) }),
  z.object({ type: z.literal('hide'), id: z.number().int().min(0).max(255) }),
  z.object({ type: z.literal('unhide'), exit: z.number().int().min(0).max(3) }),
  z.object({ type: z.literal('revive'), pid: z.string().max(64) }),
]);

export const FrCmdZ = z.object({
  fwd: n.min(-1).max(1),
  strafe: n.min(-1).max(1),
  yaw: n.min(-1000).max(1000),
  pitch: n.min(-1.6).max(1.6),
  sprint: z.boolean(),
  stance: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  jump: z.boolean(),
  flash: z.boolean(),
  breath: z.boolean(),
  hold: z.boolean().optional(),
  act: FrActZ.optional(),
});

export const FrCmdMsgZ = z.object({ seq: z.number().int().min(0), cmd: FrCmdZ });

export interface FrRosterEntry {
  id: string;
  name: string;
  equipped: Record<string, string>;
}

export interface FrStart {
  seed: number;
  night: number;
  you: string;
  players: FrRosterEntry[];
  hourSeconds: number;
  tick: number;
  testHooks: boolean;
}

export interface FrSnapPlayer {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  st: 0 | 1 | 2;
  h: number;
  f: boolean;
  hid: number;
  d: boolean;
  g: boolean;
  sp: number;
  rp: number;
}

export interface FrSnapAgent {
  id: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  s: string;
  a: string;
  sp: number;
}

export interface FrSnapMe {
  body: Body;
  battery: number;
  breath: number;
  hidden: HiddenState | null;
  downed: boolean;
  bleed: number;
  ghost: boolean;
  revives: number;
  reviveProgress: number;
}

export interface FrSnap {
  tick: number;
  time: number;
  hour: number;
  ack: number;
  me: FrSnapMe;
  players: FrSnapPlayer[];
  agents: FrSnapAgent[];
  /** Door open fraction per door id, two decimals. */
  doors: number[];
  /** Door target per door id (1 = opening/open). */
  targets: number[];
  power: { main: boolean; circuits: string[] };
  ev: FrEvent[];
  over: { won: boolean } | null;
}
