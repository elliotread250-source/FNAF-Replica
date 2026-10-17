import { h, button, mount, toast } from '../dom';
import { go, register } from '../../app';
import { store } from '../../store';
import { api, ApiError } from '../../api';
import { titleBackdrop } from './title';
import { TurntableView } from '../turntableView';
import { audio } from '../../audio/engine';
import { getSocket } from '../../net/socket';
import { ACHIEVEMENTS_BY_ID, COSMETICS, PRESETS, slotFor, type Cosmetic, type CosmeticCategory } from '@fnaf/shared';

const TABS: [CosmeticCategory | 'shop', string][] = [
  ['guard', 'Uniform'],
  ['accessory', 'Accessory'],
  ['flashlight', 'Flashlight'],
  ['tablet', 'Tablet'],
  ['office', 'Office'],
  ['badge', 'Badge'],
  ['title', 'Title'],
  ['animatronic', 'Animatronics'],
  ['shop', 'Shop'],
];

export function unlockText(c: Cosmetic): string {
  if (c.unlock?.preset) return `Beat the ${store.roster.fill(PRESETS.find((p) => p.id === c.unlock?.preset)?.name ?? c.unlock.preset)} preset`;
  if (c.unlock?.achievement) return `Achievement: ${ACHIEVEMENTS_BY_ID[c.unlock.achievement]?.name ?? c.unlock.achievement}`;
  if (c.price !== null) return `${c.price} ${store.roster.currency()}`;
  return 'Earned by playing';
}

register('locker', (root, params) => {
  titleBackdrop(0.2);
  const back = (params.back as string) ?? 'title';
  if (!store.me) {
    go('login');
    return;
  }
  let tab: CosmeticCategory | 'shop' = 'guard';
  let shop: { rotation: string[]; buyable: string[] } = { rotation: [], buyable: [] };
  const view = new TurntableView();
  const preview = () => {
    if (tab === 'animatronic') return;
    view.tt.showGuard(store.me?.user.equipped ?? {});
  };
  preview();
  api.cosmetics().then((r) => {
    shop = r;
    render();
  }, () => {});

  const equip = async (c: Cosmetic) => {
    try {
      const r = await api.equip(slotFor(c), c.id);
      if (store.me) store.me.user.equipped = r.equipped;
      audio.play('equip');
      for (const a of r.achievements) toast(`Achievement: ${ACHIEVEMENTS_BY_ID[a]?.name ?? a}`, 'ach');
      getSocket().emit('lobby:skin', {});
      if (c.category === 'animatronic' && c.target) view.tt.showCharacter(c.target);
      else preview();
      render();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Lost signal.', 'error');
    }
  };
  const buy = async (c: Cosmetic) => {
    try {
      const r = await api.buy(c.id);
      if (store.me) {
        store.me.user.fazTokens = r.fazTokens;
        store.me.cosmetics = r.cosmetics;
      }
      audio.play('coin');
      toast(`Bought ${c.name}.`);
      for (const a of r.achievements) toast(`Achievement: ${ACHIEVEMENTS_BY_ID[a]?.name ?? a}`, 'ach');
      render();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Lost signal.', 'error');
    }
  };

  const card = (c: Cosmetic) => {
    const owned = store.me?.cosmetics.includes(c.id) ?? false;
    const equipped = store.me?.user.equipped[slotFor(c)] === c.id;
    const canBuy = !owned && c.price !== null && shop.buyable.includes(c.id);
    const colour = (c.params.shirt ?? c.params.color ?? c.params.tint ?? c.params.frame) as string | undefined;
    return h(
      'div',
      {
        class: `item ${equipped ? 'equipped' : ''} ${owned ? '' : 'locked'}`,
        'data-cosmetic': c.id,
        onclick: () => {
          if (owned) void equip(c);
          else if (c.category === 'animatronic' && c.target) view.tt.showCharacter(c.target);
        },
      },
      h('div', { class: 'name' }, colour ? h('span', { class: 'swatch', style: `background:${colour}` }) : null, c.target ? `${store.roster.name(c.target)}: ` : '', c.name),
      h('div', { class: `rar rar-${c.rarity}` }, c.rarity.toUpperCase()),
      h('div', { class: 'dim' }, owned ? (equipped ? 'Equipped' : 'Owned') : `🔒 ${unlockText(c)}`),
      canBuy ? button(`Buy ${c.price}`, () => void buy(c), 'btn small') : null,
    );
  };

  const render = () => {
    const items =
      tab === 'shop'
        ? [...shop.rotation.map((id) => COSMETICS.find((c) => c.id === id)!).filter(Boolean), ...COSMETICS.filter((c) => c.price !== null && c.rarity === 'standard' && !shop.rotation.includes(c.id))]
        : COSMETICS.filter((c) => c.category === tab);
    mount(
      root,
      h(
        'div',
        { class: 'screen center' },
        h(
          'div',
          { class: 'panel', style: 'max-width:1200px' },
          h('div', { class: 'row', style: 'justify-content:space-between' }, h('h2', null, 'Locker Room'), h('div', { class: 'dim' }, `${store.me?.user.fazTokens ?? 0} ${store.roster.currency()}`)),
          h('div', { class: 'tabs' }, TABS.map(([k, n]) => h('button', { class: k === tab ? 'on' : '', onclick: () => ((tab = k), render(), preview()) }, n))),
          h('div', { class: 'split' }, h('div', { class: 'left' }, view.canvas, h('div', { class: 'dim', style: 'font-size:13px' }, 'Drag to rotate. No real money, ever.')), h('div', { class: 'right' }, tab === 'shop' ? h('div', { class: 'dim' }, "Today's rotation first, then the standard catalogue.") : null, h('div', { class: 'grid' }, items.map(card)))),
          h('div', { style: 'margin-top:12px' }, button('Back', () => go(back), 'btn', { id: 'locker-back' })),
        ),
      ),
    );
  };
  render();
  return () => view.dispose();
});
