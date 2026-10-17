import { h, button, mount, toast } from '../dom';
import { go, register } from '../../app';
import { store } from '../../store';
import { api, ApiError, type MeResponse } from '../../api';
import { titleBackdrop } from './title';
import { TurntableView } from '../turntableView';
import { ACHIEVEMENTS, COSMETICS_BY_ID } from '@fnaf/shared';

export function achIcon(glyph: string, on: boolean): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('width', '40');
  svg.setAttribute('height', '40');
  svg.setAttribute('viewBox', '0 0 40 40');
  const c = document.createElementNS(ns, 'path');
  c.setAttribute('d', 'M20 2 L36 11 L36 29 L20 38 L4 29 L4 11 Z');
  c.setAttribute('fill', on ? '#2a0a0a' : '#111');
  c.setAttribute('stroke', on ? '#ffd21a' : '#444');
  c.setAttribute('stroke-width', '2');
  svg.appendChild(c);
  const t = document.createElementNS(ns, 'text');
  t.setAttribute('x', '20');
  t.setAttribute('y', '26');
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('font-family', 'VT323, monospace');
  t.setAttribute('font-size', '18');
  t.setAttribute('fill', on ? '#ffd21a' : '#555');
  t.textContent = glyph;
  svg.appendChild(t);
  return svg;
}

register('profile', (root, params) => {
  titleBackdrop(0.2);
  const back = (params.back as string) ?? 'title';
  const username = params.username as string | undefined;
  const view = new TurntableView(280, 340);
  const render = (data: Pick<MeResponse, 'user' | 'stats' | 'achievements' | 'progress'>, own: boolean) => {
    view.tt.showGuard(data.user.equipped ?? {});
    const got = new Set(data.achievements.map((a) => a.id));
    const s = (data.stats ?? {}) as Record<string, number | Record<string, number>>;
    const deathsBy = (s.deaths_by ?? {}) as Record<string, number>;
    const nameIn = h('input', { value: data.user.displayName, maxlength: '20' });
    const pw1 = h('input', { type: 'password', placeholder: 'current' });
    const pw2 = h('input', { type: 'password', placeholder: 'new' });
    const del = h('input', { type: 'password', placeholder: 'password to confirm' });
    mount(
      root,
      h(
        'div',
        { class: 'screen center' },
        h(
          'div',
          { class: 'panel', style: 'max-width:1100px' },
          h('h2', null, 'Personnel File'),
          h(
            'div',
            { class: 'split' },
            h(
              'div',
              { class: 'left', style: 'flex-basis:290px' },
              view.canvas,
              h('h3', null, data.user.displayName, ' ', h('span', { class: 'stars', style: 'font-size:18px' }, '★'.repeat(data.user.stars))),
              h('div', { class: 'dim' }, `@${data.user.username} · member since ${new Date(data.user.createdAt).toLocaleDateString()}`),
              h('div', { class: 'dim' }, COSMETICS_BY_ID[data.user.equipped?.title ?? '']?.name ?? ''),
            ),
            h(
              'div',
              { class: 'right' },
              h(
                'table',
                null,
                [
                  ['Nights played', s.nights_played],
                  ['Nights survived', s.nights_survived],
                  ['Deaths', s.deaths],
                  ['Camera checks', s.camera_checks],
                  ['Doors closed', s.doors_closed],
                  ['Highest night (Night Shift)', data.progress.nightshift?.highestNight ?? 0],
                  ['Highest night (Classic)', data.progress.classic?.highestNight ?? 0],
                  ['Presets beaten', (data.progress.nightshift?.presetsBeaten ?? []).length],
                  ['Most caught by', Object.entries(deathsBy).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${store.roster.name(k)} (${v})`)[0] ?? 'nobody yet'],
                ].map(([k, v]) => h('tr', null, h('td', { class: 'dim' }, String(k)), h('td', null, String(v ?? 0)))),
              ),
              h('h3', { style: 'margin-top:10px' }, `Achievements ${got.size}/${ACHIEVEMENTS.length}`),
              h('div', { class: 'grid', style: 'grid-template-columns:repeat(auto-fill,minmax(230px,1fr))' }, ACHIEVEMENTS.map((a) => h('div', { class: `ach ${got.has(a.id) ? '' : 'off'}` }, achIcon(a.icon, got.has(a.id)), h('div', null, h('div', null, a.name), h('div', { class: 'dim', style: 'font-size:13px' }, a.description))))),
              own
                ? h(
                    'div',
                    { class: 'col', style: 'margin-top:14px' },
                    h('h3', null, 'Account'),
                    store.me?.user.isGuest ? button('Claim this account', () => go('login', { mode: 'claim' }), 'btn primary') : null,
                    h('div', { class: 'row' }, nameIn, button('Change display name', async () => {
                      try {
                        await api.patchMe({ displayName: nameIn.value });
                        await store.refreshMe();
                        toast('Name changed.');
                      } catch (e) {
                        toast(e instanceof ApiError ? e.message : 'Failed', 'error');
                      }
                    }, 'btn small')),
                    !store.me?.user.isGuest
                      ? h('div', { class: 'row' }, pw1, pw2, button('Change password', async () => {
                          try {
                            await api.password(pw1.value, pw2.value);
                            toast('Password changed.');
                          } catch (e) {
                            toast(e instanceof ApiError ? e.message : 'Failed', 'error');
                          }
                        }, 'btn small'))
                      : null,
                    h('div', { class: 'row' }, del, button('Delete account', async () => {
                      if (!confirm('Delete your account and all your progress? This cannot be undone.')) return;
                      try {
                        await api.deleteMe(del.value);
                        store.me = null;
                        go('title');
                      } catch (e) {
                        toast(e instanceof ApiError ? e.message : 'Failed', 'error');
                      }
                    }, 'btn small')),
                  )
                : null,
            ),
          ),
          h('div', { style: 'margin-top:12px' }, button('Back', () => go(back), 'btn')),
        ),
      ),
    );
  };
  if (username && username !== store.me?.user.username) {
    api.profile(username).then((d) => render(d as never, false), () => {
      toast('No guard by that name.', 'error');
      go(back);
    });
  } else if (store.me) {
    void store.refreshMe().then((m) => m && render(m, true));
  } else go('login');
  return () => view.dispose();
});
