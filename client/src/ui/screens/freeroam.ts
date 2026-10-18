import { go, register, setFrame } from '../../app';
import { audio } from '../../audio/engine';
import { FreeRoam, type FreeRoamMode } from '../../game/freeroam';
import { store } from '../../store';
import type { FrStart } from '@fnaf/shared';
import type { NightEnd } from '../../game/types';
import { stopMenuAudio } from './title';

let active: FreeRoam | null = null;
let pending: NightEnd | null = null;

/** The server's paycheck for a free-roam night. */
export function deliverFrEnd(e: NightEnd): void {
  if (active) active.deliverEnd(e);
  else pending = e;
}

register('freeroam', (root, params) => {
  const mode = (params.mode as FreeRoamMode) ?? 'day';
  const night = Number(params.night ?? 1);
  const net = (params.net as FrStart | undefined) ?? null;
  stopMenuAudio();
  const game = new FreeRoam(net ? 'night' : mode, root, night, net);
  active = game;
  let left = false;
  game.onExit = () => {
    if (left) return;
    left = true;
    go(net ? 'lobby' : 'title');
  };
  game.onNightEnd = (e) => {
    if (left) return;
    left = true;
    void store.refreshMe();
    go('paycheck', { end: e });
  };
  if (pending) {
    game.deliverEnd(pending);
    pending = null;
  }
  const debugOk = new URLSearchParams(location.search).has('debug') && ['localhost', '127.0.0.1'].includes(location.hostname);
  if (debugOk || store.config.testHooks || net?.testHooks) window.__fr = game;
  void audio.init().catch(() => {});
  setFrame((dt, t) => game.frame(dt, t));
  return () => {
    setFrame(null);
    game.dispose();
    if (active === game) active = null;
    window.__fr = undefined;
  };
});
