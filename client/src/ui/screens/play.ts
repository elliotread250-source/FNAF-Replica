import { h, button, mount, toast } from '../dom';
import { go, register } from '../../app';
import { store } from '../../store';
import { titleBackdrop, disclaimer } from './title';
import { emitAck, getSocket } from '../../net/socket';
import type { LobbySummary } from '@fnaf/shared';

type Mode = 'nightshift' | 'classic' | 'showtime';

register('play', (root) => {
  titleBackdrop(0.35);
  getSocket();
  if (store.lobby) {
    go('lobby');
    return;
  }
  let mode: Mode = 'nightshift';
  let night = 1;
  let pub = false;
  const list = h('div', { class: 'col' });
  const err = h('div', { class: 'err' });

  const enter = (r: { code?: string; error?: { message: string } }) => {
    if (r.error) {
      err.textContent = r.error.message;
      return;
    }
    go('lobby');
  };

  const refresh = async () => {
    const r = await emitAck<{ lobbies?: LobbySummary[] }>('lobby:list');
    const rows = r.lobbies ?? [];
    mount(
      list,
      rows.length
        ? h(
            'table',
            null,
            h('tr', null, h('th', null, 'Host'), h('th', null, 'Mode'), h('th', null, 'Night'), h('th', null, 'Staff'), h('th', null, '')),
            rows.map((l) =>
              h(
                'tr',
                null,
                h('td', null, `${l.host} ${'★'.repeat(l.stars)}`),
                h('td', null, l.mode),
                h('td', null, String(l.night)),
                h('td', null, `${l.players}/${l.max}`),
                h('td', null, button('Join', async () => enter(await emitAck('lobby:join', { code: l.code })), 'btn small')),
              ),
            ),
          )
        : h('div', { class: 'dim' }, 'No open shifts right now. Start one.'),
    );
  };

  const render = () => {
    const highest = store.highest(mode === 'classic' ? 'classic' : 'nightshift');
    const maxNight = store.config.fastNight ? 7 : mode === 'showtime' ? 5 : highest >= 6 ? 7 : Math.min(6, highest + 1);
    if (night > maxNight) night = maxNight;
    const nightSel = h('select', { id: 'night-select', onchange: (e: Event) => (night = Number((e.target as HTMLSelectElement).value)) });
    for (let n = 1; n <= 7; n++) {
      const o = h('option', { value: String(n) }, n === 7 ? 'Custom Night' : `Night ${n}`);
      if (n > maxNight) o.disabled = true;
      if (n === night) o.selected = true;
      nightSel.appendChild(o);
    }
    const codeIn = h('input', { maxlength: '4', placeholder: 'ABCD', id: 'join-code', style: 'text-transform:uppercase;width:110px;font-size:26px;font-family:VT323' });
    mount(
      root,
      h(
        'div',
        { class: 'screen center' },
        h(
          'div',
          { class: 'panel' },
          h('h2', null, 'Clock In'),
          h(
            'div',
            { class: 'tabs' },
            (['nightshift', 'classic', 'showtime'] as Mode[]).map((m) =>
              h('button', { class: m === mode ? 'on' : '', onclick: () => ((mode = m), render()) }, m === 'nightshift' ? 'Night Shift (co-op)' : m === 'classic' ? 'Classic Office (solo)' : 'Showtime (versus)'),
            ),
          ),
          mode === 'nightshift' ? h('div', { class: 'dim' }, 'Playing alone? Try Classic Office, the way it began.') : null,
          h(
            'div',
            { class: 'row', style: 'margin:10px 0' },
            nightSel,
            mode !== 'classic' ? h('label', { class: 'toggle' }, h('input', { type: 'checkbox', onchange: (e: Event) => (pub = (e.target as HTMLInputElement).checked) }), 'Public') : null,
            button(mode === 'classic' ? 'Start shift' : 'Create lobby', async () => enter(await emitAck('lobby:create', { mode, night, options: { public: pub } })), 'btn primary', { id: 'create-lobby' }),
          ),
          mode !== 'classic'
            ? h(
                'div',
                { class: 'row', style: 'margin:10px 0' },
                codeIn,
                button('Join', async () => enter(await emitAck('lobby:join', { code: codeIn.value.trim().toUpperCase() })), 'btn', { id: 'join-btn' }),
                button('Quick Play', async () => enter(await emitAck('lobby:quick')), 'btn'),
              )
            : null,
          err,
          mode !== 'classic' ? h('div', null, h('h3', null, 'Find a shift ', button('↻', () => void refresh(), 'btn small')), list) : null,
          h('div', { style: 'margin-top:14px' }, button('Back', () => go('title'), 'btn')),
        ),
      ),
      disclaimer(),
    );
    if (mode !== 'classic') void refresh();
  };
  render();
  void toast;
});
