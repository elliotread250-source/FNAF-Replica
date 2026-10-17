import * as THREE from 'three';
import { CLASSIC_MAP, COOP_MAP, CLIPPINGS, ROSTER_BY_ID, type Input, type MapDef, type PlayerView, type SimEvent, type StationId } from '@fnaf/shared';
import { getSocket, serverNow } from '../net/socket';
import { store } from '../store';
import { audio } from '../audio/engine';
import { getRenderer } from '../render/renderer';
import { buildOffice, type OfficeScene } from '../render/scenes/office';
import { buildRoom, stageCharacters, type CamRoom } from '../render/scenes/rooms';
import { Jumpscare } from '../render/scenes/jumpscare';
import { Hud } from './hud';
import { h, toast } from '../ui/dom';
import { setFrame } from '../app';
import { STATION_DOORS, type NightEnd, type NightStart } from './types';
import { CallPlayer } from './calls';
import { PuppeteerMap } from './puppeteer';
import { runDeathMinigame } from '../minigames';
import { newspaperTex } from '../render/textures';
import { api } from '../api';
import { TurntableView } from '../ui/turntableView';

const YAW_MAX = 0.96;
const CAM_FPS = 15;

type Overlay = { el: HTMLElement; until: number } | null;

export class GameSession {
  readonly map: MapDef;
  view: PlayerView | null = null;
  private seq = 0;
  private ack = 0;
  private pendDoor = new Map<string, { closed: boolean; seq: number }>();
  private pendLight = new Map<string, { on: boolean; seq: number }>();
  private pendTablet: { up: boolean; seq: number } | null = null;
  private pendCam: { node: string; seq: number } | null = null;
  private office: OfficeScene | null = null;
  private rooms = new Map<string, CamRoom>();
  private rt: THREE.WebGLRenderTarget;
  private lastCamRender = 0;
  private camStaticUntil = 0;
  private glitchUntil = 0;
  private jump = new Jumpscare();
  private jumpPhase: 'none' | 'scare' | 'static' | 'crash' | 'card' | 'minigame' = 'none';
  private jumpUntil = 0;
  private overlay: Overlay = null;
  private yaw = 0;
  private keysHeld = new Set<string>();
  private mouseX = 0.5;
  private panelOpen = false;
  private hud: Hud | null = null;
  private call: CallPlayer | null = null;
  private puppeteer: PuppeteerMap | null = null;
  private ended: NightEnd | null = null;
  private endShown = false;
  private poFace = 0;
  private poMusic: (() => void) | null = null;
  private hallu = { red: 0, wobble: 0, face: 0, fakeAnim: '' as string, fakeUntil: 0 };
  private itsMeUntil = 0;
  private handTimer = 0;
  private dead = false;
  private raycaster = new THREE.Raycaster();
  private speaking = new Set<string>();
  private hourFracStart = performance.now();
  private disposers: (() => void)[] = [];
  private stingCooldown = 0;
  private lastLightHum = false;
  private camClickTargets: THREE.Object3D[] = [];
  private onEnd: (e: NightEnd) => void;
  private ghostTick = 0;
  private shadowStare = 0;
  private tStart = performance.now();
  private seenChars = new Set<string>();
  private shadowBonnie = { on: false, since: 0 };
  private kitchenTune = false;

  constructor(
    readonly start: NightStart,
    onEnd: (e: NightEnd) => void,
  ) {
    this.onEnd = onEnd;
    this.map = start.map === 'classic' ? CLASSIC_MAP : COOP_MAP;
    const [w, hh] = getRenderer().cameraTargetSize;
    this.rt = new THREE.WebGLRenderTarget(w, hh, { colorSpace: THREE.SRGBColorSpace });
  }

  get station(): StationId | null {
    return this.start.you;
  }

  // ---------- lifecycle ----------

  mount(root: HTMLElement): void {
    const me = store.me?.user;
    const equip = me?.equipped ?? {};
    if (this.start.role === 'puppeteer') {
      this.puppeteer = new PuppeteerMap(root, this.map, (input) => this.send(input));
    } else if (this.station) {
      this.office = buildOffice({
        station: this.station,
        doors: STATION_DOORS[this.station],
        decor: equip.office ?? 'office_default',
        guardEquip: equip,
        shadowSize: getRenderer().shadowSize,
        leaderName: store.roster.slot('leader'),
      });
      // Pre-compile shaders for the office and a couple of rooms so the first jumpscare never stutters.
      try {
        getRenderer().gl.compile(this.office.scene, this.office.camera);
        getRenderer().gl.compile(this.jump.scene, this.jump.camera);
      } catch {
        /* best effort */
      }
    }
    this.hud = new Hud(root, this.start.map, this.station, this.start.night, this.start.hourSeconds, {
      onCamera: (n) => this.switchCam(n),
      onTabletBar: () => this.toggleTablet(),
      onPing: () => this.ping(),
      onCallout: (i) => getSocket().emit('callout', { id: i }),
      onChat: (t) => getSocket().emit('chat', { text: t }),
      onReboot: (sys) => this.send({ action: 'tool', tool: 'reboot', system: sys as 'cameras' }),
      onLure: (node) => this.send({ action: 'tool', tool: 'lure', node }),
      onBoost: (st) => this.send({ action: 'tool', tool: 'boost', station: st }),
      onWind: (on) => this.send({ action: 'tool', tool: 'wind', on }),
      onMute: () => this.send({ action: 'vote_mute' }),
      onPanelClose: () => this.setPanel(false),
    });
    this.call = this.start.call && this.start.role !== 'puppeteer' ? new CallPlayer(this.start.call, this.hud, this.start.startsAt + (this.start.tick ? 0 : 1000)) : null;
    if (this.start.tick > 40) this.call?.skip();
    this.intro(root);
    this.bindInput();
    const sock = getSocket();
    const onSnap = (s: { tick: number; ack: number; v?: PlayerView; t: number; drain: number; ev: SimEvent[] }) => this.onSnap(s);
    const onChat = (c: { from: string; text: string; ghost?: boolean }) => {
      this.hud?.chat(c.from, c.text, c.ghost);
      audio.play('squelch');
    };
    const onCallout = (c: { from: string; text: string; ghost?: boolean }) => {
      this.hud?.chat(c.from, `📻 ${store.roster.fill(c.text)}`, c.ghost);
      audio.play('blip');
    };
    const onSpeak = (s: { from: string; on: boolean }) => (s.on ? this.speaking.add(s.from) : this.speaking.delete(s.from));
    sock.on('snap', onSnap);
    sock.on('chat', onChat);
    sock.on('callout', onCallout);
    sock.on('voice:speaking', onSpeak);
    this.disposers.push(() => {
      sock.off('snap', onSnap);
      sock.off('chat', onChat);
      sock.off('callout', onCallout);
      sock.off('voice:speaking', onSpeak);
    });
    if (audio.ready) {
      audio.stopAll();
      if (this.office) audio.startLoop('fan', 'fan');
      audio.startLoop('drone', 'drone');
    }
    setFrame((dt, t) => this.frame(dt, t));
  }

