import { go, register, setFrame } from '../../app';
import { audio } from '../../audio/engine';
import { FreeRoam, type FreeRoamMode } from '../../game/freeroam';
import { store } from '../../store';

register('freeroam', (root, params) => {
  const mode = (params.mode as FreeRoamMode) ?? 'day';
  const night = Number(params.night ?? 1);
  const game = new FreeRoam(mode, root, night);
  game.onExit = () => go('title');
  const debugOk = new URLSearchParams(location.search).has('debug') && ['localhost', '127.0.0.1'].includes(location.hostname);
  if (debugOk || store.config.testHooks) window.__fr = game;
  void audio.init().catch(() => {});
  setFrame((dt, t) => game.frame(dt, t));
  return () => {
    setFrame(null);
    game.dispose();
    window.__fr = undefined;
  };
});
