// Player settings: stored on the account (and in localStorage as a fallback for guests and offline).
export interface Settings {
  master: number;
  ambience: number;
  effects: number;
  jumpscare: number;
  voice: number;
  micDevice: string;
  voiceActivity: boolean;
  muteVoice: boolean;
  renderScale: number;
  quality: 'low' | 'medium' | 'high' | 'auto';
  crt: number;
  grain: number;
  scanlines: boolean;
  vignette: boolean;
  fpsCap: 30 | 60 | 0;
  fov: 'narrow' | 'normal' | 'wide';
  brightness: number;
  colourblind: boolean;
  reducedJumpscares: boolean;
  photosensitive: boolean;
  subtitles: boolean;
  callVoice: boolean;
  subtitleSize: 'small' | 'medium' | 'large';
  visualCues: boolean;
  toggleLights: boolean;
  hideGore: boolean;
  reducedMotion: boolean;
  directMouse: boolean;
  /** On-screen touch controls: auto (phones and tablets), always on, or off. */
  touchControls: 'auto' | 'on' | 'off';
  hourBar: boolean;
  profanityFilter: boolean;
  bindings: Record<string, string[]>;
}

export const DEFAULT_BINDINGS: Record<string, string[]> = {
  panLeft: ['KeyA', 'ArrowLeft'],
  panRight: ['KeyD', 'ArrowRight'],
  tablet: ['Space', 'KeyS'],
  doorLeft: ['KeyQ'],
  doorRight: ['KeyE'],
  lightLeft: ['KeyZ'],
  lightRight: ['KeyC'],
  tool: ['KeyF'],
  mask: ['KeyM'],
  panel: ['Tab'],
  wind: ['KeyW'],
  ping: ['KeyQ'],
  pushToTalk: ['KeyV'],
  chat: ['Enter'],
  callouts: ['KeyG'],
  listen: ['KeyL'],
  pause: ['Escape'],
};

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  ambience: 0.8,
  effects: 0.9,
  jumpscare: 0.9,
  voice: 0.9,
  micDevice: '',
  voiceActivity: false,
  muteVoice: false,
  renderScale: 1,
  quality: 'auto',
  crt: 0.7,
  grain: 0.5,
  scanlines: true,
  vignette: true,
  fpsCap: 60,
  fov: 'normal',
  brightness: 1,
  colourblind: false,
  reducedJumpscares: false,
  photosensitive: false,
  subtitles: true,
  callVoice: false,
  subtitleSize: 'medium',
  visualCues: false,
  toggleLights: false,
  hideGore: false,
  reducedMotion: false,
  directMouse: false,
  touchControls: 'auto',
  hourBar: false,
  profanityFilter: true,
  bindings: DEFAULT_BINDINGS,
};

const KEY = 'fr_settings';

export function loadLocalSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(JSON.parse(raw) as Partial<Settings>);
  } catch {
    /* storage blocked */
  }
  return structuredClone(DEFAULT_SETTINGS);
}

export function merge(s: Partial<Settings> | Record<string, unknown>): Settings {
  const m = { ...structuredClone(DEFAULT_SETTINGS), ...(s as Partial<Settings>) };
  m.bindings = { ...DEFAULT_BINDINGS, ...((s as Partial<Settings>).bindings ?? {}) };
  return m;
}

export function saveLocalSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage blocked */
  }
}

export function keyFor(s: Settings, action: string): string {
  return (s.bindings[action] ?? DEFAULT_BINDINGS[action] ?? [''])[0].replace(/^Key/, '').replace(/^Digit/, '');
}
