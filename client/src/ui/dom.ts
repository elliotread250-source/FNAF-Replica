// Tiny DOM helper. Text is always set with textContent, never innerHTML, so user content can't inject markup.
type Child = Node | string | number | null | undefined | false;
type Attrs = Record<string, string | number | boolean | EventListener | null | undefined> & {
  class?: string;
  style?: string;
};

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: (Child | Child[])[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else if (k === 'class') el.className = String(v);
      else if (k === 'style') el.setAttribute('style', String(v));
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el: HTMLElement, children: (Child | Child[])[]): void {
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function clear(el: HTMLElement): HTMLElement {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(el: HTMLElement, ...children: (Child | Child[])[]): HTMLElement {
  clear(el);
  append(el, children);
  return el;
}

export function button(label: string, onClick: () => void, cls = 'menu-btn', attrs: Attrs = {}): HTMLButtonElement {
  return h('button', { class: cls, type: 'button', onclick: () => onClick(), ...attrs }, label);
}

export function toast(text: string, kind: 'info' | 'error' | 'ach' = 'info', ms = 3500): void {
  let wrap = document.getElementById('toasts');
  if (!wrap) {
    wrap = h('div', { id: 'toasts' });
    document.body.appendChild(wrap);
  }
  const t = h('div', { class: `toast toast-${kind}` }, text);
  wrap.appendChild(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 600);
}
