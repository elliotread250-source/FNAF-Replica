import { io, type Socket } from 'socket.io-client';
import type { LobbyState } from '@fnaf/shared';
import { store } from '../store';
import { toast } from '../ui/dom';

let socket: Socket | null = null;
let clockOffset = 0;
let rtt = 0;

/** Same-origin connection: no hardcoded URL, works behind Railway's proxy. */
export function getSocket(): Socket {
  if (socket) return socket;
  socket = io({ withCredentials: true, transports: ['websocket', 'polling'] });
  socket.on('lobby:state', (s: LobbyState) => {
    store.lobby = s;
    store.emit();
  });
  socket.on('lobby:error', (e: { message: string; code: string }) => {
    if (e.code === 'kicked') {
      store.lobby = null;
      store.emit();
    }
    toast(e.message, 'error');
  });
  socket.on('server:notice', (n: { text: string }) => toast(n.text, 'info', 6000));
  socket.on('disconnect', () => toast('Lost signal. Reconnecting to the building...', 'error', 2500));
  socket.on('connect', () => {
    syncClock();
    if (store.lobby) socket?.emit('resume', { lobbyCode: store.lobby.code, lastAckTick: 0 });
  });
  socket.on('pong:clock', (p: { t0: number; t1: number }) => {
    const now = Date.now();
    rtt = now - p.t0;
    clockOffset = p.t1 - (p.t0 + rtt / 2);
  });
  setInterval(syncClock, 10_000);
  return socket;
}

function syncClock(): void {
  socket?.emit('ping:clock', { t0: Date.now() });
}

/** Server time estimate, for scheduling the night start and the phone call. */
export function serverNow(): number {
  return Date.now() + clockOffset;
}

export function latency(): number {
  return rtt;
}

export function resetSocket(): void {
  socket?.disconnect();
  socket = null;
}

export function emitAck<T>(ev: string, payload: unknown = {}): Promise<T> {
  return new Promise((resolve) => getSocket().emit(ev, payload, (r: T) => resolve(r)));
}
