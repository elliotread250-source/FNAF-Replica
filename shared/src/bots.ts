import { createRng, chance, int, pick, type Rng } from './rng';
import type { Input, SimEvent } from './sim/types';
import type { PlayerView } from './sim/view';
import type { DoorId, NodeId } from './content/mapTypes';
import { ROSTER_BY_ID } from './content/roster';

export type BotSkill = 'novice' | 'average' | 'expert';

const PROFILES: Record<BotSkill, { reaction: number; camEvery: [number, number]; lightEvery: [number, number]; coveCare: number; camLinger: number; maskable: number }> = {
  novice: { reaction: 18, camEvery: [40, 90], lightEvery: [70, 140], coveCare: 0.25, camLinger: 30, maskable: 0.6 },
  average: { reaction: 10, camEvery: [70, 140], lightEvery: [50, 100], coveCare: 0.6, camLinger: 18, maskable: 0.85 },
  expert: { reaction: 5, camEvery: [90, 180], lightEvery: [35, 70], coveCare: 0.95, camLinger: 12, maskable: 1 },
};

interface Scheduled {
  at: number;
  input: Input;
}

export interface Bot {
  pid: string;
  skill: BotSkill;
  rng: Rng;
  queue: Scheduled[];
  nextCam: number;
  nextLight: number;
  camPlan: NodeId[];
  camUntil: number;
  lightOffAt: Record<DoorId, number>;
  reopenCheckAt: Record<DoorId, number>;
  foxyDoorUntil: number;
}

export function createBot(pid: string, skill: BotSkill, seed: number): Bot {
  return {
    pid,
    skill,
    rng: createRng(seed),
    queue: [],
    nextCam: 40,
    nextLight: 20,
    camPlan: [],
    camUntil: 0,
    lightOffAt: {},
    reopenCheckAt: {},
    foxyDoorUntil: 0,
  };
}

function schedule(bot: Bot, at: number, input: Input): void {
  bot.queue.push({ at, input });
}

const FOXY_STATIONS = ['west', 'solo', 'office'];

/**
 * One bot tick. Bots only use what their station could perceive: the filtered view and the events
 * the server sends them, the same as a human client receives.
 */
