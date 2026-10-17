import { h, button, mount, toast } from '../dom';
import { go, register } from '../../app';
import { store } from '../../store';
import { titleBackdrop, ambientMenu } from './title';
import { audio } from '../../audio/engine';
import { ACHIEVEMENTS_BY_ID, COSMETICS_BY_ID } from '@fnaf/shared';
import type { NightEnd } from '../../game/types';

register('paycheck', (root, params) => {
  titleBackdrop(0.2);
  ambientMenu();
  const e = params.end as NightEnd;
  const r = e.rewards;
  const you = e.you;
  // Achievement toasts are queued during the night and shown here, so nothing breaks the dread.
  r.newAchievements.forEach((a, i) =>
    setTimeout(() => {
      audio.play('achievement');
      toast(`Achievement: ${ACHIEVEMENTS_BY_ID[a]?.name ?? a}`, 'ach', 5000);
    }, 600 + i * 900),
  );
  if (r.tokens > 0) audio.play('coin');
  mount(
    root,
    h(
      'div',
      { class: 'screen center' },
      h(
        'div',
        { class: 'panel', style: 'max-width:760px', id: 'paycheck' },
        h('h2', null, e.result === 'win' ? 'Shift complete' : 'Shift failed'),
        h('div', { class: 'code', style: 'font-size:36px;letter-spacing:2px', id: 'pay-tokens' }, `Pay stub: ${r.tokens} ${store.roster.currency()}`),
        h('div', { class: 'dim' }, `Overtime: none. Hazard pay: denied.${r.firstWinBonus ? ` First win of the day: +${r.firstWinBonus}.` : ''} Balance: ${r.balance}.`),
        h(
          'table',
          { style: 'margin-top:12px' },
          h('tr', null, h('th', null, 'Guard'), h('th', null, 'Station'), h('th', null, 'Result'), h('th', null, 'Cams'), h('th', null, 'Doors'), h('th', null, 'Close calls')),
          e.team.map((t) =>
            h(
              'tr',
              null,
              h('td', null, t.name),
              h('td', null, t.role === 'puppeteer' ? 'Puppeteer' : (t.station ?? '')),
              h('td', null, t.role === 'puppeteer' ? (e.result === 'loss' ? 'won' : 'lost') : t.survived ? 'Clocked out' : t.killedBy ? `${store.roster.name(t.killedBy)} at ${t.deathHour === 0 ? 12 : t.deathHour} AM` : 'Ghost'),
              h('td', null, String(t.stats.cameraChecks ?? 0)),
              h('td', null, String(t.stats.doorsClosed ?? 0)),
              h('td', null, String(t.stats.closeCalls ?? 0)),
            ),
          ),
        ),
        you ? h('div', { class: 'dim', style: 'margin-top:8px' }, `Power left: ${e.power}% · Reached ${e.hour === 0 ? 12 : e.hour} AM · Tablet time ${you.stats.tabletSeconds ?? 0}s`) : null,
        r.newAchievements.length ? h('div', { style: 'margin-top:10px' }, h('h3', null, 'Achievements'), r.newAchievements.map((a) => h('div', null, `★ ${ACHIEVEMENTS_BY_ID[a]?.name ?? a}`))) : null,
        r.newCosmetics.length ? h('div', { style: 'margin-top:10px' }, h('h3', null, 'Unlocked'), r.newCosmetics.map((c) => h('div', null, `★ ${COSMETICS_BY_ID[c]?.name ?? c}`))) : null,
        h('div', { class: 'row', style: 'margin-top:14px' }, button(store.lobby ? 'Back to lobby' : 'Back', () => go(store.lobby ? 'lobby' : 'title'), 'btn primary', { id: 'paycheck-continue' })),
      ),
    ),
  );
});
