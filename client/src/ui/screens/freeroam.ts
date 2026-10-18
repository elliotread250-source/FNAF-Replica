import { go, register, setFrame } from '../../app';
import { audio } from '../../audio/engine';
import { FreeRoam, type FreeRoamMode } from '../../game/freeroam';
import { store } from '../../store';

register('freeroam', (root, params) => {
  const mode = (params.mode as FreeRoamMode) ?? 'day';
  const game = new FreeRoam(mode, root);
  const debugOk = new URLSearchParams(location.search).has('debug') && ['localhost', '127.0.0.1'].includes(location.hostname);
  if (debugOk || store.config.testHooks) window.__fr = game;
  void audio.init().catch(() => {});
  setFrame((dt, t) => game.frame(dt, t));
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'KeyP' && e.shiftKey) go('title');
  };
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('keydown', onKey);
    setFrame(null);
    game.dispose();
    window.__fr = undefined;
  };
});
