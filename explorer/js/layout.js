// Blocks of the main column: collapsible (click the title) and re-orderable (drag the ⠿ handle, or ↑/↓ on it). Saved in this browser.
const KEY = 'gti-explorer:layout';
const DEFAULT_ORDER = ['tuner', 'fx', 'fretboard', 'notes', 'shapes', 'progression', 'quiz']
const ORDER_VER = 2;   // bump to apply a new default order once to layouts saved earlier;
const DEFAULT_COLLAPSED = ['quiz', 'fx'];

export function initLayout() {
  const main = document.querySelector('main.main'); if (!main) return;
  const blocks = () => [...main.querySelectorAll(':scope > [data-blk]')];
  const byName = n => main.querySelector(`:scope > [data-blk="${n}"]`);
  const foot = main.querySelector(':scope > p.foot') || main.querySelector('.blk-foot');
  let saved = null; try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  const order = saved && saved.v === ORDER_VER && Array.isArray(saved.order) ? saved.order.filter(n => byName(n)) : [];
  // a block that is new to a saved layout goes after the block that precedes it by default, and starts folded if it is folded by default
  const added = [];
  DEFAULT_ORDER.forEach((n, i) => { if (order.includes(n)) return; added.push(n); const prev = DEFAULT_ORDER.slice(0, i).reverse().find(p => order.includes(p)); order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, n); });
  const collapsed = new Set(saved && Array.isArray(saved.collapsed) ? saved.collapsed : DEFAULT_COLLAPSED);
  if (saved && saved.v === ORDER_VER) added.forEach(n => { if (DEFAULT_COLLAPSED.includes(n)) collapsed.add(n); });

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify({ v: ORDER_VER, order: blocks().map(b => b.dataset.blk), collapsed: [...collapsed] })); } catch (e) {} };
  const place = () => order.forEach(n => main.insertBefore(byName(n), foot || null));
  const applyCollapsed = () => blocks().forEach(b => {
    const c = collapsed.has(b.dataset.blk), t = b.querySelector(':scope > .panel-hd .panel-title');
    b.classList.toggle('collapsed', c); if (t) t.setAttribute('aria-expanded', String(!c));
  });
  place(); applyCollapsed();

  // collapse: the title is the button (metrics has no title and stays open)
  blocks().forEach(b => { const t = b.querySelector(':scope > .panel-hd .panel-title'); if (t) { t.setAttribute('role', 'button'); t.tabIndex = 0; t.classList.add('blk-title'); } });
  const toggle = b => { const n = b.dataset.blk; collapsed.has(n) ? collapsed.delete(n) : collapsed.add(n); applyCollapsed(); save(); };
  main.addEventListener('click', e => { const t = e.target.closest('.blk-title'); if (t && !e.target.closest('.blk-grip')) toggle(t.closest('[data-blk]')); });
  main.addEventListener('keydown', e => {
    const t = e.target.closest('.blk-title');
    if (t && e.target === t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(t.closest('[data-blk]')); return; }
    const g = e.target.closest('.blk-grip');
    if (g && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault(); const b = g.closest('[data-blk]'), list = blocks(), i = list.indexOf(b), j = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (j < 0 || j >= list.length) return;
      main.insertBefore(b, e.key === 'ArrowUp' ? list[j] : (list[j].nextElementSibling || foot || null)); g.focus(); b.scrollIntoView({ block: 'nearest' }); save();
    }
  });

  // drag the handle: the block follows the pointer and the others make room (mouse and touch)
  let drag = null, raf = 0;
  const move = y => {
    const others = blocks().filter(b => b !== drag.el);
    const next = others.find(b => { const r = b.getBoundingClientRect(); return y < r.top + r.height / 2; });
    if (next) { if (drag.el.nextElementSibling !== next) main.insertBefore(drag.el, next); }
    else if (drag.el.nextElementSibling !== foot) main.insertBefore(drag.el, foot || null);
  };
  main.addEventListener('pointerdown', e => {
    const g = e.target.closest('.blk-grip'); if (!g || (e.button !== undefined && e.button > 0)) return;
    e.preventDefault(); const el = g.closest('[data-blk]');
    drag = { el, id: e.pointerId, y: e.clientY }; el.classList.add('dragging'); document.body.classList.add('blk-dragging');
    try { g.setPointerCapture(e.pointerId); } catch (err) {}
    const tick = () => { if (!drag) return; const h = window.innerHeight; if (drag.y < 70) window.scrollBy(0, -14); else if (drag.y > h - 70) window.scrollBy(0, 14); move(drag.y); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
  });
  main.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) drag.y = e.clientY; });
  const end = e => { if (!drag || (e && e.pointerId !== drag.id)) return; cancelAnimationFrame(raf); drag.el.classList.remove('dragging'); document.body.classList.remove('blk-dragging'); drag = null; save(); };
  main.addEventListener('pointerup', end); main.addEventListener('pointercancel', end);

  const reset = document.getElementById('blk-reset');
  if (reset) reset.addEventListener('click', () => { order.length = 0; DEFAULT_ORDER.forEach(n => order.push(n)); collapsed.clear(); DEFAULT_COLLAPSED.forEach(n => collapsed.add(n)); place(); applyCollapsed(); save(); });
}
