export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...children: (Node | string | null | undefined | false)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(c));
  return el;
}

export function svgUrl(svg: string) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Create a modal with background; returns {bg, body, open, close}. */
export function makeModal(id: string, title: string | null, onClose?: () => void) {
  const body = h('div');
  const x = h('button', { class: 'btn red x', title: 'Close (Esc)' }, '✕');
  const modal = h('div', { class: 'modal' }, x, title ? h('h2', {}, title) : null, body);
  const bg = h('div', { class: 'modal-bg', id });
  bg.append(modal);
  const api = {
    bg, body, modal, x,
    isOpen: () => bg.classList.contains('open'),
    open() { bg.classList.add('open'); },
    close() { if (!bg.classList.contains('open')) return; bg.classList.remove('open'); onClose?.(); },
  };
  x.addEventListener('click', () => api.close());
  bg.addEventListener('mousedown', (e) => { if (e.target === bg) api.close(); });
  return api;
}
export type Modal = ReturnType<typeof makeModal>;
