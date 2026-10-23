import { h, button, mount, toast } from '../dom';
import { go, register } from '../../app';
import { store } from '../../store';
import { titleBackdrop } from './title';
import { DEFAULT_BINDINGS, type Settings } from '../../settings';
import { getRenderer } from '../../render/renderer';

type Tab = 'audio' | 'video' | 'access' | 'controls' | 'gameplay';

const ACTION_NAMES: Record<string, string> = {
  panLeft: 'Look left',
  panRight: 'Look right',
  tablet: 'Raise / lower tablet',
  doorLeft: 'Left door (South: south-left)',
  doorRight: 'Right door (South: south-right, Control: vent)',
  lightLeft: 'Left light (hold)',
  lightRight: 'Right light (hold)',
  tool: 'Station tool',
  mask: 'Mask (South)',
  panel: 'Maintenance panel (Control)',
  wind: 'Wind music box',
  ping: 'Ping camera (on tablet)',
  pushToTalk: 'Push to talk',
  chat: 'Chat',
  callouts: 'Callout wheel',
  listen: 'Listen at door',
  pause: 'Pause menu',
};

export function settingsPanel(onClose: () => void, initial: Tab = 'audio'): HTMLElement {
  let tab: Tab = initial;
  const wrap = h('div', { class: 'panel', style: 'max-width:900px' });
  const s = () => store.settings;
  const set = (patch: Partial<Settings>) => store.updateSettings(patch);
  const slider = (label: string, key: keyof Settings, min = 0, max = 1, step = 0.05) => {
    const v = h('span', { class: 'v' }, String(s()[key]));
    const r = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(s()[key]) });
    r.addEventListener('input', () => {
      v.textContent = r.value;
      set({ [key]: Number(r.value) } as Partial<Settings>);
    });
    return h('div', { class: 'slider' }, h('div', null, label, ' ', v), r);
  };
  const toggle = (label: string, key: keyof Settings) =>
    h('label', { class: 'toggle', style: 'display:flex;margin:6px 0' }, h('input', { type: 'checkbox', checked: Boolean(s()[key]), onchange: (e: Event) => set({ [key]: (e.target as HTMLInputElement).checked } as Partial<Settings>) }), label);
  const select = <K extends keyof Settings>(label: string, key: K, options: [string, string][]) => {
    const sel = h('select', { onchange: (e: Event) => set({ [key]: coerce((e.target as HTMLSelectElement).value) } as Partial<Settings>) });
    for (const [v, n] of options) {
      const o = h('option', { value: v }, n);
      if (String(s()[key]) === v) o.selected = true;
      sel.appendChild(o);
    }
    return h('div', null, h('label', null, label), sel);
  };
  const coerce = (v: string): string | number => (/^[\d.]+$/.test(v) ? Number(v) : v);

  const render = () => {
    let body: HTMLElement;
    if (tab === 'audio') {
      const mic = h('select', { onchange: (e: Event) => set({ micDevice: (e.target as HTMLSelectElement).value }) }, h('option', { value: '' }, 'Default microphone'));
      navigator.mediaDevices?.enumerateDevices?.().then((ds) => {
        for (const d of ds.filter((x) => x.kind === 'audioinput')) {
          const o = h('option', { value: d.deviceId }, d.label || `Mic ${d.deviceId.slice(0, 6)}`);
          if (d.deviceId === s().micDevice) o.selected = true;
          mic.appendChild(o);
        }
      });
      body = h('div', { class: 'sliders' }, slider('Master', 'master'), slider('Ambience', 'ambience'), slider('Effects', 'effects'), slider('Jump scares', 'jumpscare'), slider('Voice chat', 'voice'), h('div', null, h('label', null, 'Microphone'), mic), toggle('Voice activity instead of push-to-talk', 'voiceActivity'), toggle('Mute all voice', 'muteVoice'), 'speechSynthesis' in window ? toggle('Read phone calls aloud (browser voice)', 'callVoice') : null);
    } else if (tab === 'video') {
      body = h(
        'div',
        { class: 'sliders' },
        select('Quality', 'quality', [
          ['auto', 'Auto'],
          ['low', 'Low'],
          ['medium', 'Medium'],
          ['high', 'High'],
        ]),
        select('Render scale', 'renderScale', [
          ['0.5', '50%'],
          ['0.75', '75%'],
          ['1', '100%'],
        ]),
        select('Frame rate cap', 'fpsCap', [
          ['30', '30'],
          ['60', '60'],
          ['0', 'Unlimited'],
        ]),
        select('Field of view', 'fov', [
          ['narrow', 'Narrow'],
          ['normal', 'Normal'],
          ['wide', 'Wide'],
        ]),
        slider('CRT effect', 'crt'),
        slider('Film grain', 'grain'),
        slider('Brightness', 'brightness', 0.6, 1.6),
        toggle('Scanlines', 'scanlines'),
        toggle('Vignette', 'vignette'),
        toggle('Colourblind-friendly button labels', 'colourblind'),
      );
    } else if (tab === 'access') {
      body = h(
        'div',
        { class: 'col' },
        toggle('Reduced jump scares (no flash, no shake, scream capped at 50%)', 'reducedJumpscares'),
        toggle('Photosensitivity mode (no flashes, strobes or rapid flicker)', 'photosensitive'),
        select('Touch controls', 'touchControls', [
          ['auto', 'Auto (phones and tablets)'],
          ['on', 'Always on'],
          ['off', 'Off'],
        ]),
        toggle('Subtitles', 'subtitles'),
        select('Subtitle size', 'subtitleSize', [
          ['small', 'Small'],
          ['medium', 'Medium'],
          ['large', 'Large'],
        ]),
        toggle('Visual sound cues (directional icons for footsteps, knocks, kitchen, laughs)', 'visualCues'),
        toggle('Toggle lights instead of hold', 'toggleLights'),
        toggle('Hide gore (neutral "You were caught" card)', 'hideGore'),
        toggle('Reduced motion (no head-bob or sway)', 'reducedMotion'),
        toggle('Direct mouse-look instead of edge panning', 'directMouse'),
      );
    } else if (tab === 'controls') {
      const b = s().bindings;
      const used = new Map<string, string[]>();
      for (const [a, keys] of Object.entries(b)) for (const k of keys) used.set(k, [...(used.get(k) ?? []), a]);
      // Q (door/ping) and tablet keys deliberately share by context; anything else sharing is a conflict.
      const contextual = new Set(['doorLeft,ping', 'ping,doorLeft']);
      body = h(
        'div',
        null,
        h(
          'table',
          null,
          Object.keys(DEFAULT_BINDINGS).map((action) => {
            const keys = b[action] ?? [];
            const conflict = keys.some((k) => (used.get(k) ?? []).length > 1 && !contextual.has((used.get(k) ?? []).join(',')));
            const btn = button(keys.map((k) => k.replace(/^Key|^Digit/, '')).join(' / ') || '—', () => {
              btn.textContent = 'Press a key...';
              const onKey = (e: KeyboardEvent) => {
                e.preventDefault();
                window.removeEventListener('keydown', onKey, true);
                set({ bindings: { ...s().bindings, [action]: [e.code] } });
                render();
              };
              window.addEventListener('keydown', onKey, true);
            }, 'btn small');
            return h('tr', null, h('td', null, ACTION_NAMES[action] ?? action), h('td', null, btn), h('td', { class: 'err' }, conflict ? 'conflict' : ''));
          }),
        ),
        button('Reset to defaults', () => (set({ bindings: { ...DEFAULT_BINDINGS } }), render()), 'btn small'),
      );
    } else {
      body = h('div', { class: 'col' }, toggle('Show hour progress bar under the clock', 'hourBar'), toggle('Chat profanity filter', 'profanityFilter'));
    }
    mount(
      wrap,
      h('h2', null, 'Notice Board'),
      h(
        'div',
        { class: 'tabs' },
        (
          [
            ['audio', 'Audio'],
            ['video', 'Video'],
            ['access', 'Accessibility'],
            ['controls', 'Controls'],
            ['gameplay', 'Gameplay'],
          ] as [Tab, string][]
        ).map(([k, n]) => h('button', { class: tab === k ? 'on' : '', onclick: () => ((tab = k), render()) }, n)),
      ),
      body,
      h('div', { style: 'margin-top:14px' }, button('Done', () => {
        try {
          const q = s().quality;
          getRenderer().setQuality(q === 'auto' ? getRenderer().quality : q);
        } catch {
          /* renderer not up */
        }
        onClose();
      }, 'btn primary')),
    );
  };
  render();
  return wrap;
}

register('settings', (root, params) => {
  titleBackdrop(0.2);
  const back = (params.back as string) ?? 'title';
  mount(root, h('div', { class: 'screen center' }, settingsPanel(() => go(back), (params.tab as Tab) ?? 'audio')));
  void toast;
});
