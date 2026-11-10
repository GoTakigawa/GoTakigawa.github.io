// Appearance: dark / light / follow the device, and the accent colour. Saved in this browser.
const KEY = 'gti-explorer:theme';
export const ACCENTS = [
  { id: 'purple', name: 'パープル', c: '#8c4dff' }, { id: 'blue', name: 'ブルー', c: '#4d7cff' }, { id: 'teal', name: 'ティール', c: '#14b8a6' },
  { id: 'green', name: 'グリーン', c: '#22c55e' }, { id: 'amber', name: 'アンバー', c: '#f59e0b' }, { id: 'orange', name: 'オレンジ', c: '#f97316' },
  { id: 'red', name: 'レッド', c: '#ef4444' }, { id: 'pink', name: 'ピンク', c: '#ec4899' }
];
export const SKIES = [
  { name: 'スカイ', c: '#38bdf8' }, { name: 'ブルー', c: '#60a5fa' }, { name: 'シアン', c: '#22d3ee' },
  { name: 'ラベンダー', c: '#a78bfa' }, { name: 'ピンク', c: '#f472b6' }, { name: 'イエロー', c: '#fbbf24' }
];
export const GREENS = [
  { name: 'ミント', c: '#86efac' }, { name: 'グリーン', c: '#4ade80' }, { name: 'ライム', c: '#bef264' },
  { name: 'ターコイズ', c: '#5eead4' }, { name: 'イエロー', c: '#fde047' }, { name: 'ローズ', c: '#fda4af' }
];
const DEFAULT = { mode: 'dark', accent: '#8c4dff', sky: null, green: null };
const hex = c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
const lum = c => { const f = i => { const v = parseInt(c.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5); };
const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const shade = (c, f) => toHex(rgb(c).map(v => v * f));          // f < 1 darkens
const tint = (c, f) => toHex(rgb(c).map(v => v + (255 - v) * f)); // f > 0 lightens
const onColor = c => { const l = lum(c); return (l + 0.05) / (lum('#0a0a0a') + 0.05) >= 1.05 / (l + 0.05) ? '#0a0a0a' : '#ffffff'; };
export const load = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) return { mode: ['dark', 'light', 'auto'].includes(o.mode) ? o.mode : 'dark', accent: hex(o.accent) ? o.accent : DEFAULT.accent, sky: hex(o.sky) ? o.sky : null, green: hex(o.green) ? o.green : null }; } catch (e) {} return { ...DEFAULT }; };
export function apply(t) {
  const light = t.mode === 'light' || (t.mode === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches);
  const r = document.documentElement;
  r.dataset.theme = light ? 'light' : 'dark';
  r.style.setProperty('--accent1', t.accent);
  // text on the accent: dark or white, whichever reads better
  const l = lum(t.accent), cDark = (l + 0.05) / (lum('#1a1a1a') + 0.05), cWhite = 1.05 / (l + 0.05);
  r.style.setProperty('--on-accent', cDark >= cWhite ? '#1a1a1a' : '#ffffff');
  // the two sub colours (blue-ish: headings, frames, chord tones / green-ish: roots, "ok" states); unset = the theme's own default
  const sub = (key, name, text, on) => {
    if (!t[key]) { [name, text, on].forEach(n => n && r.style.removeProperty(n)); return; }
    const c = light ? shade(t[key], 0.78) : t[key];
    r.style.setProperty(name, c);
    if (text) r.style.setProperty(text, light ? shade(t[key], 0.6) : tint(t[key], 0.35));
    r.style.setProperty(on, onColor(c));
  };
  sub('sky', '--accent2', '--accent2-text', '--on-sky'); sub('green', '--accent3', null, '--on-green');
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
    [['sky', 'th-sky', '--accent2'], ['green', 'th-green', '--accent3']].forEach(([key, id, v]) => {
      document.querySelectorAll('#' + id + '-swatches .th-sw').forEach(b => b.classList.toggle('on', !!t[key] && b.dataset.c.toLowerCase() === t[key].toLowerCase()));
      const inp = q(id + '-custom'); if (inp) { const cur = t[key] || (getComputedStyle(document.documentElement).getPropertyValue(v).trim()); if (hex(cur)) inp.value = cur; }
      const d = q(id + '-def'); if (d) d.disabled = !t[key];
    });
  };
  const set = () => { apply(t); save(); syncUi(); onChange && onChange(); };
  const sw = q('th-swatches');
  if (sw) sw.innerHTML = ACCENTS.map(a => `<button type="button" class="th-sw" data-c="${a.c}" title="${a.name}" aria-label="${a.name}" style="background:${a.c}"></button>`).join('');
  document.querySelectorAll('.th-mode').forEach(b => b.addEventListener('click', () => { t.mode = b.dataset.m; set(); }));
  if (sw) sw.addEventListener('click', e => { const b = e.target.closest('.th-sw'); if (b) { t.accent = b.dataset.c; set(); } });
  const ci = q('th-custom'); if (ci) ci.addEventListener('input', e => { if (hex(e.target.value)) { t.accent = e.target.value; set(); } });
  // sky / green: swatches, a free picker and "default"
  [['sky', SKIES, 'th-sky'], ['green', GREENS, 'th-green']].forEach(([key, list, id]) => {
    const box = q(id + '-swatches'); if (!box) return;
    box.innerHTML = list.map(a => `<button type="button" class="th-sw" data-k="${key}" data-c="${a.c}" title="${a.name}" aria-label="${a.name}" style="background:${a.c}"></button>`).join('');
    box.addEventListener('click', e => { const b = e.target.closest('.th-sw'); if (b) { t[key] = b.dataset.c; set(); } });
    const inp = q(id + '-custom'); if (inp) inp.addEventListener('input', e => { if (hex(e.target.value)) { t[key] = e.target.value; set(); } });
    const rs2 = q(id + '-def'); if (rs2) rs2.addEventListener('click', () => { t[key] = null; set(); });
  });
  const rs = q('th-reset'); if (rs) rs.addEventListener('click', () => { t = { ...DEFAULT }; set(); });
  if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: light)'); const h = () => { if (t.mode === 'auto') set(); }; mq.addEventListener ? mq.addEventListener('change', h) : mq.addListener(h); }
  syncUi();
}
