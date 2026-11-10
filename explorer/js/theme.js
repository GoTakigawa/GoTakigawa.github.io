// Appearance: dark / light / follow the device, and the accent colour. Saved in this browser.
const KEY = 'gti-explorer:theme';
export const ACCENTS = [
  { id: 'purple', name: 'パープル', c: '#8c4dff' }, { id: 'blue', name: 'ブルー', c: '#4d7cff' }, { id: 'teal', name: 'ティール', c: '#14b8a6' },
  { id: 'green', name: 'グリーン', c: '#22c55e' }, { id: 'amber', name: 'アンバー', c: '#f59e0b' }, { id: 'orange', name: 'オレンジ', c: '#f97316' },
  { id: 'red', name: 'レッド', c: '#ef4444' }, { id: 'pink', name: 'ピンク', c: '#ec4899' }
];
const DEFAULT = { mode: 'dark', accent: '#8c4dff' };
const hex = c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
const lum = c => { const f = i => { const v = parseInt(c.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5); };
export const load = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) return { mode: ['dark', 'light', 'auto'].includes(o.mode) ? o.mode : 'dark', accent: hex(o.accent) ? o.accent : DEFAULT.accent }; } catch (e) {} return { ...DEFAULT }; };
export function apply(t) {
  const light = t.mode === 'light' || (t.mode === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
  const r = document.documentElement;
  r.dataset.theme = light ? 'light' : 'dark';
  r.style.setProperty('--accent1', t.accent);
  // text on the accent: dark or white, whichever reads better
  const l = lum(t.accent), cDark = (l + 0.05) / (lum('#1a1a1a') + 0.05), cWhite = 1.05 / (l + 0.05);
  r.style.setProperty('--on-accent', cDark >= cWhite ? '#1a1a1a' : '#ffffff');
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = light ? '#f4f2ee' : '#000000';
}
export const themeColors = () => load();

export function initTheme(onChange) {
  let t = load(); apply(t);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(t)); } catch (e) {} };
  const q = id => document.getElementById(id);
  const syncUi = () => {
    document.querySelectorAll('.th-mode').forEach(b => b.classList.toggle('on', b.dataset.m === t.mode));
    document.querySelectorAll('.th-sw').forEach(b => b.classList.toggle('on', b.dataset.c.toLowerCase() === t.accent.toLowerCase()));
    const ci = q('th-custom'); if (ci) ci.value = t.accent;
  };
  const set = () => { apply(t); save(); syncUi(); onChange && onChange(); };
  const sw = q('th-swatches');
  if (sw) sw.innerHTML = ACCENTS.map(a => `<button type="button" class="th-sw" data-c="${a.c}" title="${a.name}" aria-label="${a.name}" style="background:${a.c}"></button>`).join('');
  document.querySelectorAll('.th-mode').forEach(b => b.addEventListener('click', () => { t.mode = b.dataset.m; set(); }));
  if (sw) sw.addEventListener('click', e => { const b = e.target.closest('.th-sw'); if (b) { t.accent = b.dataset.c; set(); } });
  const ci = q('th-custom'); if (ci) ci.addEventListener('input', e => { if (hex(e.target.value)) { t.accent = e.target.value; set(); } });
  const rs = q('th-reset'); if (rs) rs.addEventListener('click', () => { t = { ...DEFAULT }; set(); });
  if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: light)'); const h = () => { if (t.mode === 'auto') set(); }; mq.addEventListener ? mq.addEventListener('change', h) : mq.addListener(h); }
  syncUi();
}
