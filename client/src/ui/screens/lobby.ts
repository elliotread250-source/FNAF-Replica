import { h, button, mount, toast } from '../dom';
import { go, register } from '../../app';
import { store } from '../../store';
import { titleBackdrop } from './title';
import { emitAck, getSocket } from '../../net/socket';
import { PRESETS, ROSTER, CUSTOM_NIGHT_NOTE, COSMETICS_BY_ID, CONFIG, type LobbyState } from '@fnaf/shared';

const STATIONS = [
  { id: 'west', name: 'West Office', role: 'Night Guard (West)', tool: 'Flashlight' },
  { id: 'east', name: 'East Office', role: 'Night Guard (East)', tool: 'Kitchen Mic' },
  { id: 'south', name: 'South Office', role: 'Night Guard (South)', tool: 'Mask' },
  { id: 'control', name: 'Control Room', role: 'Technician', tool: 'Maintenance Panel' },
];

register('lobby', (root) => {
  titleBackdrop(0.25);
  const sock = getSocket();
  let showCustom = false;

  const render = () => {
    const l = store.lobby;
    if (!l) {
      go('play');
      return;
    }
    const me = store.me?.user.id;
    const mine = l.players.find((p) => p.userId === me);
    const isHost = l.hostId === me;
    const cnt = l.players.length;
    const others = l.players.filter((p) => p.userId !== l.hostId && p.connected);
    const allReady = others.every((p) => p.ready);
    const playerCard = (p: LobbyState['players'][number]) => {
      const guard = COSMETICS_BY_ID[p.equipped.guard ?? '']?.name ?? 'Classic Blue';
      const badge = COSMETICS_BY_ID[p.badge ?? ''];
      return h(
        'div',
        { class: `pcard ${p.ready || p.userId === l.hostId ? 'ready' : ''}`, 'data-player': p.name },
        h('div', { class: 'pname', onclick: () => go('profile', { username: p.name, back: 'lobby' }) }, p.name, ' ', h('span', { class: 'stars', style: 'font-size:16px' }, '★'.repeat(p.stars))),
        p.title ? h('div', { class: 'dim' }, p.title) : null,
        badge ? h('div', null, h('span', { class: 'swatch', style: `background:${badge.params.color}` }), badge.name) : null,
        h('div', { class: 'dim', 'data-skin': guard }, `Uniform: ${guard}`),
        h('div', null, p.puppeteer ? 'PUPPETEER' : p.station ? STATIONS.find((s) => s.id === p.station)?.name ?? p.station : 'No station'),
        h('div', { class: 'dim' }, p.isHost ? 'Host' : p.ready ? 'Ready' : 'Not ready', p.connected ? '' : ' (lost signal)'),
        isHost && p.userId !== me ? button('Kick', () => sock.emit('lobby:kick', { userId: p.userId }), 'btn small') : null,
        isHost && l.mode === 'showtime' && !p.puppeteer ? button('Make Puppeteer', () => sock.emit('lobby:puppeteer', { userId: p.userId }), 'btn small') : null,
      );
    };
    const sealedNote =
      l.mode === 'nightshift' && cnt < 4
        ? cnt === 1
          ? 'Solo: West and East merge into one station. Playing alone? Try Classic Office, the way it began.'
          : cnt === 2
            ? 'Two guards: West and East are staffed. South and Control are sealed.'
            : 'Three guards: West, East and Control are staffed. South is sealed.'
        : '';

    const nightSel = h('select', { disabled: !isHost, onchange: (e: Event) => sock.emit('lobby:settings', { night: Number((e.target as HTMLSelectElement).value) }) });
    for (let n = 1; n <= 7; n++) {
      const o = h('option', { value: String(n) }, n === 7 ? 'Custom Night' : `Night ${n}`);
      if (n === l.night) o.selected = true;
      nightSel.appendChild(o);
    }
    const modeSel = h('select', { disabled: !isHost || l.mode === 'classic', onchange: (e: Event) => sock.emit('lobby:settings', { mode: (e.target as HTMLSelectElement).value }) });
    for (const [v, n] of [
      ['nightshift', 'Night Shift'],
      ['showtime', 'Showtime'],
    ]) {
      const o = h('option', { value: v }, n);
      if (v === l.mode) o.selected = true;
      modeSel.appendChild(o);
    }
    if (l.mode === 'classic') modeSel.appendChild(h('option', { value: 'classic', selected: true }, 'Classic Office'));

    const custom = l.night === 7 ? customPanel(l, isHost, () => ((showCustom = !showCustom), render()), showCustom) : null;
    mount(
      root,
      h(
        'div',
        { class: 'screen center' },
        h(
          'div',
          { class: 'panel', style: 'max-width:1100px' },
          h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', null, l.mode === 'classic' ? 'Classic Office' : 'Waiting for staff...'), h('div', null, h('span', { class: 'dim' }, 'Room code (tell your crew): '), h('span', { class: 'code', id: 'room-code' }, l.code))),
          h('div', { class: 'row' }, modeSel, nightSel, isHost && l.mode !== 'classic'
            ? h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: l.options.public, onchange: (e: Event) => sock.emit('lobby:settings', { options: { public: (e.target as HTMLInputElement).checked } }) }), 'Public')
            : null, isHost && l.mode !== 'classic'
            ? h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: l.options.ghostsTalk, onchange: (e: Event) => sock.emit('lobby:settings', { options: { ghostsTalk: (e.target as HTMLInputElement).checked } }) }), 'Ghosts can talk to the living')
            : null, isHost && l.mode === 'nightshift'
            ? h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: l.options.fillBots, onchange: (e: Event) => sock.emit('lobby:settings', { options: { fillBots: (e.target as HTMLInputElement).checked } }) }), 'Fill with bots')
            : null),
          sealedNote ? h('div', { class: 'dim', style: 'margin:6px 0' }, sealedNote) : null,
          l.mode !== 'classic'
            ? h(
                'div',
                null,
                h('h3', null, 'Pick your station'),
                h(
                  'div',
                  { class: 'row' },
                  STATIONS.map((s) => {
                    const taken = l.players.find((p) => p.station === s.id);
                    return button(`${s.name}${taken ? ` (${taken.name})` : ''}`, () => sock.emit('lobby:station', { station: s.id }), `btn ${mine?.station === s.id ? 'primary' : ''}`, { 'data-station': s.id, title: `${s.role}: ${s.tool}` });
                  }),
                ),
              )
            : null,
          h('h3', { style: 'margin-top:12px' }, 'Staff'),
          h('div', { class: 'lobby-players', id: 'lobby-players' }, l.players.map(playerCard)),
          custom,
          h(
            'div',
            { class: 'row', style: 'margin-top:14px' },
            button('Change skin', () => go('locker', { back: 'lobby' }), 'btn', { id: 'change-skin' }),
            !isHost ? button(mine?.ready ? 'Not ready' : 'Ready', () => sock.emit('lobby:ready', { ready: !mine?.ready }), `btn ${mine?.ready ? '' : 'primary'}`, { id: 'ready-btn' }) : null,
            isHost
              ? button(
                  'Start shift',
                  async () => {
                    const r = await emitAck<{ error?: { message: string } }>('lobby:start');
                    if (r.error) toast(r.error.message, 'error');
                  },
                  'btn primary',
                  { id: 'start-btn', disabled: !allReady },
                )
              : null,
            button('Leave', async () => {
              await emitAck('lobby:leave');
              store.lobby = null;
              go('play');
            }, 'btn'),
          ),
          l.night === 7 ? h('p', { class: 'dim' }, `"${CUSTOM_NIGHT_NOTE}"`) : null,
        ),
      ),
    );
  };
  render();
  const off = store.on(render);
  return off;
});

