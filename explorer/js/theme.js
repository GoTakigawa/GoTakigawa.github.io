// Appearance: dark / light / follow the device, and the accent colour. Saved in this browser.
const KEY = 'gti-explorer:theme';
export const ACCENTS = [   // the default, then the rainbow in the same order as the sub colours
  { id: 'purple', name: 'パープル（既定）', c: '#8c4dff' }, { id: 'red', name: 'レッド', c: '#ef4444' }, { id: 'orange', name: 'オレンジ', c: '#f97316' },
  { id: 'yellow', name: 'イエロー', c: '#eab308' }, { id: 'green', name: 'グリーン', c: '#22c55e' }, { id: 'cyan', name: 'シアン', c: '#06b6d4' },
  { id: 'blue', name: 'ブルー', c: '#4d7cff' }, { id: 'pink', name: 'ピンク', c: '#ec4899' }
];
// the first entry of each list is the theme's own default (c = null); the rest are 7 choices
export const SKIES = [
  { name: '既定', c: null, dark: '#f2f2f2', light: '#2b2a27' }, { name: 'レッド', c: '#f87171' }, { name: 'オレンジ', c: '#fb923c' }, { name: 'イエロー', c: '#facc15' },
  { name: 'グリーン', c: '#4ade80' }, { name: 'シアン', c: '#22d3ee' }, { name: 'ブルー', c: '#60a5fa' }, { name: 'パープル', c: '#c084fc' }
];
export const GREENS = [
  { name: '既定', c: null, dark: '#86efac', light: '#1fa55a' }, { name: 'レッド', c: '#fca5a5' }, { name: 'オレンジ', c: '#fdba74' }, { name: 'イエロー', c: '#fde047' },
  { name: 'グリーン', c: '#4ade80' }, { name: 'シアン', c: '#67e8f9' }, { name: 'ブルー', c: '#93c5fd' }, { name: 'パープル', c: '#d8b4fe' }
];
export const BGS_DARK = [
  { name: '既定', c: null, dark: '#000000' }, { name: 'チャコール', c: '#1a1a1a' }, { name: 'スレート', c: '#11161d' }, { name: 'ネイビー', c: '#0b1020' },
  { name: 'フォレスト', c: '#09170f' }, { name: 'ブラウン', c: '#1a120a' }, { name: 'ワイン', c: '#1a0a12' }, { name: 'パープル', c: '#140a1f' }
];
export const BGS_LIGHT = [
  { name: '既定', c: null, light: '#f4f2ee' }, { name: 'ホワイト', c: '#ffffff' }, { name: 'グレー', c: '#ececec' }, { name: 'スカイ', c: '#e8f1f8' },
  { name: 'ミント', c: '#e9f3ec' }, { name: 'クリーム', c: '#f7efe0' }, { name: 'ローズ', c: '#f8e9ee' }, { name: 'ラベンダー', c: '#eeeaf6' }
];
// whole-theme templates: mode, accent, sky (null = default), green (null = default), bg (null = default)
export const TEMPLATES = [
  { name: '既定', mode: 'dark', accent: '#8c4dff', sky: null, green: null, bg: null },
  { name: 'ミッドナイト', mode: 'dark', accent: '#4d7cff', sky: '#60a5fa', green: '#67e8f9', bg: '#0b1020' },
  { name: 'フォレスト', mode: 'dark', accent: '#22c55e', sky: '#fde047', green: '#bef264', bg: '#09170f' },
  { name: 'サンセット', mode: 'dark', accent: '#f97316', sky: '#facc15', green: '#fca5a5', bg: '#1a120a' },
  { name: 'ローズ', mode: 'dark', accent: '#ec4899', sky: '#c084fc', green: '#fda4af', bg: '#1a0a12' },
  { name: 'モノクロ', mode: 'dark', accent: '#d4d4d4', sky: null, green: '#a3a3a3', bg: '#000000' },
  { name: 'ペーパー', mode: 'light', accent: '#4d7cff', sky: null, green: null, bg: null },
  { name: 'サンド', mode: 'light', accent: '#f97316', sky: null, green: '#16a34a', bg: '#f7efe0' },
  { name: 'ミント', mode: 'light', accent: '#22c55e', sky: '#06b6d4', green: null, bg: '#e9f3ec' }
];
const DEFAULT = { mode: 'dark', accent: '#8c4dff', sky: null, green: null, bgDark: null, bgLight: null };
const hex = c => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
const lum = c => { const f = i => { const v = parseInt(c.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5); };
const rgb = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const shade = (c, f) => toHex(rgb(c).map(v => v * f));          // f < 1 darkens
const tint = (c, f) => toHex(rgb(c).map(v => v + (255 - v) * f)); // f > 0 lightens
const onColor = c => { const l = lum(c); return (l + 0.05) / (lum('#0a0a0a') + 0.05) >= 1.05 / (l + 0.05) ? '#0a0a0a' : '#ffffff'; };
export const load = () => { try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o) return { mode: ['dark', 'light', 'auto'].includes(o.mode) ? o.mode : 'dark', accent: hex(o.accent) ? o.accent : DEFAULT.accent, sky: hex(o.sky) ? o.sky : null, green: hex(o.green) ? o.green : null, bgDark: hex(o.bgDark) ? o.bgDark : null, bgLight: hex(o.bgLight) ? o.bgLight : null }; } catch (e) {} return { ...DEFAULT }; };
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
  // background: the surfaces are derived from one base colour (one per mode); unset = the theme's own
  const base = light ? t.bgLight : t.bgDark;
  const SURF = ['--bg', '--bg2', '--bg3', '--bg4', '--border', '--border2', '--fb-bg', '--fb-area', '--fb-inlay', '--fb-fret'];
  if (!base) SURF.forEach(n => r.style.removeProperty(n));
  else {
    const v = light ? [base, tint(base, 0.65), shade(base, 0.975), shade(base, 0.93), shade(base, 0.92), shade(base, 0.84), tint(base, 0.7), shade(base, 0.99), shade(base, 0.89), shade(base, 0.88)]
      : [base, tint(base, 0.04), tint(base, 0.07), tint(base, 0.11), tint(base, 0.12), tint(base, 0.18), tint(base, 0.04), tint(base, 0.08), tint(base, 0.16), tint(base, 0.17)];
    SURF.forEach((n, i) => r.style.setProperty(n, v[i]));
  }
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = base || (light ? '#f4f2ee' : '#000000');
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
    const ad = q('th-acc-def'); if (ad) ad.disabled = t.accent.toLowerCase() === DEFAULT.accent;
    renderBg();
    [['sky', 'th-sky', '--accent2'], ['green', 'th-green', '--accent3']].forEach(([key, id, v]) => {
      const lst = key === 'sky' ? SKIES : GREENS, lightNow = document.documentElement.dataset.theme === 'light';
      document.querySelectorAll('#' + id + '-swatches .th-sw').forEach(b => {
        b.classList.toggle('on', t[key] ? b.dataset.c.toLowerCase() === t[key].toLowerCase() : !b.dataset.c);
        if (!b.dataset.c) b.style.background = lightNow ? lst[0].light : lst[0].dark;
      });
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
    box.innerHTML = list.map(a => `<button type="button" class="th-sw${a.c ? '' : ' def'}" data-k="${key}" data-c="${a.c || ''}" title="${a.name}" aria-label="${a.name}"${a.c ? ` style="background:${a.c}"` : ''}></button>`).join('');
    box.addEventListener('click', e => { const b = e.target.closest('.th-sw'); if (b) { t[key] = b.dataset.c || null; set(); } });
    const inp = q(id + '-custom'); if (inp) inp.addEventListener('input', e => { if (hex(e.target.value)) { t[key] = e.target.value; set(); } });
    const rs2 = q(id + '-def'); if (rs2) rs2.addEventListener('click', () => { t[key] = null; set(); });
  });
  // accent: the first swatch is the default
  const accDef = q('th-acc-def'); if (accDef) accDef.addEventListener('click', () => { t.accent = DEFAULT.accent; set(); });
  const first = sw && sw.querySelector('.th-sw'); if (first) first.classList.add('def');
  // templates
  const tp = q('th-templates');
  if (tp) {
    tp.innerHTML = TEMPLATES.map((x, i) => `<button type="button" class="th-tpl" data-i="${i}" title="${x.name}"><span class="th-dots"><i style="background:${x.accent}"></i><i style="background:${x.sky || (x.mode === 'light' ? '#2b2a27' : '#f2f2f2')}"></i><i style="background:${x.green || (x.mode === 'light' ? '#1fa55a' : '#86efac')}"></i></span>${x.name}</button>`).join('');
    tp.addEventListener('click', e => { const b = e.target.closest('.th-tpl'); if (!b) return; const x = TEMPLATES[+b.dataset.i]; t = { ...DEFAULT, mode: x.mode, accent: x.accent, sky: x.sky, green: x.green }; t[x.mode === 'light' ? 'bgLight' : 'bgDark'] = x.bg; set(); });
  }
  // background (one per mode)
  const bgBox = q('th-bg-swatches');
  const bgList = () => document.documentElement.dataset.theme === 'light' ? BGS_LIGHT : BGS_DARK, bgKey = () => document.documentElement.dataset.theme === 'light' ? 'bgLight' : 'bgDark';
  if (bgBox) bgBox.addEventListener('click', e => { const b = e.target.closest('.th-sw'); if (b) { t[bgKey()] = b.dataset.c || null; set(); } });
  const bgIn = q('th-bg-custom'); if (bgIn) bgIn.addEventListener('input', e => { if (hex(e.target.value)) { t[bgKey()] = e.target.value; set(); } });
  const bgDef = q('th-bg-def'); if (bgDef) bgDef.addEventListener('click', () => { t[bgKey()] = null; set(); });
  const renderBg = () => {
    if (!bgBox) return; const lst = bgList(), cur = t[bgKey()], light = bgKey() === 'bgLight';
    bgBox.innerHTML = lst.map(a => `<button type="button" class="th-sw${a.c ? '' : ' def'}" data-c="${a.c || ''}" title="${a.name}" aria-label="${a.name}" style="background:${a.c || (light ? a.light : a.dark)}"></button>`).join('');
    bgBox.querySelectorAll('.th-sw').forEach(b => b.classList.toggle('on', cur ? b.dataset.c.toLowerCase() === cur.toLowerCase() : !b.dataset.c));
    if (bgIn) bgIn.value = cur || (light ? lst[0].light : lst[0].dark);
    if (bgDef) bgDef.disabled = !cur;
  };
  const rs = q('th-reset'); if (rs) rs.addEventListener('click', () => { t = { ...DEFAULT }; set(); });
  if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: light)'); const h = () => { if (t.mode === 'auto') set(); }; mq.addEventListener ? mq.addEventListener('change', h) : mq.addListener(h); }
  syncUi();
}
