import { h, mount } from '../ui/dom';
import { store } from '../store';
import { CALLOUTS, CLASSIC_MAP, COOP_MAP, filterProfanity, type MapDef, type PlayerView, type StationId } from '@fnaf/shared';
import { keyFor } from '../settings';

export interface HudHandlers {
  onCamera(node: string): void;
  onTabletBar(): void;
  onPing(): void;
  onCallout(i: number): void;
  onChat(text: string): void;
  onReboot(sys: string): void;
  onLure(node: string): void;
  onBoost(st: StationId): void;
  onWind(on: boolean): void;
  onMute(): void;
  onPanelClose(): void;
}

const SYS_NAMES: Record<string, string> = { cameras: 'Cameras', audio: 'Audio Devices', ventilation: 'Ventilation', power: 'Power Routing' };

export class Hud {
  readonly root: HTMLElement;
  private clock = h('div', { class: 'hud-clock' });
  private power = h('div', { class: 'hud-power' });
  private team = h('div', { class: 'hud-team' });
  private icons = h('div', { class: 'hud-icons' });
  private tabletBar: HTMLElement;
  readonly camMap = h('div', { class: 'cam-map hud-i' });
  private camLabel = h('div', { class: 'cam-label' });
  private camOverlay = h('div', { class: 'cam-disabled' });
  private signalLost = h('div', { class: 'signal-lost' }, 'SIGNAL LOST');
  readonly subtitles = h('div', { class: 'subtitles' });
  private chatLog = h('div', { class: 'chat-log' });
  private chatInput: HTMLInputElement;
  private callouts = h('div', { class: 'callouts hud-i' });
  private panel = h('div', { class: 'panel-maint hud-i' });
  private musicBox = h('div', { class: 'music-box' });
  private alert = h('div', { class: 'alert' });
  readonly cues = h('div', { class: 'cues' });
  private muteBtn: HTMLButtonElement;
  private map: MapDef;
  private pings = new Map<string, { node: string; until: number; color: string; name: string }>();
  private lastMapKey = '';
  showCallouts = false;
  chatOpen = false;