export function botTick(bot: Bot, view: PlayerView, events: SimEvent[], tick: number): Input[] {
  const P = PROFILES[bot.skill];
  const out: Input[] = [];
  const me = view.me;
  if (!me.alive || !me.st || view.ended || view.po.on) return out;
  const myDoors = Object.entries(view.doors).filter(([, d]) => d.st === me.st).map(([id]) => id);
  const foxyDoor = myDoors.find((d) => d === 'west' || d === 'left');
  const react = tick + P.reaction + int(bot.rng, 0, P.reaction);

  for (const e of events) {
    if (e.type === 'at_door' && typeof e.door === 'string') {
      schedule(bot, react, { action: 'tablet', up: false });
      schedule(bot, react + 1, { action: 'light', door: e.door, on: true });
    }
    if ((e.type === 'foxy_run' || e.type === 'sting') && foxyDoor && FOXY_STATIONS.includes(me.st)) {
      if (e.type === 'foxy_run' || e.door === foxyDoor) {
        schedule(bot, react, { action: 'tablet', up: false });
        schedule(bot, react + 1, { action: 'door', door: foxyDoor, closed: true });
        bot.foxyDoorUntil = tick + 20 * 30;
      }
    }
    if (e.type === 'knock' && foxyDoor) bot.foxyDoorUntil = tick + 40;
    if (e.type === 'puppet_out' && me.st === 'control') schedule(bot, react, { action: 'tool', tool: 'wind', on: true });
    if (e.type === 'system_fail' && me.st === 'control') schedule(bot, react + 20, { action: 'tool', tool: 'reboot', system: e.system as 'cameras' });
    if ((e.type === 'groan' || e.type === 'in_office') && me.st === 'south') {
      const anim = String(e.anim);
      if (ROSTER_BY_ID[anim]?.maskable && chance(bot.rng, P.maskable)) {
        schedule(bot, tick + Math.min(P.reaction, 20), { action: 'tablet', up: false });
        schedule(bot, tick + Math.min(P.reaction, 20) + 1, { action: 'tool', tool: 'mask', on: true });
      }
    }
    if (e.type === 'fooled_leave' && me.st === 'south') schedule(bot, tick + 10, { action: 'tool', tool: 'mask', on: false });
  }

  // Visible threats at my doors: close them.
  for (const a of view.an) {
    if (a.s === 'at_door' && a.d && myDoors.includes(a.d) && !view.doors[a.d].c) {
      schedule(bot, react, { action: 'door', door: a.d, closed: true });
      schedule(bot, react, { action: 'light', door: a.d, on: false });
      bot.reopenCheckAt[a.d] = tick + 60 + int(bot.rng, 0, 60);
    }
    if (a.s === 'in_office' && me.st === 'south' && !me.mask && ROSTER_BY_ID[a.id]?.maskable) {
      if (chance(bot.rng, P.maskable / 4)) out.push({ action: 'tool', tool: 'mask', on: true });
    }
    // Watching Foxy run on camera: slam the door.
    if (a.id === 'foxy' && a.run && foxyDoor && FOXY_STATIONS.includes(me.st)) {
      schedule(bot, react, { action: 'tablet', up: false });
      schedule(bot, react + 1, { action: 'door', door: foxyDoor, closed: true });
      bot.foxyDoorUntil = tick + 20 * 30;
    }
    if (a.id === 'foxy' && (a.st ?? 0) >= 2 && foxyDoor && bot.skill === 'expert') bot.foxyDoorUntil = Math.max(bot.foxyDoorUntil, tick + 20 * 8);
  }

  // Light management: turn lights off after a short look, reopen doors that are clear.
  for (const d of myDoors) {
    const door = view.doors[d];
    if (door.l && !bot.lightOffAt[d]) bot.lightOffAt[d] = tick + 8;
    if (door.l && tick >= (bot.lightOffAt[d] ?? 0)) {
      const seen = view.an.some((a) => a.d === d && a.s === 'at_door');
      out.push({ action: 'light', door: d, on: false });
      bot.lightOffAt[d] = 0;
      if (!seen && door.c && d !== foxyDoor) out.push({ action: 'door', door: d, closed: false });
      if (!seen && door.c && d === foxyDoor && tick > bot.foxyDoorUntil) out.push({ action: 'door', door: d, closed: false });
    }
    if (door.c && bot.reopenCheckAt[d] && tick >= bot.reopenCheckAt[d] && !me.tablet) {
      bot.reopenCheckAt[d] = 0;
      out.push({ action: 'light', door: d, on: true });
    }
  }
  if (foxyDoor && view.doors[foxyDoor]?.c && tick > bot.foxyDoorUntil && !bot.reopenCheckAt[foxyDoor]) {
    bot.reopenCheckAt[foxyDoor] = tick + 5;
  }
  if (foxyDoor && bot.skill !== 'novice' && tick < bot.foxyDoorUntil && !view.doors[foxyDoor].c && !me.tablet) {
    out.push({ action: 'door', door: foxyDoor, closed: true });
  }

  // Technician: keep the music box wound and the panel green.
  if (me.st === 'control') {
    const wantWind = view.mb.on && view.mb.lvl < (bot.skill === 'novice' ? 35 : 60);
    if (wantWind !== me.wind && !me.tablet) out.push({ action: 'tool', tool: 'wind', on: wantWind });
    if (view.failed.length && !me.reboot && tick % 40 === 0 && !me.tablet) {
      out.push({ action: 'tool', tool: 'reboot', system: (view.failed.length > 2 ? 'all' : view.failed[0]) as 'cameras' });
    }
  } else if (view.mb.on && view.mb.lvl < 20 && !view.stations.some((s) => s.id === 'control' && s.alive && !s.sealed)) {
    if (!me.tablet) out.push({ action: 'tablet', up: true });
    else if (me.cam !== 'arcade') out.push({ action: 'camera', node: 'arcade' });
    else if (!me.wind) out.push({ action: 'tool', tool: 'wind', on: true });
  } else if (me.wind && view.mb.lvl > 70) {
    out.push({ action: 'tool', tool: 'wind', on: false });
  }

  // Periodic light sweep.
  if (tick >= bot.nextLight && !me.tablet && !me.mask && myDoors.length) {
    bot.nextLight = tick + int(bot.rng, ...P.lightEvery);
    const d = pick(bot.rng, myDoors);
    if (!view.doors[d].l) out.push({ action: 'light', door: d, on: true });
  }

  // Camera checks: cove for Foxy guards, plus the nearest corners.
  if (!me.tablet && tick >= bot.nextCam && !me.mask && view.p > 0) {
    const lowPower = view.p < 15 && bot.skill !== 'novice';
    bot.nextCam = tick + int(bot.rng, ...P.camEvery) * (lowPower ? 3 : 1);
    if (!lowPower || bot.skill === 'novice') {
      const plan: NodeId[] = [];
      if (FOXY_STATIONS.includes(me.st) && chance(bot.rng, P.coveCare)) plan.push('cove');
      if (me.st === 'east' || me.st === 'south' || me.st === 'office') plan.push(me.st === 'south' ? 'south_hall' : 'east_corner');
      if (bot.skill === 'novice') plan.push(pick(bot.rng, ['dining', 'stage', 'party_a', 'kitchen']));
      if (plan.length) {
        bot.camPlan = plan;
        out.push({ action: 'tablet', up: true });
        bot.camUntil = tick + P.camLinger * plan.length;
      }
    }
  }
  if (me.tablet) {
    if (bot.camPlan.length) {
      const next = bot.camPlan[0];
      if (me.cam !== next) out.push({ action: 'camera', node: next });
      else if (tick % P.camLinger === 0) bot.camPlan.shift();
    }
    if (tick >= bot.camUntil && !bot.camPlan.length && !(me.st === 'control' && me.wind) && !(view.mb.lvl < 20 && me.cam === 'arcade')) {
      out.push({ action: 'tablet', up: false });
    }
  }
  if (me.mask && !view.an.some((a) => a.s === 'in_office') && tick % 60 === 0) out.push({ action: 'tool', tool: 'mask', on: false });

  // Flush scheduled inputs that are due.
  const due = bot.queue.filter((q) => q.at <= tick);
  bot.queue = bot.queue.filter((q) => q.at > tick);
  return [...due.map((q) => q.input), ...out];
}
