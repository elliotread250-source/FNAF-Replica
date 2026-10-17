import { h, button, mount, toast } from '../dom';
import { go, register } from '../../app';
import { store } from '../../store';
import { api, ApiError } from '../../api';
import { titleBackdrop, disclaimer } from './title';
import { resetSocket } from '../../net/socket';

function field(label: string, type = 'text', attrs: Record<string, string> = {}): [HTMLElement, HTMLInputElement] {
  const input = h('input', { type, autocomplete: type === 'password' ? 'current-password' : 'off', ...attrs });
  return [h('div', null, h('label', null, label), input), input];
}

async function afterAuth(): Promise<void> {
  resetSocket();
  await store.refreshMe();
  go('title');
}

register('login', (root, params) => {
  titleBackdrop(0.4);
  let mode: 'login' | 'signup' | 'forgot' | 'reset' | 'claim' = (params.mode as 'login') ?? 'login';
  const resetToken = new URLSearchParams(location.search).get('reset');
  if (resetToken) mode = 'reset';
  const render = () => {
    const err = h('div', { class: 'err' });
    const [uRow, u] = field('Username', 'text', { maxlength: '16', name: 'username' });
    const [pRow, p] = field('Password', 'password', { name: 'password' });
    const [eRow, e] = field('Email (optional, for password resets)', 'email');
    const fail = (x: unknown) => (err.textContent = x instanceof ApiError ? x.message : 'Lost signal. Try again.');
    const submit = async () => {
      err.textContent = '';
      try {
        if (mode === 'login') await api.login(u.value.trim(), p.value);
        else if (mode === 'signup') await api.signup(u.value.trim(), p.value, e.value.trim() || undefined);
        else if (mode === 'claim') await api.claim(u.value.trim(), p.value, e.value.trim() || undefined);
        else if (mode === 'forgot') {
          await api.forgot(e.value.trim());
          toast('If that email is on file, a reset link is on its way.');
          return;
        } else if (mode === 'reset') {
          await api.reset(resetToken ?? '', p.value);
          history.replaceState(null, '', '/');
          toast('Password changed. Clock in.');
          mode = 'login';
          render();
          return;
        }
        await afterAuth();
      } catch (x) {
        fail(x);
      }
    };
    const guest = async () => {
      try {
        await api.guest();
        await afterAuth();
      } catch (x) {
        fail(x);
      }
    };
    if (params.guest && mode === 'login') {
      params.guest = false;
      void guest();
    }
    const titleText = { login: 'Clock In', signup: 'New Hire Paperwork', forgot: 'Forgot Password', reset: 'Reset Password', claim: 'Claim This Account' }[mode];
    const form = h(
      'form',
      { class: 'col', onsubmit: (ev: Event) => (ev.preventDefault(), void submit()) },
      mode !== 'forgot' && mode !== 'reset' ? uRow : null,
      mode !== 'forgot' ? pRow : null,
      mode === 'signup' || mode === 'claim' || mode === 'forgot' ? eRow : null,
      err,
      h('button', { class: 'btn primary', type: 'submit', id: 'auth-submit' }, titleText),
    );
    mount(
      root,
      h(
        'div',
        { class: 'screen center' },
        h(
          'div',
          { class: 'panel', style: 'max-width:440px' },
          h('h2', null, titleText),
          form,
          h(
            'div',
            { class: 'col', style: 'margin-top:14px' },
            mode === 'login' ? button('New here? Sign up', () => ((mode = 'signup'), render()), 'btn small', { id: 'to-signup' }) : null,
            mode === 'signup' ? button('Have an account? Log in', () => ((mode = 'login'), render()), 'btn small') : null,
            mode === 'login' || mode === 'signup' ? button('Play as Guest', () => void guest(), 'btn small', { id: 'guest' }) : null,
            mode === 'login'
              ? button(
                  'Forgot password?',
                  () => {
                    if (!store.config.smtp) {
                      err.textContent = "Password reset isn't set up on this server yet.";
                      return;
                    }
                    mode = 'forgot';
                    render();
                  },
                  'btn small',
                )
              : null,
            button('Back', () => go('title'), 'btn small'),
          ),
        ),
      ),
      disclaimer(),
    );
    (mode === 'forgot' ? e : mode === 'reset' ? p : u).focus();
  };
  render();
});