  constructor(
    parent: HTMLElement,
    private mapId: 'classic' | 'coop',
    private station: StationId | null,
    private night: number,
    private hourSeconds: number,
    private hdl: HudHandlers,
  ) {
    this.map = mapId === 'classic' ? CLASSIC_MAP : COOP_MAP;
    this.tabletBar = h('div', { class: 'tablet-bar hud-i', onmouseenter: () => hdl.onTabletBar(), onpointerdown: ((e: PointerEvent) => void (e.pointerType === 'touch' && hdl.onTabletBar())) as EventListener }, '▲ ▲ ▲');
    this.chatInput = h('input', { class: 'chat-input', maxlength: '120', placeholder: 'Radio message (Enter to send, Esc to close)' });
    this.chatInput.style.display = 'none';
    this.chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        const t = this.chatInput.value.trim();
        if (t) hdl.onChat(t);
        this.closeChat();
      } else if (e.key === 'Escape') this.closeChat();
    });
    this.muteBtn = h('button', { class: 'btn small hud-i', style: 'position:absolute;top:120px;right:22px;display:none', onclick: () => hdl.onMute() }, 'Mute call');
    this.root = h(
      'div',
      { id: 'hud' },
      this.camLabel,
      this.camOverlay,
      this.signalLost,
      this.clock,
      this.power,
      this.team,
      this.icons,
      this.musicBox,
      this.alert,
      this.camMap,
      this.tabletBar,
      this.subtitles,
      this.chatLog,
      this.chatInput,
      this.callouts,
      this.panel,
      this.cues,
      this.muteBtn,
    );
    this.subtitles.style.setProperty('--sub-size', { small: '16px', medium: '20px', large: '28px' }[store.settings.subtitleSize]);
    this.panel.style.display = 'none';
    this.callouts.style.display = 'none';
    this.signalLost.style.display = 'none';
    parent.appendChild(this.root);
    this.buildCallouts();
  }

  private buildCallouts(): void {
    mount(
      this.callouts,
      ...CALLOUTS.map((c, i) => {
        const a = (i / CALLOUTS.length) * Math.PI * 2 - Math.PI / 2;
        return h('button', { style: `left:${50 + Math.cos(a) * 38}%;top:${50 + Math.sin(a) * 38}%`, onclick: () => (this.hdl.onCallout(i), this.toggleCallouts(false)) }, store.roster.fill(c));
      }),
    );
  }

  toggleCallouts(on = !this.showCallouts): void {
    this.showCallouts = on;
    this.callouts.style.display = on ? 'block' : 'none';
  }

  openChat(): void {
    this.chatOpen = true;
    this.chatInput.style.display = 'block';
    this.chatInput.value = '';
    this.chatInput.focus();
  }

  closeChat(): void {
    this.chatOpen = false;
    this.chatInput.style.display = 'none';
    this.chatInput.blur();
  }

  chat(from: string, text: string, ghost = false): void {
    const t = store.settings.profanityFilter ? filterProfanity(text) : text;
    const line = h('div', { class: ghost ? 'ghost' : '' }, `${from}: ${t}`);
    this.chatLog.appendChild(line);
    setTimeout(() => line.remove(), 6000);
    while (this.chatLog.children.length > 8) this.chatLog.firstChild?.remove();
  }

  ping(from: string, node: string, ghost: boolean, mine: boolean): void {
    this.pings.set(from, { node, until: performance.now() + 8000, color: ghost ? '#9ad8ff' : mine ? '#5af07a' : '#ff3a3a', name: from });
    this.lastMapKey = '';
  }

  cue(text: string, side: 'left' | 'right' | 'center'): void {
    if (!store.settings.visualCues) return;
    const c = h('div', { class: 'cue', style: side === 'left' ? 'left:30px;top:45%' : side === 'right' ? 'right:30px;top:45%' : 'left:50%;top:30%;transform:translateX(-50%)' }, `${side === 'left' ? '◀ ' : ''}${text}${side === 'right' ? ' ▶' : ''}`);
    this.cues.appendChild(c);
    setTimeout(() => (c.style.opacity = '0'), 1500);
    setTimeout(() => c.remove(), 2000);
  }

  flashAlert(text: string, ms = 3000): void {
    this.alert.textContent = text;
    this.alert.style.display = 'block';
    setTimeout(() => {
      if (this.alert.textContent === text) this.alert.style.display = 'none';
    }, ms);
  }

  setCallMuteVisible(v: boolean, votes = 0, needed = 0): void {
    this.muteBtn.style.display = v ? 'block' : 'none';
    this.muteBtn.textContent = votes ? `Mute call (${votes}/${needed})` : 'Mute call';
  }

  showSignalLost(on: boolean): void {
    this.signalLost.style.display = on ? 'block' : 'none';
  }

  update(v: PlayerView, o: { tablet: boolean; cam: string; panelOpen: boolean; speaking: Set<string>; playersOnline: Set<string>; hourFrac: number; doors: Record<string, { c: boolean; l: boolean }> }): void {
    const ghost = !v.me.alive;
    const pup = v.me.role === 'puppeteer';
    const hourLabel = v.h === 0 ? '12 AM' : `${v.h} AM`;
    mount(
      this.clock,
      h('div', null, hourLabel),
      h('div', { class: 'night' }, this.night === 7 ? 'Custom Night' : `Night ${this.night}`),
      store.settings.hourBar ? h('div', { class: 'hud-hourbar', style: `width:${Math.round(o.hourFrac * 100)}%` }) : null,
    );
    if (!pup) {
      const usage = v.me.usage;
      const bars = Array.from({ length: Math.min(6, Math.max(1, usage)) }, (_, i) => h('i', { style: `background:${i < 2 ? '#3ac84a' : i < 4 ? '#e8c22c' : '#e83a3a'}` }));
      mount(this.power, h('div', null, `Power left: ${Math.floor(v.p)}%`), h('div', null, 'Usage:', h('span', { class: 'usage' }, bars)), this.mapId === 'coop' && v.stations.length > 1 ? h('div', { style: 'font-size:18px;color:#aaa' }, `Building drain: ${(v.drain * 60).toFixed(1)}%/min`) : null);
    } else mount(this.power, h('div', null, `Kills: ${v.stime?.kills ?? 0}`));

    mount(
      this.team,
      v.stations
        .filter((s) => !s.sealed && s.pid)
        .map((s) => h('div', { class: s.alive ? (s.ab ? 'dead' : '') : 'dead' }, `${s.name || s.id}`, s.tab ? h('span', { class: 'tab' }, ' [CAM]') : null, o.speaking.has(s.pid ?? '') ? h('span', { class: 'spk' }, ' ♪') : null, !s.conn ? ' (lost signal)' : '', s.boost ? ' ⚡' : '')),
    );

    if (!pup && !ghost) {
      const icons: HTMLElement[] = [];
      for (const [id, d] of Object.entries(o.doors)) {
        if (v.doors[id]?.st !== v.me.st) continue;
        const nm = id === 'vent' ? 'VENT' : id.toUpperCase().replace('SOUTH_', 'S-');
        icons.push(h('span', { class: d.c ? 'closed' : '' }, `${nm} ${d.c ? '■' : '□'}`), h('span', { class: d.l ? 'on' : '' }, `${d.l ? '☀' : '·'}`));
      }
      if (v.me.st === 'west' || v.me.st === 'solo') icons.push(h('span', { class: v.me.flash ? 'on' : '' }, `Torch ${v.me.battery}%`));
      if (v.me.mic) icons.push(h('span', { class: 'on' }, 'MIC'));
      if (v.me.mask) icons.push(h('span', { class: 'on' }, 'MASK'));
      mount(this.icons, ...icons);
    } else mount(this.icons);

    // Music box dial: Technician always, everyone when it's low or they're on CAM 08.
    if (v.mb.on && (v.me.st === 'control' || v.mb.lvl < 40 || (o.tablet && o.cam === 'arcade'))) {
      this.musicBox.style.display = 'block';
      mount(this.musicBox, h('div', null, `Music box ${Math.round(v.mb.lvl)}%`, o.tablet && o.cam === 'arcade' ? ` (hold ${keyFor(store.settings, 'wind')} to wind)` : ''), h('div', { class: 'dial' }, h('i', { style: `width:${v.mb.lvl}%` })));
    } else this.musicBox.style.display = 'none';
    if (v.mb.out) {
      this.alert.style.display = 'block';
      this.alert.textContent = `${store.roster.name('puppet').toUpperCase()} IS OUT. WIND THE BOX.`;
    }

    // Tablet: map, label, overlays.
    this.tabletBar.style.display = pup || ghost || v.me.mask || v.po.on ? 'none' : 'flex';
    const showMap = o.tablet && !pup;
    this.camMap.style.display = showMap ? 'block' : 'none';
    this.camLabel.style.display = showMap ? 'block' : 'none';
    if (showMap) {
      const node = this.map.nodes[o.cam];
      mount(this.camLabel, h('span', { class: 'rec' }, '● '), `${node?.cam ?? ''} ${node?.name?.toUpperCase() ?? ''}`, ghost ? h('div', { style: 'font-size:18px;color:#9ad8ff' }, 'GHOST VIEW (free)') : null);
      const disabled = v.camsDown || v.me.staticT > 0 ? '' : node?.audioOnly ? '-CAMERA DISABLED-\nAUDIO ONLY' : '';
      this.camOverlay.style.display = disabled ? 'flex' : 'none';
      this.camOverlay.textContent = disabled;
      const now = performance.now();
      for (const [k, p] of this.pings) if (p.until < now) this.pings.delete(k);
      for (const s of v.stations) if (s.ping && !this.pings.has(s.name)) this.pings.set(s.name, { node: s.ping, until: now + 8000, color: s.alive ? '#ff3a3a' : '#9ad8ff', name: s.name });
      const key = `${o.cam}|${[...this.pings.values()].map((p) => p.node).join(',')}|${v.lure}`;
      if (key !== this.lastMapKey) {
        this.lastMapKey = key;
        this.renderMap(o.cam);
      }
    } else this.camOverlay.style.display = 'none';

    // Technician panel.
    this.panel.style.display = o.panelOpen && v.me.st === 'control' && v.me.alive ? 'block' : 'none';
    if (o.panelOpen && v.me.st === 'control') this.renderPanel(v);
  }

  private renderMap(cam: string): void {
    const pingNodes = new Map<string, string>();
    for (const p of this.pings.values()) pingNodes.set(p.node, p.color);
    mount(
      this.camMap,
      ...Object.values(this.map.nodes)
        .filter((n) => n.cam)
        .map((n) => {
          const ping = pingNodes.get(n.id);
          return h(
            'button',
            {
              class: `${n.id === cam ? 'on' : ''} ${ping ? 'ping' : ''}`,
              style: `left:${n.x}%;top:${n.y}%;${ping ? `--ping:${ping}` : ''}`,
              'data-cam': n.id,
              onclick: (e: Event) => {
                e.stopPropagation();
                this.hdl.onCamera(n.id);
              },
            },
            n.cam!.replace('CAM ', ''),
          );
        }),
      ...this.map.stations.map((s) => h('div', { class: 'station', style: `left:${s.x}%;top:${s.y}%` }, s.id === this.station ? '★ YOU' : s.name.split(' ')[0])),
      h('button', { style: 'left:88%;top:96%;border-color:#ff3a3a;color:#ff3a3a', onclick: (e: Event) => (e.stopPropagation(), this.hdl.onPing()) }, `PING (${keyFor(store.settings, 'ping')})`),
    );
  }

  private renderPanel(v: PlayerView): void {
    const systems = ['cameras', 'audio', 'ventilation', 'power', ...v.stations.filter((s) => !s.sealed && s.id !== 'control').map((s) => `doors_${s.id}`)];
    const rb = v.me.reboot;
    mount(
      this.panel,
      h('div', { style: 'font-size:28px' }, 'MAINTENANCE PANEL'),
      ...systems.map((sys) => {
        const failed = v.failed.includes(sys);
        return h(
          'div',
          { class: 'sys' },
          h('span', null, h('span', { class: 'led', style: `background:${failed ? '#ff3a3a' : '#3aff6a'}` }), SYS_NAMES[sys] ?? `Door Controls (${sys.slice(6)})`),
          failed && !rb ? h('button', { onclick: () => this.hdl.onReboot(sys) }, 'REBOOT') : h('span', null, failed ? 'ERROR' : 'OK'),
        );
      }),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { onclick: () => this.hdl.onReboot('all'), disabled: Boolean(rb) || !v.failed.length }, 'REBOOT ALL')),
      rb ? h('div', null, `rebooting ${rb.sys}...`, h('div', { class: 'bar' }, h('i', { style: `width:${Math.max(0, 100 - (rb.left / (rb.sys === 'all' ? 240 : 100)) * 100)}%` }))) : null,
      h('div', { style: 'margin-top:8px' }, 'POWER ROUTING ', v.me.boostCd > 0 ? `(cooldown ${Math.ceil(v.me.boostCd / 20)}s)` : '', ...v.stations.filter((s) => s.alive && !s.sealed).map((s) => h('button', { disabled: v.me.boostCd > 0, onclick: () => this.hdl.onBoost(s.id), style: 'margin-left:6px' }, `Boost ${s.id}`))),
      h('div', { style: 'margin-top:8px' }, 'AUDIO LURE ', v.me.lureCd > 0 ? `(cooldown ${Math.ceil(v.me.lureCd / 20)}s)` : '(open your tablet and click a camera, then press Lure)'),
      v.mb.on ? h('div', { style: 'margin-top:8px' }, `MUSIC BOX ${Math.round(v.mb.lvl)}% `, h('button', { onpointerdown: () => this.hdl.onWind(true), onpointerup: () => this.hdl.onWind(false), onpointerleave: () => this.hdl.onWind(false) }, `HOLD TO WIND (${keyFor(store.settings, 'wind')})`)) : null,
      h('div', { style: 'margin-top:8px' }, h('button', { onclick: () => this.hdl.onPanelClose() }, `CLOSE (${keyFor(store.settings, 'panel')})`)),
    );
  }

  /** A lure button appears on the camera map for the Technician. */
  lureButton(cam: string, cd: number): void {
    if (this.camMap.querySelector('.lure')) this.camMap.querySelector('.lure')?.remove();
    this.camMap.appendChild(h('button', { class: 'lure', style: 'left:12%;top:96%;border-color:#ffd21a;color:#ffd21a', disabled: cd > 0, onclick: (e: Event) => (e.stopPropagation(), this.hdl.onLure(cam)) }, cd > 0 ? `LURE ${Math.ceil(cd / 20)}s` : 'PLAY AUDIO'));
  }

  dispose(): void {
    this.root.remove();
  }

  get hourSecs(): number {
    return this.hourSeconds;
  }
}