function customPanel(l: LobbyState, isHost: boolean, toggle: () => void, open: boolean): HTMLElement {
  const sock = getSocket();
  const ai = { ...l.customAi };
  const send = () => sock.emit('lobby:settings', { customAi: ai });
  const core = (['freddy', 'bonnie', 'chica', 'foxy'] as const).map((id) => {
    const v = h('span', { class: 'v' }, String(ai[id]));
    const r = h('input', { type: 'range', min: '0', max: '20', value: String(ai[id]), disabled: !isHost });
    r.addEventListener('input', () => (v.textContent = r.value));
    r.addEventListener('change', () => {
      ai[id] = Number(r.value);
      send();
    });
    return h('div', { class: 'slider' }, h('div', null, store.roster.name(id), ' ', v), r);
  });
  const ext = { ...l.extended };
  const active = Object.values(ai).filter((x) => x > 0).length + Object.keys(ext).length;
  const extList = ROSTER.filter((r) => r.plugin).map((r) => {
    const on = (ext[r.id] ?? 0) > 0;
    const v = h('span', { class: 'v' }, String(ext[r.id] ?? 0));
    const rng = h('input', { type: 'range', min: '0', max: '20', value: String(ext[r.id] ?? 0), disabled: !isHost });
    rng.addEventListener('input', () => (v.textContent = rng.value));
    rng.addEventListener('change', () => {
      ext[r.id] = Number(rng.value);
      sock.emit('lobby:settings', { extended: ext });
    });
    return h('div', { class: `slider ${on ? '' : 'dim'}`, title: store.roster.fill(r.counter) }, h('div', null, store.roster.name(r.id), ' ', v), rng, h('div', { class: 'dim', style: 'font-size:12px' }, store.roster.fill(r.counter)));
  });
  const puppet = h('input', { type: 'range', min: '0', max: '3', step: '0.1', value: String(l.puppet), disabled: !isHost });
  puppet.addEventListener('change', () => sock.emit('lobby:settings', { puppet: Number(puppet.value) }));
  return h(
    'div',
    { style: 'margin-top:12px;border-top:1px solid #2a2222;padding-top:8px' },
    h('h3', null, `Custom Night (${active}/${CONFIG.extended.MAX_ACTIVE_CUSTOM} active)`),
    h('div', { class: 'sliders' }, core, h('div', { class: 'slider' }, h('div', null, `${store.roster.name('puppet')} unwind %/s `, h('span', { class: 'v' }, String(l.puppet))), puppet)),
    h(
      'div',
      { class: 'row', style: 'margin:8px 0' },
      PRESETS.map((p) =>
        button(
          store.roster.fill(p.name),
          () => {
            if (!isHost) return;
            sock.emit('lobby:settings', { customAi: p.ai, puppet: p.puppet ?? 0, extended: p.extended ?? {} });
          },
          'btn small',
          { title: `Reward: ${p.rewardText}`, disabled: !isHost },
        ),
      ),
    ),
    button(open ? 'Hide extended roster' : 'Show extended roster', toggle, 'btn small'),
    open ? h('div', { class: 'sliders', style: 'margin-top:8px' }, extList) : null,
  );
}
