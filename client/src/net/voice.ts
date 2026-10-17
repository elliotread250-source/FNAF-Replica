import { getSocket } from './socket';
import { store } from '../store';
import { audio } from '../audio/engine';
import { currentSession } from '../ui/screens/game';

// Push-to-talk walkie-talkie: WebRTC full mesh (max six links for four players), Socket.IO signalling.
interface Peer {
  pc: RTCPeerConnection;
  chain: { gain: GainNode; disconnect(): void } | null;
}

const peers = new Map<string, Peer>();
let local: MediaStream | null = null;
let transmitting = false;
let started = false;

function myId(): string | undefined {
  return store.me?.user.id;
}

async function getMic(): Promise<MediaStream | null> {
  if (local) return local;
  try {
    local = await navigator.mediaDevices.getUserMedia({ audio: store.settings.micDevice ? { deviceId: store.settings.micDevice } : true });
    for (const t of local.getAudioTracks()) t.enabled = false;
    for (const p of peers.values()) for (const t of local.getAudioTracks()) p.pc.addTrack(t, local);
    return local;
  } catch {
    return null;
  }
}

function peer(id: string, initiator: boolean): Peer {
  let p = peers.get(id);
  if (p) return p;
  const pc = new RTCPeerConnection({ iceServers: store.config.ice });
  p = { pc, chain: null };
  peers.set(id, p);
  if (local) for (const t of local.getAudioTracks()) pc.addTrack(t, local);
  pc.onicecandidate = (e) => e.candidate && getSocket().emit('voice:signal', { to: id, data: { ice: e.candidate.toJSON() } });
  pc.ontrack = (e) => {
    if (!audio.ctx) return;
    const stream = e.streams[0] ?? new MediaStream([e.track]);
    // Chrome needs the stream attached to a muted element before WebAudio gets samples.
    const el = new Audio();
    el.srcObject = stream;
    el.muted = true;
    void el.play().catch(() => {});
    p!.chain?.disconnect();
    p!.chain = audio.radioChain(stream, () => Boolean(currentSession()?.view?.po.on));
  };
  pc.onnegotiationneeded = async () => {
    if (!initiator) return;
    await pc.setLocalDescription(await pc.createOffer());
    getSocket().emit('voice:signal', { to: id, data: { sdp: pc.localDescription } });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
      p?.chain?.disconnect();
      peers.delete(id);
    }
  };
  return p;
}

async function onSignal(m: { from: string; data: { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit } }): Promise<void> {
  const me = myId();
  if (!me) return;
  const p = peer(m.from, me < m.from);
  try {
    if (m.data.sdp) {
      await p.pc.setRemoteDescription(m.data.sdp);
      if (m.data.sdp.type === 'offer') {
        await p.pc.setLocalDescription(await p.pc.createAnswer());
        getSocket().emit('voice:signal', { to: m.from, data: { sdp: p.pc.localDescription } });
      }
    } else if (m.data.ice) await p.pc.addIceCandidate(m.data.ice);
  } catch {
    /* voice is best-effort; text chat still works */
  }
}

/** Keep the mesh in step with the lobby's players. The lower id makes the offer. */
function syncPeers(): void {
  const me = myId();
  const l = store.lobby;
  if (!me || !l) {
    for (const [id, p] of peers) {
      p.chain?.disconnect();
      p.pc.close();
      peers.delete(id);
    }
    return;
  }
  const ids = new Set(l.players.filter((p) => !p.isBot && p.connected && p.userId !== me).map((p) => p.userId));
  for (const id of ids) if (!peers.has(id) && me < id) peer(id, true).pc.createDataChannel('k');
  for (const [id, p] of peers) {
    if (!ids.has(id)) {
      p.chain?.disconnect();
      p.pc.close();
      peers.delete(id);
    }
  }
  applyGhostRules();
}

/** Ghosts hear ghosts; the living hear the living, unless the lobby lets ghosts talk. */
function applyGhostRules(): void {
  const v = currentSession()?.view;
  const l = store.lobby;
  if (!v || !l) {
    for (const p of peers.values()) p.chain?.gain.gain.setValueAtTime(1, audio.ctx?.currentTime ?? 0);
    return;
  }
  const iAmDead = !v.me.alive && v.me.role === 'guard';
  for (const [id, p] of peers) {
    const st = v.stations.find((s) => s.pid === id);
    const theyDead = st ? !st.alive : false;
    const audible = l.options.ghostsTalk || iAmDead || !theyDead;
    p.chain?.gain.gain.setValueAtTime(audible ? 1 : 0, audio.ctx?.currentTime ?? 0);
  }
}

function setTransmit(on: boolean): void {
  if (transmitting === on) return;
  transmitting = on;
  if (on) audio.play('squelch');
  else audio.play('squelch', { rate: 0.8 });
  for (const t of local?.getAudioTracks() ?? []) t.enabled = on;
  getSocket().emit('voice:speaking', { on });
}

export function startVoice(): void {
  if (started) return;
  started = true;
  const s = getSocket();
  s.on('voice:signal', (m) => void onSignal(m));
  store.on(syncPeers);
  setInterval(applyGhostRules, 1000);
  window.addEventListener('keydown', async (e) => {
    if (e.repeat || !(store.settings.bindings.pushToTalk ?? ['KeyV']).includes(e.code)) return;
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (!store.lobby) return;
    if (await getMic()) setTransmit(true);
  });
  window.addEventListener('keyup', (e) => {
    if ((store.settings.bindings.pushToTalk ?? ['KeyV']).includes(e.code)) setTransmit(false);
  });
}
