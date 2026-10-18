import { makeRoster, type LobbyState, type Roster } from '@fnaf/shared';
import { api, type MeResponse, type ServerConfig } from './api';
import { loadLocalSettings, merge, saveLocalSettings, type Settings } from './settings';

type Listener = () => void;

class Store {
  config: ServerConfig = { rosterMode: 'tribute', smtp: false, fastNight: false, testHooks: false, ice: [{ urls: 'stun:stun.l.google.com:19302' }] };
  roster: Roster = makeRoster('tribute');
  me: MeResponse | null = null;
  settings: Settings = loadLocalSettings();
  lobby: LobbyState | null = null;
  private listeners = new Set<Listener>();
  private saveTimer: number | null = null;

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(): void {
    for (const l of this.listeners) l();
  }

  async loadConfig(): Promise<void> {
    try {
      this.config = await api.config();
    } catch {
      /* keep defaults */
    }
    this.roster = makeRoster(this.config.rosterMode);
  }

  async refreshMe(): Promise<MeResponse | null> {
    try {
      this.me = await api.me();
      if (this.me.user.settings && Object.keys(this.me.user.settings).length) {
        this.settings = merge(this.me.user.settings);
        saveLocalSettings(this.settings);
      }
    } catch {
      this.me = null;
    }
    this.emit();
    return this.me;
  }

  updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    saveLocalSettings(this.settings);
    document.documentElement.style.setProperty('--brightness', String(this.settings.brightness));
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => {
      if (this.me) api.patchMe({ settings: this.settings as unknown as Record<string, unknown> }).catch(() => {});
    }, 800);
    this.emit();
  }

  highest(mode: string): number {
    return this.me?.progress[mode]?.highestNight ?? 0;
  }
}

export const store = new Store();