  private intro(root: HTMLElement): void {
    const st = this.station ? (this.map.stations.find((s) => s.id === this.station)?.name ?? (this.station === 'solo' ? 'Solo Station' : this.station)) : 'Puppeteer';
    const el = h('div', { class: 'overlay-full intro' }, h('div', null, '12:00 AM'), h('div', { style: 'font-size:36px' }, this.start.night === 7 ? 'Custom Night' : `Night ${this.start.night}`), h('div', { style: 'font-size:24px;color:#8a867a' }, st));
    root.appendChild(el);
    const wait = Math.max(500, this.start.startsAt - serverNow());
    setTimeout(() => {
      el.style.transition = 'opacity 0.6s';
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 700);
    }, Math.min(3000, wait));
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.hud?.dispose();
    this.call?.stop();
    this.poMusic?.();
    this.puppeteer?.dispose();
    this.office?.dispose();
    this.rt.dispose();
    audio.stopAll();
    setFrame(null);
  }

  // ---------- network ----------

  private send(input: Input): number {
    const seq = ++this.seq;
    getSocket().emit('input', { seq, input });
    return seq;
  }

  private onSnap(s: { tick: number; ack: number; v?: PlayerView; t: number; drain: number; ev: SimEvent[] }): void {
    if (s.v) this.view = s.v;
    else if (this.view) {
      this.view.t = s.t;
      this.view.drain = s.drain;
    }
    this.ack = Math.max(this.ack, s.ack);
    for (const [k, p] of this.pendDoor) if (p.seq <= this.ack) this.pendDoor.delete(k);
    for (const [k, p] of this.pendLight) if (p.seq <= this.ack) this.pendLight.delete(k);
    if (this.pendTablet && this.pendTablet.seq <= this.ack) this.pendTablet = null;
    if (this.pendCam && this.pendCam.seq <= this.ack) this.pendCam = null;
    for (const e of s.ev) this.onEvent(e);
    if (this.view && this.view.me.alive === false && !this.dead && this.view.me.role === 'guard') this.dead = true;
  }

  // ---------- derived state ----------

  private tabletUp(): boolean {
    if (!this.view) return false;
    if (!this.view.me.alive && this.view.me.role === 'guard') return true;
    return this.pendTablet?.up ?? this.view.me.tablet;
  }

  private cam(): string {
    return this.pendCam?.node ?? this.view?.me.cam ?? this.map.stageNode;
  }

  private doorState(id: string): { c: boolean; l: boolean } {
    const d = this.view?.doors[id];
    return { c: this.pendDoor.get(id)?.closed ?? d?.c ?? false, l: this.pendLight.get(id)?.on ?? d?.l ?? false };
  }

  private myDoors(): { id: string; side: 'left' | 'right'; kind: 'door' | 'vent' }[] {
    return this.station ? STATION_DOORS[this.station] : [];
  }

  private alive(): boolean {
    return Boolean(this.view?.me.alive) && !this.dead;
  }

  // ---------- actions ----------

  toggleTablet(): void {
    if (!this.view || !this.alive() || this.view.me.mask || this.view.po.on || this.view.me.blocked > 0) return;
    const up = !this.tabletUp();
    if (up) for (const d of this.myDoors()) if (this.doorState(d.id).l) this.setLight(d.id, false);
    this.pendTablet = { up, seq: this.send({ action: 'tablet', up }) };
    audio.play('whoosh', { gain: 0.6 });
    if (up) this.camStaticUntil = performance.now() + 150;
    this.setPanel(false);
  }

  private switchCam(node: string): void {
    if (!this.tabletUp() || node === this.cam()) return;
    this.pendCam = { node, seq: this.send({ action: 'camera', node }) };
    this.camStaticUntil = performance.now() + 120;
    audio.play('cam', { gain: 0.6 });
    if (this.station === 'control') this.hud?.lureButton(node, this.view?.me.lureCd ?? 0);
  }

  private ping(): void {
    if (!this.tabletUp()) return;
    this.send({ action: 'ping', node: this.cam() });
  }

  private toggleDoor(id: string): void {
    if (!this.view || !this.alive()) return;
    const d = this.view.doors[id];
    if (!d) return;
    if (this.tabletUp() || this.view.me.mask) return;
    this.reach(id);
    if (d.j || d.b || this.view.po.on) {
      audio.play('error', { pan: this.sideOf(id) === 'left' ? -0.7 : 0.7 });
      return;
    }
    const closed = !this.doorState(id).c;
    this.pendDoor.set(id, { closed, seq: this.send({ action: 'door', door: id, closed }) });
    audio.play(closed ? 'door_slam' : 'door_open', { pan: this.sideOf(id) === 'left' ? -0.8 : 0.8 });
    if (closed) this.office?.swing();
  }

  private setLight(id: string, on: boolean): void {
    if (!this.view || !this.alive()) return;
    if (on && (this.tabletUp() || this.view.me.mask)) return;
    const d = this.view.doors[id];
    if (!d) return;
    if (on) this.reach(id);
    if (on && (d.b || d.ld || this.view.po.on || this.view.me.lightsOut > 0)) {
      audio.play('error', { pan: this.sideOf(id) === 'left' ? -0.7 : 0.7 });
      return;
    }
    if (this.doorState(id).l === on) return;
    this.pendLight.set(id, { on, seq: this.send({ action: 'light', door: id, on }) });
    audio.play('click', { gain: 0.5 });
  }

  private reach(id: string): void {
    if (!this.office) return;
    const side = this.sideOf(id);
    const arm = this.office.hands.getObjectByName(side === 'left' ? 'handL' : 'handR');
    if (arm) {
      arm.visible = true;
      this.handTimer = 0.15;
    }
  }

  private sideOf(id: string): 'left' | 'right' {
    return this.myDoors().find((d) => d.id === id)?.side ?? 'left';
  }

  private setPanel(open: boolean): void {
    this.panelOpen = open && this.station === 'control';
    this.send({ action: 'tool', tool: 'panel', on: this.panelOpen });
  }

  // ---------- input ----------

  private bindInput(): void {
    const b = () => store.settings.bindings;
    const is = (action: string, code: string) => (b()[action] ?? []).includes(code);
    const canvas = getRenderer().canvas;
    const onKey = (e: KeyboardEvent) => {
      if (this.hud?.chatOpen) return;
      if (e.repeat) return;
      const c = e.code;
      if (c === 'F9' && ['localhost', '127.0.0.1'].includes(location.hostname)) {
        e.preventDefault();
        return this.toggleDebug();
      }
      if (is('pause', c)) return this.pause();
      if (this.puppeteer) return;
      if (is('chat', c)) {
        e.preventDefault();
        this.hud?.openChat();
        return;
      }
      if (is('callouts', c)) return this.hud?.toggleCallouts();
      this.keysHeld.add(c);
      const tablet = this.tabletUp();
      if (tablet && /^Digit\d$/.test(c)) {
        const idx = (Number(c.slice(5)) + 9) % 10;
        const cams = Object.values(this.map.nodes).filter((n) => n.cam);
        if (cams[idx]) this.switchCam(cams[idx].id);
        return;
      }
      if (is('tablet', c)) {
        e.preventDefault();
        return this.toggleTablet();
      }
      if (tablet && is('ping', c)) return this.ping();
      if (is('panel', c)) {
        e.preventDefault();
        return this.setPanel(!this.panelOpen);
      }
      const doors = this.myDoors();
      const left = doors.find((d) => d.side === 'left');
      const right = doors.find((d) => d.side === 'right');
      if (is('doorLeft', c) && left) return this.toggleDoor(left.id);
      if (is('doorRight', c) && right) return this.toggleDoor(right.id);
      if (is('lightLeft', c) && left) return this.setLight(left.id, store.settings.toggleLights ? !this.doorState(left.id).l : true);
      if (is('lightRight', c) && right) return this.setLight(right.id, store.settings.toggleLights ? !this.doorState(right.id).l : true);
      if (is('tool', c)) {
        if (this.station === 'west' || this.station === 'solo') this.send({ action: 'tool', tool: 'flashlight', on: true });
        else if (this.station === 'east') this.send({ action: 'tool', tool: 'mic', on: !this.view?.me.mic });
        return;
      }
      if (is('mask', c)) {
        if (this.station === 'south') {
          const on = !this.view?.me.mask;
          this.send({ action: 'tool', tool: 'mask', on });
          audio.play('whoosh', { gain: 0.4, rate: 0.7 });
        } else if (this.station === 'solo') this.send({ action: 'tool', tool: 'mic', on: !this.view?.me.mic });
        return;
      }
      if (is('wind', c)) return void this.send({ action: 'tool', tool: 'wind', on: true });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const c = e.code;
      this.keysHeld.delete(c);
      if (this.puppeteer || this.hud?.chatOpen) return;
      const doors = this.myDoors();
      const left = doors.find((d) => d.side === 'left');
      const right = doors.find((d) => d.side === 'right');
      if (!store.settings.toggleLights) {
        if (is('lightLeft', c) && left) this.setLight(left.id, false);
        if (is('lightRight', c) && right) this.setLight(right.id, false);
      }
      if (is('tool', c) && (this.station === 'west' || this.station === 'solo')) this.send({ action: 'tool', tool: 'flashlight', on: false });
      if (is('wind', c)) this.send({ action: 'tool', tool: 'wind', on: false });
    };
    const onMove = (e: MouseEvent) => {
      this.mouseX = e.clientX / window.innerWidth;
      if (store.settings.directMouse && this.office && !this.tabletUp()) this.yaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, (0.5 - this.mouseX) * 2 * YAW_MAX));
    };
    let heldLight: string | null = null;
    const pick = (e: MouseEvent): THREE.Object3D | null => {
      const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      if (this.tabletUp()) {
        const room = this.rooms.get(this.cam());
        if (!room) return null;
        this.raycaster.setFromCamera(ndc, room.camera);
        return this.raycaster.intersectObjects(this.camClickTargets, true)[0]?.object ?? null;
      }
      if (!this.office) return null;
      this.raycaster.setFromCamera(ndc, this.office.camera);
      return this.raycaster.intersectObjects(this.office.clickables(), false)[0]?.object ?? null;
    };
    const onDown = (e: MouseEvent) => {
      if (this.puppeteer) return;
      if (e.button === 2) {
        e.preventDefault();
        return this.toggleTablet();
      }
      const o = pick(e);
      if (!o) return;
      const name = o.name;
      if (name.startsWith('door:')) this.toggleDoor(name.slice(5));
      else if (name.startsWith('light:')) {
        const id = name.slice(6);
        if (store.settings.toggleLights) this.setLight(id, !this.doorState(id).l);
        else {
          heldLight = id;
          this.setLight(id, true);
        }
      } else if (name === 'nose') {
        this.send({ action: 'nose' });
        audio.play('honk');
        api.honk().then((r) => r.achievements.forEach((a) => toast(`Achievement: ${a}`, 'ach')), () => {});
      } else if (name === 'phone') this.call?.phoneClick(this.start.night);
      else if (name === 'locker') this.send({ action: 'locker_click' });
      else if (name.startsWith('clip:')) this.zoomClip(Number(name.slice(5)));
    };
    const onUp = () => {
      if (heldLight) this.setLight(heldLight, false);
      heldLight = null;
    };
    const onCtx = (e: Event) => e.preventDefault();
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMove);
    canvas.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    canvas.addEventListener('contextmenu', onCtx);
    const onBlur = () => {
      for (const d of this.myDoors()) if (this.doorState(d.id).l && !store.settings.toggleLights) this.setLight(d.id, false);
      this.keysHeld.clear();
    };
    window.addEventListener('blur', onBlur);
    this.disposers.push(() => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      canvas.removeEventListener('contextmenu', onCtx);
      window.removeEventListener('blur', onBlur);
    });
  }

  private pause(): void {
    // Multiplayer never pauses: Esc opens settings and Leave.
    if (document.querySelector('.pause')) {
      document.querySelector('.pause')?.remove();
      return;
    }
    void import('../ui/screens/settings').then(({ settingsPanel }) => {
      const el = h('div', { class: 'overlay-full pause' });
      const close = () => el.remove();
      el.appendChild(settingsPanel(close, 'audio'));
      el.appendChild(
        h('button', {
          class: 'btn',
          style: 'margin-top:10px',
          onclick: () => {
            close();
            getSocket().emit('lobby:leave', {});
            store.lobby = null;
            this.dispose();
            void import('../app').then(({ go }) => go('title'));
          },
        }, 'Leave shift'),
      );
      document.body.appendChild(el);
    });
  }

  private zoomClip(id: number): void {
    const c = CLIPPINGS.find((x) => x.id === id);
    if (!c) return;
    const t = newspaperTex(store.roster.fill(c.headline), [store.roster.fill(c.body[0]), store.roster.fill(c.body[1])], c.id);
    const canvas = t.image as HTMLCanvasElement;
    const copy = document.createElement('canvas');
    copy.width = canvas.width;
    copy.height = canvas.height;
    copy.getContext('2d')?.drawImage(canvas, 0, 0);
    const el = h('div', { class: 'zoom-news', onclick: () => el.remove() }, copy);
    document.body.appendChild(el);
    api.archive('newspaper', String(id)).then((r) => r.achievements.forEach((a) => toast(`Achievement: ${a}`, 'ach')), () => {});
  }

  // ---------- events ----------

  private sidePan(node: string): number {
    const st = this.map.stations.find((s) => s.id === this.station) ?? { x: 50 };
    const n = this.map.nodes[node];
    if (!n) return 0;
    return Math.max(-1, Math.min(1, (n.x - st.x) / 30));
  }

  private onEvent(e: SimEvent): void {
    const v = this.view;
    const tabletCam = this.tabletUp() ? this.cam() : null;
    switch (e.type) {
      case 'call_start':
        this.call?.begin();
        this.hud?.setCallMuteVisible(true);
        break;
      case 'mute_vote':
        this.hud?.setCallMuteVisible(true, Number(e.votes), Number(e.needed));
        break;
      case 'call_muted':
        this.call?.stop();
        this.hud?.setCallMuteVisible(false);
        break;
      case 'hour':
        this.hourFracStart = performance.now();
        audio.loopGain('drone', 0.3 + Number(e.hour) * 0.05, 2);
        break;
      case 'door':
        if (e.station !== this.station) break;
        break;
      case 'error_buzz':
        audio.play('error', { pan: this.sideOf(String(e.door)) === 'left' ? -0.7 : 0.7 });
        break;
      case 'reject':
        if (e.seq) {
          for (const [k, p] of this.pendDoor) if (p.seq === e.seq) this.pendDoor.delete(k);
          for (const [k, p] of this.pendLight) if (p.seq === e.seq) this.pendLight.delete(k);
          if (this.pendTablet?.seq === e.seq) this.pendTablet = null;
          if (this.pendCam?.seq === e.seq) this.pendCam = null;
        }
        break;
      case 'sting':
        if (performance.now() > this.stingCooldown) {
          audio.play('sting', { pan: this.sideOf(String(e.door)) === 'left' ? -0.6 : 0.6 });
          this.stingCooldown = performance.now() + 800;
        }
        break;
      case 'step': {
        const pan = this.sidePan(String(e.node));
        const near = Number(e.near ?? 2);
        const variant = e.anim === 'freddy' ? 'step_heavy' : e.anim === 'chica' ? 'step_clunky' : e.anim === 'foxy' ? 'step_light' : 'step_heavy';
        audio.play(variant, { pan, distance: e.clear ? 0.2 : near, gain: e.clear ? 1.2 : 0.7 });
        this.hud?.cue('footsteps', pan < -0.2 ? 'left' : pan > 0.2 ? 'right' : 'center');
        break;
      }
      case 'laugh': {
        const mic = v?.me.mic;
        audio.play('laugh', { pan: mic ? this.sidePan(String(e.node)) : 0, distance: mic ? 0.3 : 2.5, gain: mic ? 1 : 0.5, reverb: true });
        this.hud?.cue(`${store.roster.name('freddy')} laughs`, 'center');
        break;
      }
      case 'kitchen': {
        const close = tabletCam === 'kitchen' || v?.me.mic;
        const near = this.station === 'east' || this.station === 'solo' || this.station === 'office';
        audio.play('kitchen', { gain: close ? (e.loud ? 1 : 0.8) : near ? 0.25 : 0.1, distance: close ? 0 : 2, rate: e.anim === 'freddy' ? 0.7 : 1 });
        if (close || near) this.hud?.cue('kitchen noises', 'right');
        break;
      }
      case 'at_door':
        if (e.anim === 'chica' || e.anim === 'toy_freddy') audio.play('breathing', { pan: this.sideOf(String(e.door)) === 'left' ? -0.8 : 0.8, gain: 0.5 });
        else audio.play('step_heavy', { pan: this.sideOf(String(e.door)) === 'left' ? -0.8 : 0.8, gain: 0.8 });
        this.hud?.cue('something at the door', this.sideOf(String(e.door)));
        break;
      case 'vent_enter':
        if (this.station === 'control') audio.play('step_clunky', { pan: 0.8, distance: 1.5, rate: 1.4 });
        break;
      case 'retreat':
        break;
      case 'groan':
        audio.play('groan', { gain: 0.35 });
        audio.startLoop('breath_in', 'breath_loop');
        break;
      case 'in_office':
        audio.startLoop('breath_in', 'breath_loop');
        break;
      case 'knock': {
        const mine = this.myDoors().some((d) => d.id === e.door);
        audio.play('knock', { pan: mine ? -0.8 : 0, distance: mine ? 0 : 3, gain: mine ? 1.2 : 0.4 });
        if (mine) {
          this.office?.swing();
          this.office?.sparks.burst(new THREE.Vector3(-2.95, 1.2, -0.9), 12);
          this.hud?.cue('BANG BANG BANG', 'left');
        }
        break;
      }
      case 'foxy_run':
        audio.play('foxy_run', { pan: -0.9, gain: 1 });
        this.hud?.cue('running!', 'left');
        break;
      case 'foxy_hum':
        if (tabletCam === this.map.coveNode) audio.melody('foxy', { bpm: 130, gain: 0.08, voice: 'hum' });
        break;
      case 'foxy_bounce':
        toast(`${store.roster.name('foxy')} stumbled back to the cove.`);
        break;
      case 'cam_glitch':
        this.glitchUntil = performance.now() + 600;
        audio.play('static', { gain: 0.5 });
        break;
      case 'jumpscare':
        this.startJumpscare(String(e.by), String(e.kind));
        break;
      case 'death':
        if (e.player !== store.me?.user.id) {
          audio.play('squelch');
          toast(`${e.name || e.station} went quiet.`, 'error');
        }
        break;
      case 'power_out':
        audio.fanDown();
        audio.stopLoop('light_hum');
        if (this.office) {
          this.office.fan.userData.speed = 0;
          for (const d of this.office.doors) d.target = 0;
        }
        break;
      case 'po_song':
        this.poFace = 1;
        this.poMusic = audio.melody('toreador', { bpm: 150, gain: 0.3, wobble: 0.8, pan: -0.6 });
        break;
      case 'po_song_far':
        if (e.station !== this.station) this.poMusic ??= audio.melody('toreador', { bpm: 150, gain: 0.04, wobble: 0.8 });
        break;
      case 'po_dark':
        this.poFace = 2;
        this.poMusic?.();
        this.poMusic = null;
        break;
      case 'puppet_out':
        audio.melody('weasel', { bpm: 220, gain: 0.25, wobble: 1.2 });
        this.hud?.flashAlert(`${store.roster.name('puppet').toUpperCase()} IS OUT`, 5000);
        break;
      case 'puppet_back':
        toast(`The music plays. ${store.roster.name('puppet')} goes back to sleep.`);
        break;
      case 'system_fail':
        audio.play('error', { gain: 0.4 });
        if (this.station === 'control') this.hud?.flashAlert(`SYSTEM FAILURE: ${String(e.system).toUpperCase()}`);
        this.office?.sparks.burst(new THREE.Vector3(-2.6, 1.5, -2), 18);
        break;
      case 'reboot_done':
        audio.play('blip');
        break;
      case 'hallucination':
        this.hallucinate(String(e.kind), Number(e.seed));
        break;
      case 'its_me':
        this.itsMeUntil = performance.now() + 100;
        break;
      case 'golden_in_office':
        audio.play('garble', { gain: 0.25, rate: 0.6 });
        break;
      case 'ping':
        this.hud?.ping(String(e.name || e.station), String(e.node), Boolean(e.ghost), e.from === store.me?.user.id);
        if (e.from !== store.me?.user.id) audio.play('blip', { gain: 0.5 });
        break;
      case 'lure':
        audio.play('giggle', { gain: 0.3, distance: 2 });
        break;
      case 'boost':
        if (e.station === this.station) toast('Power routing boost: your drain is halved for 20 s.');
        break;
      case 'fooled':
        audio.loopGain('breath_in', 1);
        break;
      case 'fooled_leave':
        audio.stopLoop('breath_in');
        break;
      case 'tablet_forced':
        audio.play('whoosh', { rate: 0.6 });
        break;
      case 'six_am':
      case 'game_over':
        break;
      case 'mangle_static':
        audio.startLoop('mangle', 'radio_static');
        audio.loopGain('mangle', Number(e.level) * 0.4);
        break;
      case 'mangle_peak':
        audio.loopGain('mangle', 0.8);
        this.hud?.cue('STATIC PEAK', 'center');
        break;
      case 'mangle_gone':
        audio.stopLoop('mangle');
        break;
      case 'bb_giggle':
        audio.play('giggle', { gain: 0.6, pan: 0.5 });
        this.hud?.cue('giggling', 'center');
        break;
      case 'bb_steal':
        toast('Your lights are gone.', 'error');
        break;
      case 'shadow_stare':
        toast('The cameras went dark.', 'error');
        break;
      case 'nightmare_breath':
        audio.play('breathing', { gain: 0.9, pan: this.sideOf(String(e.door)) === 'left' ? -0.8 : 0.8, rate: 0.8 });
        this.hud?.cue('breathing behind the door', this.sideOf(String(e.door)));
        break;
      case 'phantom_jumpscare':
        this.hallu.face = 1;
        audio.play('scream_generic', { gain: 0.5, rate: 0.7 });
        break;
      case 'door_forced':
        audio.play('door_open', { rate: 0.6, gain: 1.2 });
        break;
      case 'radio':
        this.hud?.chat('RADIO', String(e.text), true);
        break;
      case 'honk':
        break;
      case 'secret_found':
        this.secretStill();
        break;
      case 'lights_out':
        if (e.station === this.station) toast('Your lights died.', 'error');
        break;
      case 'static_attack':
        this.camStaticUntil = performance.now() + 5000;
        break;
      case 'bonnie_blind':
        toast(`${store.roster.name('bonnie')} flinched in the beam.`);
        break;
      case 'toy_in':
        audio.play('giggle', { gain: 0.5, rate: 0.8 });
        break;
      case 'flicker':
        if (this.office && !store.settings.photosensitive) {
          const f = this.office.flickers[0];
          f.light.intensity = 0;
        }
        break;
      default:
        break;
    }
  }

  private hallucinate(kind: string, seed: number): void {
    const ps = store.settings.photosensitive;
    if (kind === 'face' || kind === 'phantom') this.hallu.face = ps ? 0 : 1;
    if (kind === 'red') {
      this.hallu.red = 0.8;
      audio.play('heartbeat', { gain: 0.6 });
    }
    if (kind === 'wobble') this.hallu.wobble = ps ? 0.2 : 1;
    if (kind === 'its_me') this.itsMeUntil = performance.now() + (ps ? 600 : 200);
    if (kind === 'fake_cam') {
      const ids = ['freddy', 'bonnie', 'chica', 'golden'];
      this.hallu.fakeAnim = ids[seed % ids.length];
      this.hallu.fakeUntil = performance.now() + 2500;
    }
  }

  private secretStill(): void {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 480;
    const x = c.getContext('2d') as CanvasRenderingContext2D;
    x.fillStyle = '#1a1410';
    x.fillRect(0, 0, 640, 480);
    const cols = ['#c41e1e', '#2a5bd8', '#e8c22c', '#3ab05a', '#7a3ac4'];
    for (let i = 0; i < 5; i++) {
      x.strokeStyle = '#888';
      x.beginPath();
      x.moveTo(90 + i * 110, 40);
      x.lineTo(90 + i * 110, 90);
      x.stroke();
      x.fillStyle = cols[i];
      x.beginPath();
      x.moveTo(60 + i * 110, 160);
      x.lineTo(90 + i * 110, 90);
      x.lineTo(120 + i * 110, 160);
      x.fill();
    }
    x.fillStyle = '#f2ecdc';
    x.fillRect(180, 220, 280, 180);
    for (let i = 0; i < 5; i++) {
      x.strokeStyle = cols[i];
      x.lineWidth = 3;
      x.beginPath();
      x.arc(220 + i * 50, 290, 12, 0, Math.PI * 2);
      x.moveTo(220 + i * 50, 302);
      x.lineTo(220 + i * 50, 350);
      x.stroke();
    }
    x.fillStyle = '#c41e1e';
    x.font = 'bold 52px "Courier Prime", monospace';
    x.fillText('FOUND', 250, 460);
    const el = h('div', { class: 'zoom-news', onclick: () => el.remove() }, c);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 5000);
  }

  // ---------- death and the end ----------

  private startJumpscare(by: string, kind: string): void {
    this.jump.start(by, kind);
    this.jumpPhase = 'scare';
    audio.stopLoop('breath_in');
    audio.play(`scream_${['bonnie', 'chica', 'freddy', 'foxy', 'golden', 'puppet', 'powerout'].includes(kind) ? kind : 'generic'}`, { bus: 'jumpscare' });
    this.poMusic?.();
    this.poMusic = null;
    this.dead = true;
  }

  private afterScare(by: string): void {
    const root = document.getElementById('ui') as HTMLElement;
    if (by === 'golden') {
      // A fake crash, then the truth.
      this.jumpPhase = 'crash';
      const el = h('div', { class: 'overlay-full crash' }, h('div', null, 'A problem has occurred and FNAF Replica has been shut down to prevent damage.'), h('div', { style: 'margin-top:20px' }, 'IT_S_ME_EXCEPTION'), h('div', null, '*** STOP: 0x00001987'));
      root.appendChild(el);
      setTimeout(() => {
        el.remove();
        this.deathCard(by);
      }, 2000);
      return;
    }
    if (Math.random() < 0.15) {
      this.jumpPhase = 'minigame';
      runDeathMinigame(root, () => this.deathCard(by));
      return;
    }
    this.deathCard(by);
  }

  private deathCard(by: string): void {
    this.jumpPhase = 'card';
    const root = document.getElementById('ui') as HTMLElement;
    const name = store.me?.user.displayName ?? 'Guard';
    const hour = this.view?.h ?? 0;
    const text = store.settings.hideGore
      ? 'You were caught.'
      : `${name} was found stuffed in a ${store.roster.slot('leader')} suit. Time of death: ${hour === 0 ? 12 : hour} AM. Cause: ${store.roster.name(by)}.`;
    let tv: TurntableView | null = null;
    if (!store.settings.hideGore) {
      tv = new TurntableView(220, 260);
      tv.tt.showGuard(store.me?.user.equipped ?? {});
      tv.tt.pivot.rotation.x = 0.25;
    }
    const el = h('div', { class: 'overlay-full gameover' }, h('div', { class: 'big' }, 'GAME OVER'), tv?.canvas, h('p', { style: 'max-width:640px;font-size:20px' }, text), h('p', { class: 'dim' }, `${store.roster.name(by)} got you at ${hour === 0 ? 12 : hour} AM`));
    root.appendChild(el);
    audio.startLoop('deadstatic', 'static');
    setTimeout(() => {
      el.remove();
      tv?.dispose();
      audio.stopLoop('deadstatic');
      this.jumpPhase = 'none';
      if (this.ended) this.showEnd();
      else toast('You are a Ghost now. Cameras are free. Ping to help.', 'info', 5000);
    }, 3000);
  }

  onNightEnd(e: NightEnd): void {
    this.ended = e;
    if (this.jumpPhase === 'none') this.showEnd();
  }

  private showEnd(): void {
    if (this.endShown || !this.ended) return;
    this.endShown = true;
    const e = this.ended;
    const root = document.getElementById('ui') as HTMLElement;
    this.call?.stop();
    audio.stopAll();
    setFrame(null);
    if (e.result === 'win') {
      const alive = e.team.filter((t) => t.role === 'guard' && t.survived).length;
      const total = e.team.filter((t) => t.role === 'guard').length;
      const el = h('div', { class: 'overlay-full sixam' }, h('div', { class: 'big' }, '6 AM'), h('div', { style: 'font-size:30px' }, e.mode === 'showtime' && this.start.role === 'puppeteer' ? 'The guards made it. Better luck next show.' : `Shift complete. ${alive} of ${total} guards clocked out.`));
      root.appendChild(el);
      audio.play('chime6', { gain: 0.8 });
      setTimeout(() => audio.play('cheer', { gain: 0.9 }), 6200);
      setTimeout(() => this.onEnd(e), 8000);
    } else {
      const el = h('div', { class: 'overlay-full gameover' }, h('div', { class: 'big' }, e.mode === 'showtime' && this.start.role === 'puppeteer' ? 'SHOWTIME!' : 'GAME OVER'), h('div', { class: 'dim', style: 'font-size:20px' }, e.mode === 'showtime' && this.start.role === 'puppeteer' ? 'Every guard is gone.' : 'Nobody clocked out.'));
      root.appendChild(el);
      audio.play('static', { gain: 0.6 });
      setTimeout(() => this.onEnd(e), 4000);
    }
  }

  // ---------- rendering ----------

  private room(node: string): CamRoom {
    let r = this.rooms.get(node);
    if (!r) {
      r = buildRoom(this.map.nodes[node], this.view?.clips ?? {}, false);
      this.rooms.set(node, r);
      try {
        getRenderer().gl.compile(r.scene, r.camera);
      } catch {
        /* best effort */
      }
    }
    return r;
  }

  private frame(dt: number, t: number): void {
    const R = getRenderer();
    const v = this.view;
    // Jumpscare takes over the screen.
    if (this.jumpPhase === 'scare') {
      const r = this.jump.update(dt);
      this.jump.camera.aspect = window.innerWidth / window.innerHeight;
      this.jump.camera.updateProjectionMatrix();
      R.post.uniforms.flash.value = r.flash;
      R.post.uniforms.aberration.value = r.aberration;
      R.post.uniforms.redTint.value = 0.15;
      R.post.uniforms.darkness.value = 0;
      R.post.uniforms.wobble.value = 0;
      R.render(this.jump.scene, this.jump.camera);
      if (r.done) {
        this.jumpPhase = 'static';
        this.jumpUntil = performance.now() + 500;
      }
      return;
    }
    if (this.jumpPhase === 'static') {
      R.renderCrt(this.rt.texture, { staticAmt: 1, tint: new THREE.Vector3(1, 1, 1), mono: 0, glitch: 0 });
      if (performance.now() > this.jumpUntil) {
        this.jumpPhase = 'card';
        this.afterScare(this.jump.kind === 'powerout' ? 'freddy' : String(this.lastKiller()));
      }
      return;
    }
    if (this.jumpPhase === 'card' || this.jumpPhase === 'crash' || this.jumpPhase === 'minigame') return;
    if (!v) {
      R.post.uniforms.darkness.value = 1;
      return;
    }
    // Decay hallucinations.
    this.hallu.red = Math.max(0, this.hallu.red - dt * 0.5);
    this.hallu.wobble = Math.max(0, this.hallu.wobble - dt * 0.4);
    this.hallu.face = Math.max(0, this.hallu.face - dt * 5);

    const hourFrac = Math.min(1, (performance.now() - this.hourFracStart) / 1000 / this.start.hourSeconds);
    const doorStates: Record<string, { c: boolean; l: boolean }> = {};
    for (const d of this.myDoors()) doorStates[d.id] = this.doorState(d.id);
    const tablet = this.tabletUp();
    this.hud?.update(v, { tablet, cam: this.cam(), panelOpen: this.panelOpen, speaking: this.speaking, playersOnline: new Set(), hourFrac, doors: doorStates });
    if (this.call) this.call.tick();

    this.debugMap?.update(v);
    if (this.puppeteer) {
      this.puppeteer.update(v);
      R.post.uniforms.darkness.value = 1;
      return;
    }

    if (tablet) {
      this.renderCamera(t);
    } else if (this.office) {
      this.renderOffice(dt, t, doorStates);
    }
    if (this.itsMeUntil > performance.now()) this.flashText("IT'S ME");
    else this.flashText('');
  }

  private lastNodeRolled = '';
  private debugMap: PuppeteerMap | null = null;

  /** Development only: the node graph with every animatronic this client can see (ghosts see all). */
  private toggleDebug(): void {
    if (this.debugMap) {
      this.debugMap.dispose();
      this.debugMap = null;
      return;
    }
    this.debugMap = new PuppeteerMap(document.getElementById('ui') as HTMLElement, this.map, () => {});
  }

  private markSeen(id: string): void {
    if (this.seenChars.has(id) || !store.me) return;
    this.seenChars.add(id);
    if (store.me.archive.some((a) => a.kind === 'character' && a.id === id)) return;
    api.archive('character', id).then((r) => r.achievements.forEach((a) => toast(`Achievement: ${a}`, 'ach')), () => {});
  }

  private glitchDimension(): void {
    this.shadowBonnie.on = false;
    this.markSeen('shadow_bonnie');
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 180;
    canvas.style.cssText = 'width:100vw;height:100vh;image-rendering:pixelated';
    const el = h('div', { class: 'overlay-full', style: 'background:#000;z-index:60' }, canvas);
    document.body.appendChild(el);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const end = performance.now() + 5000;
    audio.play('garble', { gain: 0.5, rate: 0.7 });
    const draw = () => {
      if (performance.now() > end) {
        el.remove();
        return;
      }
      // Distorted rooms: smeared checkerboards and stretched doorways.
      for (let y = 0; y < 180; y += 4) {
        const off = Math.sin(y * 0.1 + performance.now() * 0.004) * 30;
        for (let x = 0; x < 320; x += 16) {
          ctx.fillStyle = ((x + y + Math.floor(off)) / 16) % 2 < 1 ? (store.settings.photosensitive ? '#222' : '#4a1a6a') : '#000';
          ctx.fillRect(x + off, y, 16, 4);
        }
      }
      requestAnimationFrame(draw);
    };
    draw();
  }

  private lastKiller(): string {
    const st = this.view?.stations.find((s) => s.id === this.station);
    return st?.killedBy ?? 'freddy';
  }

  private textEl: HTMLElement | null = null;
  private flashText(text: string): void {
    if (!this.textEl) {
      this.textEl = h('div', { style: 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-family:VT323;font-size:120px;color:#fff;pointer-events:none;z-index:30' });
      document.body.appendChild(this.textEl);
      this.disposers.push(() => this.textEl?.remove());
    }
    this.textEl.textContent = text;
  }

  private renderOffice(dt: number, t: number, doors: Record<string, { c: boolean; l: boolean }>): void {
    const R = getRenderer();
    const o = this.office as OfficeScene;
    const v = this.view as PlayerView;
    const po = v.po.on;
    // Look: edge panning (FNAF-style) or keys.
    const s = store.settings;
    if (!s.directMouse && !v.me.mask) {
      const edge = this.mouseX < 0.25 ? (0.25 - this.mouseX) / 0.25 : this.mouseX > 0.75 ? -(this.mouseX - 0.75) / 0.25 : 0;
      this.yaw += edge * dt * 1.6;
    }
    const keyPan = (s.bindings.panLeft ?? []).some((k) => this.keysHeld.has(k)) ? 1 : (s.bindings.panRight ?? []).some((k) => this.keysHeld.has(k)) ? -1 : 0;
    this.yaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, this.yaw + keyPan * dt * 1.8));
    const fov = s.fov === 'narrow' ? 60 : s.fov === 'wide' ? 80 : 70;
    o.camera.fov = fov;
    o.camera.aspect = window.innerWidth / window.innerHeight;
    o.camera.updateProjectionMatrix();
    const bob = s.reducedMotion ? 0 : Math.sin(t * 1.4) * 0.006;
    o.camera.position.set(0, 1.15 + bob, 1.4);
    o.camera.rotation.set(-0.06 + (s.reducedMotion ? 0 : Math.sin(t * 0.7) * 0.004), this.yaw, 0);

    // Doors and lights.
    let anyLight = false;
    for (const d of o.doors) {
      const st = doors[d.id] ?? { c: false, l: false };
      o.setDoor(d.id, st.c);
      const lit = st.l && !po;
      anyLight ||= lit;
      d.spot.intensity = lit ? 26 : 0;
      d.cone.visible = lit;
      d.motes.visible = lit;
      const vd = v.doors[d.id];
      (d.doorButton.material as THREE.MeshStandardMaterial).emissiveIntensity = vd?.b || vd?.j ? (Math.sin(t * 20) > 0 ? 1.5 : 0.1) : st.c ? 1.4 : 0.25;
      (d.lightButton.material as THREE.MeshStandardMaterial).emissiveIntensity = lit ? 1.5 : 0.05;
    }
    if (anyLight !== this.lastLightHum) {
      this.lastLightHum = anyLight;
      if (anyLight) audio.startLoop('light_hum', 'light_hum');
      else audio.stopLoop('light_hum');
    }
    // Power and blackout lighting.
    const bulbOn = !po;
    o.bulb.visible = bulbOn;
    (o.bulbMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = bulbOn ? 2 : 0;
    o.monitorLight.intensity = po ? 0 : 0.35;
    const since = po ? Math.min(5, (performance.now() - (this.poStart ||= performance.now())) / 1000) : 0;
    o.ambient.intensity = po ? 0.004 * since : 0.08;
    o.fan.userData.speed = po ? Math.max(0, 1 - since / 2) : 1;
    if (o.flashlight && o.flashCone) {
      o.flashlight.intensity = v.me.flash ? 30 : 0;
      o.flashCone.visible = v.me.flash;
    }
    o.maskOverlay.visible = v.me.mask;
    if (this.handTimer > 0) {
      this.handTimer -= dt;
      if (this.handTimer <= 0) for (const c of o.hands.children) c.visible = false;
    }

    // Characters the player can perceive.
    const left = o.doors.find((d) => d.side === 'left');
    for (const a of v.an) {
      if (a.s === 'in_office') {
        const door = o.doors.find((d) => d.id === a.d) ?? o.doors[0];
        o.place(a.id, { pos: door.inside.clone(), rotY: door.side === 'left' ? Math.PI / 2 : -Math.PI / 2, pose: 'stare' });
        continue;
      }
      if ((a.s === 'at_door' || a.s === 'in_vent') && a.d) {
        const door = o.doors.find((d) => d.id === a.d);
        if (door) {
          const vent = door.kind === 'vent';
          o.place(a.id, { pos: door.blindSpot.clone().add(new THREE.Vector3(vent ? 0.6 * (door.side === 'left' ? -1 : 1) : 0, 0, 0)), rotY: door.side === 'left' ? Math.PI / 2 : -Math.PI / 2, pose: vent ? 'crawl' : a.id === 'chica' ? 'lean' : 'stare' });
          continue;
        }
      }
      // Flashlight down the west hall.
      if (v.me.flash && left) {
        const sx = -1;
        if (a.id === 'foxy' && a.run) {
          const x = -3 + sx * (11 - (a.pr ?? 0) * 8.5);
          o.place('foxy', { pos: new THREE.Vector3(x, 0, -0.9), rotY: Math.PI / 2, pose: 'lunge' });
        } else if (a.n === this.map.posterNode) o.place(a.id, { pos: new THREE.Vector3(-6, 0, -0.9), rotY: Math.PI / 2, pose: 'idle' });
        else if (a.n === this.map.westHallNode) o.place(a.id, { pos: new THREE.Vector3(-10, 0, -0.9), rotY: Math.PI / 2, pose: 'idle' });
      }
    }
    // Golden Freddy, slumped in the middle of the room.
    if (v.me.golden) o.place('golden', { pos: new THREE.Vector3(0, 0, 0.45), rotY: 0, pose: 'slumped' });
    // Power-out Freddy in the doorway, face flashing in time with the music.
    if (po && this.poFace && (left ?? o.doors[0])) {
      const door = left ?? o.doors[0];
      const flashOn = store.settings.photosensitive ? true : Math.sin(t * 9) > 0;
      o.place('freddy', { pos: door.blindSpot.clone(), rotY: door.side === 'left' ? Math.PI / 2 : -Math.PI / 2, pose: 'stare', eyesOnly: this.poFace === 2 || !flashOn });
    }
    o.update(dt, t);

    // Post: danger pulse, hallucinations.
    const danger = v.an.some((a) => a.s === 'in_office' || a.s === 'at_door');
    R.post.uniforms.pulse.value = danger && !store.settings.photosensitive ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
    R.post.uniforms.redTint.value = this.hallu.red;
    R.post.uniforms.wobble.value = this.hallu.wobble;
    R.post.uniforms.flash.value = 0;
    R.post.uniforms.aberration.value = 0.0015 + this.hallu.face * 0.02;
    R.post.uniforms.darkness.value = this.hallu.face > 0.5 ? 0.6 : 0;
    R.render(o.scene, o.camera);
  }

  private poStart = 0;

  private renderCamera(t: number): void {
    const R = getRenderer();
    const v = this.view as PlayerView;
    const node = this.cam();
    const room = this.room(node);
    const now = performance.now();
    const ghost = !v.me.alive;
    for (const f of room.flickers) f.update(1 / 60, t);
    if (room.swing) room.swing.rotation.z = Math.sin(t * 0.9) * 0.08;
    if (room.extras.balloons) room.extras.balloons.children.forEach((b, i) => (b.rotation.z = Math.sin(t * 0.8 + i) * 0.08));
    if (now - this.lastCamRender > 1000 / CAM_FPS) {
      this.lastCamRender = now;
      // Who's in the room.
      const staged: Parameters<typeof stageCharacters>[1] = [];
      let slot = 0;
      for (const a of v.an) {
        if (a.n !== node || a.s !== 'room') {
          if (a.id === 'foxy' && node === this.map.coveNode && a.n !== this.map.coveNode) continue;
          if (!(a.id === 'foxy' && a.run && node === this.map.westHallNode)) continue;
        }
        if (a.id === 'foxy' && node === this.map.coveNode) {
          const st = a.st ?? 0;
          if (st >= 3) continue;
          staged.push({ id: 'foxy', slot: 0, pose: st >= 2 ? 'lean' : 'idle', offset: new THREE.Vector3(st >= 2 ? 0.3 : 0, 0, st === 0 ? -0.6 : st === 1 ? -0.3 : 0.15) });
          continue;
        }
        if (a.id === 'foxy' && a.run) {
          staged.push({ id: 'foxy', slot: 0, pose: 'lunge', offset: new THREE.Vector3(0, 0, -3 + (a.pr ?? 0) * 5) });
          continue;
        }
        if (a.id === 'puppet') {
          if (!v.mb.out) continue;
        }
        const dark = a.id === 'freddy' && !['stage', 'dining'].includes(node);
        const stare = a.id === 'bonnie' && node === this.map.backstageNode && Math.sin(t * 0.37) > 0.6;
        staged.push({ id: a.id, slot: slot++, pose: stare ? 'stare' : 'idle', eyesOnly: dark, offset: stare ? new THREE.Vector3(0, 0, 1.2) : undefined });
      }
      if (this.hallu.fakeAnim && now < this.hallu.fakeUntil) staged.push({ id: this.hallu.fakeAnim, slot: 2, pose: 'stare' });
      if (v.shadowNode === node) staged.push({ id: 'shadow_freddy', slot: 1, pose: 'stare' });
      for (const st of staged) this.markSeen(st.id);
      // Shadow Bonnie: 1 in 5,000 views of Party Room 2. Stare for 3 s and you slip somewhere else.
      if (node === 'party_b') {
        if (!this.shadowBonnie.on && this.lastNodeRolled !== node && Math.random() < 1 / 5000) this.shadowBonnie = { on: true, since: now };
        if (this.shadowBonnie.on) {
          staged.push({ id: 'shadow_bonnie', slot: 0, pose: 'stare' });
          if (now - this.shadowBonnie.since > 3000) this.glitchDimension();
        }
      } else this.shadowBonnie.on = false;
      this.lastNodeRolled = node;
      // Very rarely the kitchen plays the music box at 4 AM.
      if (node === 'kitchen' && v.h === 4 && this.start.seed % 50 === 0 && !this.kitchenTune) {
        this.kitchenTune = true;
        audio.melody('freddy', { bpm: 60, gain: 0.08, wobble: 1 });
      }
      stageCharacters(room, staged);
      // Cove curtains and sign.
      const fx = v.an.find((a) => a.id === 'foxy');
      if (room.extras.curtL && fx) {
        const st = fx.st ?? 0;
        const open = st === 0 ? 0 : st === 1 ? 0.25 : 0.9;
        room.extras.curtL.position.x = -0.85 - open * 0.6;
        room.extras.curtR.position.x = 0.85 + open * 0.6;
        room.extras.sign.visible = st >= 3;
      }
      if (room.extras.lid) room.extras.lid.position.y = v.mb.out ? 1.9 : 1.3;
      if (room.extras.golden) room.extras.golden.visible = v.me.poster;
      if (room.extras.endo && Math.random() < 0.002) room.extras.endo.rotation.y = 0.8;
      this.camClickTargets = [room.extras.locker, room.extras.clip].filter(Boolean) as THREE.Object3D[];
      room.camera.aspect = 4 / 3;
      room.camera.updateProjectionMatrix();
      R.renderTo(room.scene, room.camera, this.rt);
      if (this.station === 'control') this.hud?.lureButton(node, v.me.lureCd);
    }
    const glitch = now < this.glitchUntil;
    this.hud?.showSignalLost(glitch);
    const audioOnly = Boolean(this.map.nodes[node]?.audioOnly);
    const staticAmt = v.camsDown || v.me.staticT > 0 ? 1 : glitch ? 0.85 : now < this.camStaticUntil ? 0.9 : audioOnly ? 0.85 : 0.05;
    const theme = String((store.me?.user.equipped.tablet ?? 'tablet_green').replace('tablet_', ''));
    const tint = theme === 'amber' || theme === 'golden' ? new THREE.Vector3(1.15, 0.85, 0.45) : theme === 'ice' ? new THREE.Vector3(0.6, 0.9, 1.25) : new THREE.Vector3(0.75, 1.05, 0.8);
    R.renderCrt(this.rt.texture, { staticAmt, tint, mono: ghost ? 1 : 0, glitch: theme === 'glitch' ? 0.3 : 0 });
    if (ghost) this.ghostTick++;
    // Shadow staring is server-side; this just keeps the stare honest on the client.
    this.shadowStare = v.shadowNode === node ? this.shadowStare + 1 : 0;
    void ROSTER_BY_ID;
    void this.tStart;
  }
}
