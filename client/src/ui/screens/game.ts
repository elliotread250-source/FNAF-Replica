import { register, go } from '../../app';
import { GameSession } from '../../game/session';
import type { NightEnd, NightStart } from '../../game/types';
import { stopMenuAudio } from './title';
import { store } from '../../store';

let session: GameSession | null = null;
let pendingEnd: NightEnd | null = null;

export function currentSession(): GameSession | null {
  return session;
}

register('game', (root, params) => {
  stopMenuAudio();
  const start = params.start as NightStart;
  session?.dispose();
  session = new GameSession(start, (end) => {
    session?.dispose();
    session = null;
    void store.refreshMe();
    go('paycheck', { end });
  });
  session.mount(root);
  if (pendingEnd) {
    session.onNightEnd(pendingEnd);
    pendingEnd = null;
  }
  return () => {
    session?.dispose();
    session = null;
  };
});

export function deliverNightEnd(e: NightEnd): void {
  if (session) session.onNightEnd(e);
  else pendingEnd = e;
}
