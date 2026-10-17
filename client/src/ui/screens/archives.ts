import { h, button, mount } from '../dom';
import { go, register } from '../../app';
import { store } from '../../store';
import { titleBackdrop } from './title';
import { TurntableView } from '../turntableView';
import { CALLS, CLIPPINGS, ROSTER, CORE_IDS } from '@fnaf/shared';
import { newspaperTex } from '../../render/textures';
import { audio, SOUND_NAMES, MELODIES } from '../../audio/engine';
import { MINIGAMES, runMinigame } from '../../minigames';
import { api } from '../../api';

type Tab = 'gallery' | 'news' | 'calls' | 'minigames' | 'sounds' | 'boards' | 'credits';

register('archives', (root) => {
  titleBackdrop(0.15);
  let tab: Tab = 'gallery';
  let xray = false;
  let selected = 'freddy';
  const view = new TurntableView(360, 440);
  const arch = new Set((store.me?.archive ?? []).map((a) => `${a.kind}:${a.id}`));
  const seenChars = new Set<string>([...CORE_IDS, 'golden', 'puppet', ...[...arch].filter((a) => a.startsWith('character:')).map((a) => a.slice(10))]);
  view.tt.showCharacter(selected, xray);
  const render = () => {
    let body: HTMLElement;
    if (tab === 'gallery') {
      const r = ROSTER.find((x) => x.id === selected)!;
      body = h(
        'div',
        { class: 'split' },
        h('div', { class: 'left' }, view.canvas, h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: xray, onchange: (e: Event) => ((xray = (e.target as HTMLInputElement).checked), view.tt.showCharacter(selected, xray)) }), 'X-ray: endoskeleton view'), h('h3', null, store.roster.name(r.id)), h('div', null, store.roster.fill(r.description)), h('div', { class: 'dim', style: 'margin-top:6px' }, `Counter: ${store.roster.fill(r.counter)}`), h('div', { class: 'dim' }, r.shipped ? `Wave ${r.wave}` : `Wave ${r.wave}: coming soon (modelled, no night rule yet)`)),
        h(
          'div',
          { class: 'right' },
          h(
            'div',
            { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(140px,1fr))' },
            ROSTER.map((x) => {
              const seen = seenChars.has(x.id) || x.shipped;
              return h('div', { class: `item ${selected === x.id ? 'equipped' : ''} ${seen ? '' : 'locked'}`, style: 'min-height:56px', onclick: () => ((selected = x.id), view.tt.showCharacter(x.id, xray), render()) }, h('div', { class: 'name' }, seen ? store.roster.name(x.id) : '???'), h('div', { class: 'dim' }, x.shipped ? `Wave ${x.wave}` : 'coming soon'));
            }),
          ),
        ),
      );
    } else if (tab === 'news') {
      body = h(
        'div',
        { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(220px,1fr))' },
        CLIPPINGS.map((c) => {
          const seen = arch.has(`newspaper:${c.id}`);
          if (!seen) return h('div', { class: 'item locked' }, '??? (zoom into it on a camera)');
          const t = newspaperTex(store.roster.fill(c.headline), [store.roster.fill(c.body[0]), store.roster.fill(c.body[1])], c.id);
          const src = t.image as HTMLCanvasElement;
          const copy = document.createElement('canvas');
          copy.width = src.width;
          copy.height = src.height;
          copy.getContext('2d')?.drawImage(src, 0, 0);
          copy.style.width = '100%';
          return h('div', { class: 'item' }, copy);
        }),
      );
    } else if (tab === 'calls') {
      body = h('div', { class: 'col' }, Object.values(CALLS).map((c) => h('details', null, h('summary', null, `Night ${c.night}`), h('div', { class: 'legal' }, c.lines.map((l) => h('p', null, store.roster.fill(l.text)))))));
    } else if (tab === 'minigames') {
      body = h('div', { class: 'col' }, MINIGAMES.map((m) => (arch.has(`minigame:${m.id}`) ? button(m.name, () => runMinigame(document.body, m.id, () => {}, false), 'btn') : h('div', { class: 'dim' }, `??? (seen after some deaths)`))));
    } else if (tab === 'sounds') {
      body = h('div', { class: 'row' }, SOUND_NAMES.filter((n) => !n.startsWith('scream') || store.settings.jumpscare > 0).map((n) => button(n, () => void audio.init().then(() => audio.play(n)), 'btn small')), Object.keys(MELODIES).map((m) => button(`♪ ${m}`, () => void audio.init().then(() => audio.melody(m, { gain: 0.25 })), 'btn small')));
    } else if (tab === 'boards') {
      const box = h('div', { class: 'dim' }, 'Loading...');
      void Promise.all(['nights', 'custom', 'showtime'].map((b) => api.leaderboard(b))).then((boards) =>
        mount(box, h('div', { class: 'split' }, boards.map((b) => h('div', { class: 'grow' }, h('h3', null, b.board), h('table', null, b.rows.slice(0, 20).map((r, i) => h('tr', null, h('td', null, String(i + 1)), h('td', null, `${r.name} ${'★'.repeat(r.stars)}`), h('td', null, String(r.value))))))))),
      );
      body = box;
    } else {
      body = h('div', { class: 'legal' }, h('p', null, 'Created by elliotread250-source with Claude Code.'), h('p', null, "Inspired by Five Nights at Freddy's by Scott Cawthon. All art, audio and code in this game are original: every model is built from primitives, every texture is drawn on a canvas, every sound is synthesised in your browser."), h('p', null, 'Music: Bizet\'s Toreador Song (1875) and "Pop Goes the Weasel", both public domain, arranged as note data.'));
    }
    mount(
      root,
      h(
        'div',
        { class: 'screen center' },
        h(
          'div',
          { class: 'panel', style: 'max-width:1200px' },
          h('h2', null, 'Archives'),
          h(
            'div',
            { class: 'tabs' },
            (
              [
                ['gallery', 'Characters'],
                ['news', 'Newspapers'],
                ['calls', 'Phone calls'],
                ['minigames', 'Minigames'],
                ['sounds', 'Soundtrack'],
                ['boards', 'Leaderboards'],
                ['credits', 'Extras'],
              ] as [Tab, string][]
            ).map(([k, n]) => h('button', { class: tab === k ? 'on' : '', onclick: () => ((tab = k), render()) }, n)),
          ),
          body,
          h('div', { style: 'margin-top:12px' }, button('Back', () => go('title'), 'btn')),
        ),
      ),
    );
  };
  render();
  return () => view.dispose();
});
