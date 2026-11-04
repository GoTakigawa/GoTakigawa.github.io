import { pc, SCALES, CHORDS, ROOT_LABELS, makeSet, parseInterval, diatonic, romanOf, chordSymbol } from './theory.js';
import { TUNINGS, STRING_COUNTS, findTuning, midiLabel } from './tunings.js';
import { npsPattern, findVoicings } from './positions.js';
import { PianoEngine } from './audio.js';
import { encodeSeed, decodeSeed } from './share.js';

const $ = id => document.getElementById(id);
const STORE = 'gti-explorer:state';
const audio = new PianoEngine();

const DEFAULT = {
  v: 1, strings: 6, tuning: 'e-std', custom: [40,45,50,55,59,64], frets: 24, lefty: false,
  mode: 'scale', root: 9, scale: 'minorPent', chord: 'm7', notes: [0, 4, 7],
  emph: [0], diat: -1, seventh: false,
  range: 'all', from: 5, to: 8, pattern: 0, ghost: true,
  strOn: [], label: 'name',
  vo: { span: 4, minStrings: 3, rootBass: false, allowOpen: true, omit5: false }
};
let st = structuredClone(DEFAULT);
let voicings = [], vsel = -1, statusTimer = null;

// ── state ──
function sanitize(s) {
  const d = structuredClone(DEFAULT);
  d.strOn = Array(d.strings).fill(true);
  if (!s || typeof s !== 'object') return d;
  const int = (v, lo, hi, def) => Number.isInteger(v) && v >= lo && v <= hi ? v : def;
  d.strings = STRING_COUNTS.includes(s.strings) ? s.strings : d.strings;
  d.tuning = s.tuning === 'custom' || findTuning(d.strings, s.tuning) ? s.tuning : TUNINGS[d.strings][0].id;
  d.custom = Array.isArray(s.custom) && s.custom.length === d.strings && s.custom.every(m => Number.isInteger(m) && m >= 16 && m <= 80) ? s.custom : TUNINGS[d.strings][0].notes.slice();
  d.frets = [21, 22, 24, 27].includes(s.frets) ? s.frets : 24;
  d.lefty = !!s.lefty;
  d.mode = ['scale', 'chord', 'notes'].includes(s.mode) ? s.mode : 'scale';
  d.root = int(s.root, 0, 11, d.root);
  d.scale = SCALES[s.scale] ? s.scale : d.scale;
  d.chord = CHORDS[s.chord] ? s.chord : d.chord;
  d.notes = Array.isArray(s.notes) ? [...new Set(s.notes.filter(n => Number.isInteger(n) && n >= 0 && n < 12))] : d.notes;
  d.emph = Array.isArray(s.emph) ? s.emph.filter(n => Number.isInteger(n) && n >= 0 && n < 12) : d.emph;
  d.diat = int(s.diat, -1, 6, -1); d.seventh = !!s.seventh;
  d.range = ['all', 'frets', 'pattern'].includes(s.range) ? s.range : 'all';
  d.from = int(s.from, 0, 27, 5); d.to = int(s.to, 0, 27, 8); d.pattern = int(s.pattern, 0, 7, 0);
  d.ghost = s.ghost !== false;
  d.strOn = Array.isArray(s.strOn) && s.strOn.length === d.strings ? s.strOn.map(Boolean) : Array(d.strings).fill(true);
  d.label = ['name', 'interval', 'degree', 'none'].includes(s.label) ? s.label : 'name';
  if (s.vo && typeof s.vo === 'object') {
    d.vo.span = int(s.vo.span, 3, 6, 4); d.vo.minStrings = int(s.vo.minStrings, 2, 8, 3);
    ['rootBass', 'allowOpen', 'omit5'].forEach(k => { if (k in s.vo) d.vo[k] = !!s.vo[k]; });
  }
  return d;
}
const tuning = () => st.tuning === 'custom' ? st.custom : (findTuning(st.strings, st.tuning) || TUNINGS[st.strings][0]).notes;
function save() { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) {} }
function update(fn, keepVoicing) { fn(); if (!keepVoicing) { vsel = -1; voicings = []; } save(); render(); }
function notify(msg) {
  const el = $('status'); el.textContent = msg; el.classList.add('visible');
  clearTimeout(statusTimer); statusTimer = setTimeout(() => el.classList.remove('visible'), 2600);
}

// The set currently shown: scale / chord / free notes
function currentSet() {
  if (st.mode === 'scale') return makeSet(st.root, SCALES[st.scale].iv);
  if (st.mode === 'chord') return makeSet(st.root, CHORDS[st.chord].iv);
  // free notes: name them relative to C major-ish spelling, intervals from the first chosen note
  if (!st.notes.length) return makeSet(st.root, []);
  const notes = st.notes, r = notes[0];
  const ivNames = notes.map(p => ['1','b2','2','b3','3','4','b5','5','b6','6','b7','7'][pc(p - r)]);
  return makeSet(r, ivNames);
}
const scaleLen = () => SCALES[st.scale].iv.length;
const patternNps = () => ({ 5: 2, 7: 3, 8: 3 })[scaleLen()] || 0;

// Which pitch classes get the filled (purple) emphasis
function emphasisPcs(set) {
  if (st.mode === 'chord' || st.mode === 'notes') return set.pcs;
  if (st.diat >= 0 && scaleLen() === 7) return diatonic(st.root, SCALES[st.scale].iv, st.diat, st.seventh).pcs;
  return st.emph.map(i => set.ivs[i]).filter(Boolean).map(iv => pc(st.root + iv.semis));
}

// Cells (string:fret) allowed by range / pattern / voicing / strings
function visibility(set) {
  const tun = tuning(), F = st.frets;
  let allow = null; // null = everything
  if (st.mode === 'chord' && vsel >= 0 && voicings[vsel]) {
    allow = new Set(); voicings[vsel].frets.forEach((f, s) => { if (f !== null) allow.add(s + ':' + f); });
  } else if (st.mode === 'scale' && st.range === 'pattern' && patternNps()) {
    allow = npsPattern(tun, st.root, set.ivs.map(i => i.semis), st.pattern % scaleLen(), patternNps(), F);
  }
  return (s, f) => {
    if (!st.strOn[s]) return false;
    if (allow) return allow.has(s + ':' + f);
    if (st.range === 'frets') { const lo = Math.min(st.from, st.to), hi = Math.max(st.from, st.to); return f >= lo && f <= hi; }
    return true;
  };
}

// ── audio ──
async function playNotes(list, gap = 0.16, dur = 0.5) {
  await audio.ready(); const t = audio.now + 0.03;
  list.forEach((m, i) => audio.play([m], t + i * gap, dur, 0.9));
}

// ── render ──
function renderControls() {
  $('strings').value = st.strings;
  $('tuning').innerHTML = TUNINGS[st.strings].map(t => `<option value="${t.id}">${t.name}</option>`).join('') + '<option value="custom">カスタム</option>';
  $('tuning').value = st.tuning;
  $('custom-tuning').hidden = st.tuning !== 'custom';
  if (st.tuning === 'custom') {
    const opts = m => { let h = ''; for (let n = 16; n <= 80; n++) h += `<option value="${n}" ${n === m ? 'selected' : ''}>${midiLabel(n)}</option>`; return h; };
    $('custom-tuning').innerHTML = st.custom.map((m, i) => `<label class="ct-cell"><span>${i + 1}弦</span><select data-s="${i}" aria-label="${st.strings - i}弦">${opts(m)}</select></label>`).reverse().join('');
    // label strings by guitar numbering (1 = highest)
    [...$('custom-tuning').querySelectorAll('.ct-cell span')].forEach((el, k) => el.textContent = (k + 1) + '弦');
  }
  $('frets').value = st.frets; $('lefty').checked = st.lefty;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('on', b.dataset.mode === st.mode));
  $('root').value = st.root;
  $('scale-box').hidden = st.mode !== 'scale'; $('chord-box').hidden = st.mode !== 'chord'; $('notes-box').hidden = st.mode !== 'notes';
  $('root-box').hidden = st.mode === 'notes';
  $('scale').value = st.scale; $('chord').value = st.chord;
  $('note-picks').innerHTML = ROOT_LABELS.map((n, i) => `<button class="pick ${st.notes.includes(i) ? 'on' : ''}" data-p="${i}">${n.split(' / ')[0]}</button>`).join('');
  // range
  document.querySelectorAll('.range-btn').forEach(b => b.classList.toggle('on', b.dataset.range === st.range));
  const patOk = st.mode === 'scale' && !!patternNps();
  document.querySelector('.range-btn[data-range="pattern"]').disabled = !patOk;
  if (st.range === 'pattern' && !patOk) st.range = 'all';
  $('range-frets').hidden = st.range !== 'frets'; $('range-pattern').hidden = st.range !== 'pattern';
  $('from').value = st.from; $('to').value = st.to;
  if (patOk) {
    const n = scaleLen(), set = currentSet();
    $('pattern').innerHTML = Array.from({ length: n }, (_, i) => `<option value="${i}" ${i === st.pattern % n ? 'selected' : ''}>パターン ${i + 1}（${set.name(st.root + set.ivs[i].semis)} から）</option>`).join('');
    $('pattern-hint').textContent = `${patternNps()}音ずつ弦を上がっていく${patternNps() === 3 ? '3NPS' : 'ボックス'}型です。最低弦の開始音で切り替えます。`;
  }
  $('ghost').checked = st.ghost;
  $('strings-on').innerHTML = tuning().map((m, s) => ({ m, s })).reverse().map(({ m, s }, k) => `<button class="pick ${st.strOn[s] ? 'on' : ''}" data-s="${s}" title="${midiLabel(m)}">${k + 1}弦<small>${currentSet().name(m)}</small></button>`).join('');
  document.querySelectorAll('.label-btn').forEach(b => b.classList.toggle('on', b.dataset.label === st.label));
}

function renderSetInfo(set) {
  const emph = emphasisPcs(set);
  // interval chips in definition order
  $('iv-chips').innerHTML = set.ivs.map((iv, i) => {
    const p = pc(set.root + iv.semis), on = emph.includes(p);
    return `<button class="iv-chip ${on ? 'on' : ''} ${i === 0 ? 'root' : ''}" data-i="${i}" ${st.mode !== 'scale' || st.diat >= 0 ? 'data-ro="1"' : ''}><b>${set.name(p)}</b><small>${iv.label}</small></button>`;
  }).join('');
  $('iv-hint').textContent = st.mode === 'scale'
    ? (st.diat >= 0 ? 'ダイアトニックコードを重ねています。解除すると、音を押して強調を自由に選べます。' : '音を押すと、その音を紫で強調します（もう一度押すと解除）。')
    : st.mode === 'chord' ? 'コードの構成音です。押すと鳴ります。' : '選んだ音です。最初に選んだ音を基準に音程を表示します。';
  $('emph-tools').hidden = st.mode !== 'scale';
  // diatonic chords
  const diaOk = st.mode === 'scale' && scaleLen() === 7;
  $('diat-box').hidden = !diaOk;
  if (diaOk) {
    $('diat').innerHTML = Array.from({ length: 7 }, (_, d) => {
      const c = diatonic(st.root, SCALES[st.scale].iv, d, st.seventh);
      return `<button class="deg-btn ${d === st.diat ? 'on' : ''}" data-d="${d}"><b>${romanOf(SCALES[st.scale].iv, d)}</b><small>${set.name(c.root)}${chordNameFor(c.semis)}</small></button>`;
    }).join('');
    $('seventh').checked = st.seventh;
  }
}
// Find a chord symbol for a list of semitone offsets
function chordNameFor(semis) {
  const key = semis.map(pc).sort((a, b) => a - b).join(',');
  for (const [id, c] of Object.entries(CHORDS)) {
    const k = c.iv.map(n => pc(parseInterval(n).semis)).sort((a, b) => a - b).join(',');
    if (k === key) return chordSymbol(id);
  }
  return '';
}

function titleFor(set) {
  if (st.mode === 'scale') {
    let t = `${set.name(st.root)} ${SCALES[st.scale].name}`;
    if (st.diat >= 0 && scaleLen() === 7) { const c = diatonic(st.root, SCALES[st.scale].iv, st.diat, st.seventh); t += ` ／ ${romanOf(SCALES[st.scale].iv, st.diat)}（${set.name(c.root)}${chordNameFor(c.semis)}）`; }
    return t;
  }
  if (st.mode === 'chord') return set.name(st.root) + chordSymbol(st.chord);
  return st.notes.length ? st.notes.map(p => set.name(p)).join(' · ') : '音を選んでください';
}

function renderFretboard() {
  const set = currentSet(), tun = tuning(), n = tun.length, F = st.frets;
  const emph = emphasisPcs(set), vis = visibility(set);
  const W = 1180, padL = 40, padR = 14, top = 22, gap = 28, H = top * 2 + gap * (n - 1);
  const len = (W - padL - padR) / (1 - Math.pow(2, -F / 12));
  const raw = f => padL + len * (1 - Math.pow(2, -f / 12));
  const X = x => st.lefty ? W - x : x;
  const fx = f => X(raw(f));
  const cx = f => f === 0 ? X(padL - 13) : X((raw(f) + raw(f - 1)) / 2);
  const midY = top + gap * (n - 1) / 2;
  let svg = `<svg viewBox="0 0 ${W} ${H + 18}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleFor(set)} の指板">`;
  svg += `<rect width="${W}" height="${H + 18}" fill="#0a0a0a"/>`;
  svg += `<rect x="${Math.min(X(padL), X(W - padR))}" y="${top - 10}" width="${W - padL - padR}" height="${gap * (n - 1) + 20}" fill="#121212"/>`;
  // fret range shading
  if (st.range === 'frets' && !(st.mode === 'chord' && vsel >= 0)) {
    const lo = Math.min(st.from, st.to), hi = Math.max(st.from, st.to);
    const x0 = lo === 0 ? raw(0) - 26 : raw(lo - 1), x1 = raw(hi);
    svg += `<rect x="${Math.min(X(x0), X(x1))}" y="${top - 10}" width="${Math.abs(X(x1) - X(x0))}" height="${gap * (n - 1) + 20}" fill="rgba(140,77,255,.10)"/>`;
  }
  [3, 5, 7, 9, 15, 17, 19, 21, 27].filter(f => f <= F).forEach(f => svg += `<circle cx="${cx(f)}" cy="${midY}" r="4" fill="#262626"/>`);
  [12, 24].filter(f => f <= F).forEach(f => svg += `<circle cx="${cx(f)}" cy="${midY - gap}" r="4" fill="#262626"/><circle cx="${cx(f)}" cy="${midY + gap}" r="4" fill="#262626"/>`);
  for (let f = 0; f <= F; f++) svg += `<line x1="${fx(f)}" y1="${top - 10}" x2="${fx(f)}" y2="${top + gap * (n - 1) + 10}" stroke="${f === 0 ? '#9a9a9a' : '#2c2c2c'}" stroke-width="${f === 0 ? 4 : 1.2}"/>`;
  for (let f = 1; f <= F; f++) if ([1, 3, 5, 7, 9, 12, 15, 17, 19, 21, 24, 27].includes(f)) svg += `<text x="${cx(f)}" y="${H + 12}" fill="#666" font-size="10" text-anchor="middle" font-family="Barlow">${f}</text>`;
  let dots = '', hits = '', count = 0;
  for (let i = 0; i < n; i++) {
    const s = n - 1 - i, y = top + gap * i, open = tun[s], on = st.strOn[s];
    svg += `<line x1="${fx(0)}" y1="${y}" x2="${X(W - padR)}" y2="${y}" stroke="${on ? '#5a5a5a' : '#262626'}" stroke-width="${0.7 + s * 0.25}"/>`;
    svg += `<text x="${X(padL - 30)}" y="${y + 3.5}" fill="${on ? '#9a9a9a' : '#3a3a3a'}" font-size="11" text-anchor="middle" font-family="Barlow" font-weight="600">${set.name(open)}</text>`;
    for (let f = 0; f <= F; f++) {
      const m = open + f, p = pc(m), x = cx(f);
      hits += `<rect class="fb-hit" data-m="${m}" x="${Math.min(f === 0 ? X(padL - 26) : fx(f - 1), f === 0 ? X(padL) : fx(f))}" y="${y - gap / 2}" width="${Math.abs((f === 0 ? 26 : raw(f) - raw(f - 1)))}" height="${gap}"><title>${set.note(m)}</title></rect>`;
      if (!set.has(p)) continue;
      const visible = vis(s, f);
      if (!visible && !(st.ghost && on)) continue;
      if (visible) count++;
      const isRoot = st.mode !== 'notes' && p === pc(st.root), isEm = emph.includes(p);
      const op = visible ? 1 : 0.16;
      const lbl = st.label === 'none' ? '' : st.label === 'interval' ? set.intervalOf(p) : st.label === 'degree' ? String(set.info(p).index + 1) : set.name(p);
      if (isRoot) dots += `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="10.5" fill="#86efac"/><text x="${x}" y="${y + 3.6}" fill="#0a0a0a" font-size="${lbl.length > 2 ? 8 : 10}" font-weight="700" text-anchor="middle" font-family="Barlow">${lbl}</text></g>`;
      else if (isEm) dots += `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="10.5" fill="#8c4dff"/><text x="${x}" y="${y + 3.6}" fill="#0a0a0a" font-size="${lbl.length > 2 ? 8 : 10}" font-weight="700" text-anchor="middle" font-family="Barlow">${lbl}</text></g>`;
      else dots += `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="10" fill="#000" stroke="#38bdf8" stroke-width="1.6"/><text x="${x}" y="${y + 3.4}" fill="#9fdcf9" font-size="${lbl.length > 2 ? 7.5 : 9}" font-weight="600" text-anchor="middle" font-family="Barlow">${lbl}</text></g>`;
    }
  }
  // muted strings of the selected voicing
  if (st.mode === 'chord' && vsel >= 0 && voicings[vsel]) voicings[vsel].frets.forEach((f, s) => { if (f === null) { const y = top + gap * (n - 1 - s); dots += `<text x="${X(padL - 13)}" y="${y + 4}" fill="#f87171" font-size="12" text-anchor="middle" font-family="Barlow" font-weight="700">×</text>`; } });
  svg += dots + hits + '</svg>';
  $('fretboard').innerHTML = svg;
  $('fb-title').textContent = titleFor(set);
  return count;
}

function renderMetrics(set, count) {
  const tun = tuning();
  $('m-target').textContent = titleFor(set);
  $('m-notes').textContent = set.ivs.map(iv => set.name(set.root + iv.semis)).join(' ');
  $('m-tuning').textContent = (st.tuning === 'custom' ? 'カスタム' : (findTuning(st.strings, st.tuning) || {}).name) + ` · ${st.strings}弦`;
  $('m-open').textContent = tun.slice().reverse().map(m => set.name(m)).join(' ');
  const lo = Math.min(st.from, st.to), hi = Math.max(st.from, st.to);
  $('m-range').textContent = st.mode === 'chord' && vsel >= 0 ? `ボイシング ${vsel + 1}` : st.range === 'frets' ? `${lo}〜${hi}フレット` : st.range === 'pattern' ? `パターン ${st.pattern % scaleLen() + 1}` : `0〜${st.frets}フレット`;
  $('m-count').innerHTML = `${count}<span class="metric-unit">か所</span>`;
}

function renderVoicings(set) {
  $('voicing-panel').hidden = st.mode !== 'chord';
  if (st.mode !== 'chord') return;
  $('vo-span').value = st.vo.span; $('vo-min').value = st.vo.minStrings;
  $('vo-root').checked = st.vo.rootBass; $('vo-open').checked = st.vo.allowOpen; $('vo-omit5').checked = st.vo.omit5;
  $('vo-omit5-row').hidden = set.pcs.length < 4;
  if (!voicings.length) voicings = findVoicings(tuning(), set.pcs, pc(st.root), Math.min(st.frets, 17), { ...st.vo, requireAll: true, minStrings: Math.min(st.vo.minStrings, st.strings) });
  const n = st.strings;
  $('vo-count').textContent = voicings.length >= 400 ? '400件以上（先頭400件）' : `${voicings.length}件`;
  $('vo-list').innerHTML = voicings.map((v, i) => {
    const tab = v.frets.map(f => f === null ? 'x' : f).join(' ');
    const bass = v.frets.find(f => f !== null), bassS = v.frets.findIndex(f => f !== null);
    const bassName = set.name(tuning()[bassS] + bass);
    return `<button class="vo-item ${i === vsel ? 'on' : ''}" data-i="${i}"><span class="vo-tab">${tab}</span><span class="vo-meta">${v.low ? v.low + 'f〜' : '開放〜'}${v.high}f · ${v.strings}弦 · ベース ${bassName}</span></button>`;
  }).join('') || '<p class="hint">条件に合うボイシングが見つかりませんでした。押さえる幅や弦数の条件をゆるめてみてください。</p>';
  $('vo-clear').disabled = vsel < 0;
}

async function renderSeed() { try { $('seed-display').textContent = await encodeSeed(st); } catch (e) {} }

function render() {
  renderControls();
  const set = currentSet();
  renderSetInfo(set);
  const count = renderFretboard();
  renderMetrics(set, count);
  renderVoicings(set);
  renderSeed();
}

// ── export ──
function exportSVG() {
  const svg = $('fretboard').querySelector('svg').cloneNode(true);
  svg.querySelectorAll('.fb-hit').forEach(el => el.remove());
  svg.setAttribute('width', '2360'); svg.setAttribute('height', String(Math.round(2360 * svg.viewBox.baseVal.height / svg.viewBox.baseVal.width)));
  const text = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
  a.download = 'fretboard_' + $('fb-title').textContent.replace(/♭/g, 'b').replace(/♯/g, 's').replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') + '.svg';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function copy(text, msg) { try { await navigator.clipboard.writeText(text); notify(msg); } catch (e) { prompt('コピーしてください', text); } }

// ── events ──
function bind() {
  $('root').innerHTML = ROOT_LABELS.map((n, i) => `<option value="${i}">${n}</option>`).join('');
  const groups = {}; Object.entries(SCALES).forEach(([id, s]) => (groups[s.group] = groups[s.group] || []).push(`<option value="${id}">${s.name}</option>`));
  $('scale').innerHTML = Object.entries(groups).map(([g, o]) => `<optgroup label="${g}">${o.join('')}</optgroup>`).join('');
  $('chord').innerHTML = Object.entries(CHORDS).map(([id, c]) => `<option value="${id}">${c.name}</option>`).join('');
  $('strings').innerHTML = STRING_COUNTS.map(n => `<option value="${n}">${n}弦${n <= 5 ? '（ベース）' : ''}</option>`).join('');

  $('strings').addEventListener('change', e => update(() => { st.strings = +e.target.value; st.tuning = TUNINGS[st.strings][0].id; st.custom = TUNINGS[st.strings][0].notes.slice(); st.strOn = Array(st.strings).fill(true); }));
  $('tuning').addEventListener('change', e => update(() => { if (e.target.value === 'custom' && st.tuning !== 'custom') st.custom = tuning().slice(); st.tuning = e.target.value; }));
  $('custom-tuning').addEventListener('change', e => { const s = e.target.dataset.s; if (s === undefined) return; update(() => { st.custom[+s] = +e.target.value; }); });
  $('frets').addEventListener('change', e => update(() => { st.frets = +e.target.value; }));
  $('lefty').addEventListener('change', e => update(() => { st.lefty = e.target.checked; }, true));
  $('root-to-low').addEventListener('click', () => update(() => { st.root = pc(Math.min(...tuning())); }));
  document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => update(() => { st.mode = b.dataset.mode; })));
  $('root').addEventListener('change', e => update(() => { st.root = +e.target.value; }));
  $('scale').addEventListener('change', e => update(() => { st.scale = e.target.value; st.emph = [0]; st.diat = -1; st.pattern = 0; }));
  $('chord').addEventListener('change', e => update(() => { st.chord = e.target.value; }));
  $('note-picks').addEventListener('click', e => { const b = e.target.closest('.pick'); if (!b) return; const p = +b.dataset.p; update(() => { st.notes = st.notes.includes(p) ? st.notes.filter(x => x !== p) : [...st.notes, p]; }); playNotes([60 + p]); });
  $('notes-clear').addEventListener('click', () => update(() => { st.notes = []; }));

  document.querySelectorAll('.range-btn').forEach(b => b.addEventListener('click', () => update(() => { st.range = b.dataset.range; }, true)));
  ['from', 'to'].forEach(id => $(id).addEventListener('change', e => update(() => { st[id] = Math.max(0, Math.min(st.frets, parseInt(e.target.value) || 0)); }, true)));
  $('range-prev').addEventListener('click', () => update(() => { const w = Math.abs(st.to - st.from); const lo = Math.max(0, Math.min(st.from, st.to) - 1); st.from = lo; st.to = lo + w; }, true));
  $('range-next').addEventListener('click', () => update(() => { const w = Math.abs(st.to - st.from); const lo = Math.min(st.frets - w, Math.min(st.from, st.to) + 1); st.from = lo; st.to = lo + w; }, true));
  $('pattern').addEventListener('change', e => update(() => { st.pattern = +e.target.value; }, true));
  $('pat-prev').addEventListener('click', () => update(() => { st.pattern = (st.pattern - 1 + scaleLen()) % scaleLen(); }, true));
  $('pat-next').addEventListener('click', () => update(() => { st.pattern = (st.pattern + 1) % scaleLen(); }, true));
  $('ghost').addEventListener('change', e => update(() => { st.ghost = e.target.checked; }, true));
  $('strings-on').addEventListener('click', e => { const b = e.target.closest('.pick'); if (!b) return; update(() => { st.strOn[+b.dataset.s] = !st.strOn[+b.dataset.s]; }, true); });
  $('strings-all').addEventListener('click', () => update(() => { st.strOn = Array(st.strings).fill(true); }, true));
  document.querySelectorAll('.label-btn').forEach(b => b.addEventListener('click', () => update(() => { st.label = b.dataset.label; }, true)));

  $('iv-chips').addEventListener('click', e => {
    const b = e.target.closest('.iv-chip'); if (!b) return;
    const set = currentSet(), i = +b.dataset.i;
    playNotes([60 + pc(set.root + set.ivs[i].semis)]);
    if (b.dataset.ro) return;
    update(() => { st.emph = st.emph.includes(i) ? st.emph.filter(x => x !== i) : [...st.emph, i]; }, true);
  });
  $('emph-chord').addEventListener('click', () => update(() => { st.diat = -1; st.emph = [0, 2, 4].filter(i => i < scaleLen()); }, true));
  $('emph-clear').addEventListener('click', () => update(() => { st.diat = -1; st.emph = []; }, true));
  $('diat').addEventListener('click', e => {
    const b = e.target.closest('.deg-btn'); if (!b) return; const d = +b.dataset.d;
    update(() => { st.diat = st.diat === d ? -1 : d; }, true);
    if (st.diat >= 0) { const c = diatonic(st.root, SCALES[st.scale].iv, d, st.seventh); playNotes(c.semis.map(s => 48 + c.root + s), 0.05, 1.2); }
  });
  $('seventh').addEventListener('change', e => update(() => { st.seventh = e.target.checked; }, true));

  // voicings
  const vo = (k, v) => update(() => { st.vo[k] = v; });
  $('vo-span').addEventListener('change', e => vo('span', +e.target.value));
  $('vo-min').addEventListener('change', e => vo('minStrings', +e.target.value));
  $('vo-root').addEventListener('change', e => vo('rootBass', e.target.checked));
  $('vo-open').addEventListener('change', e => vo('allowOpen', e.target.checked));
  $('vo-omit5').addEventListener('change', e => vo('omit5', e.target.checked));
  $('vo-list').addEventListener('click', e => {
    const b = e.target.closest('.vo-item'); if (!b) return; vsel = +b.dataset.i; render();
    const v = voicings[vsel], tun = tuning(); playNotes(v.frets.map((f, s) => f === null ? null : tun[s] + f).filter(m => m !== null), 0.045, 1.4);
  });
  $('vo-clear').addEventListener('click', () => { vsel = -1; render(); });

  // sound
  $('fretboard').addEventListener('click', e => { const h = e.target.closest('.fb-hit'); if (h) playNotes([+h.dataset.m], 0, 0.8); });
  $('play-set').addEventListener('click', () => {
    const set = currentSet(), vis = visibility(set), tun = tuning(), list = new Set();
    tun.forEach((open, s) => { for (let f = 0; f <= st.frets; f++) if (set.has(open + f) && vis(s, f)) list.add(open + f); });
    const up = [...list].sort((a, b) => a - b).slice(0, 48);
    if (!up.length) return notify('表示中の音がありません');
    playNotes(up.concat(up.slice(0, -1).reverse()), 0.17, 0.35);
  });

  $('export-svg').addEventListener('click', exportSVG);
  $('seed-copy').addEventListener('click', async () => copy(await encodeSeed(st), 'シードをコピーしました'));
  $('seed-share').addEventListener('click', async () => copy(location.origin + location.pathname + '#s=' + await encodeSeed(st), '共有 URL をコピーしました'));
  $('seed-apply').addEventListener('click', async () => {
    try { const s = sanitize(await decodeSeed($('seed-input').value)); update(() => { st = s; }); $('seed-err').textContent = ''; notify('シードを読み込みました'); }
    catch (e) { $('seed-err').textContent = e.message || 'シードを読み込めませんでした。'; }
  });
  $('reset').addEventListener('click', () => update(() => { st = structuredClone(DEFAULT); st.strOn = Array(st.strings).fill(true); }));

  document.querySelectorAll('.num-wrap').forEach(w => {
    const inp = w.querySelector('input');
    w.querySelectorAll('.num-btn').forEach(btn => btn.addEventListener('click', () => {
      const v = (parseFloat(inp.value) || 0) + (btn.dataset.dir === 'up' ? 1 : -1);
      inp.value = Math.max(+inp.min, Math.min(+inp.max, v)); inp.dispatchEvent(new Event('change', { bubbles: true }));
    }));
  });
}

async function boot() {
  let loaded = false;
  const m = location.hash.match(/^#s=([zj][A-Za-z0-9_-]+)/);
  if (m) {
    try { st = sanitize(await decodeSeed(m[1])); loaded = true; notify('共有された設定を読み込みました'); } catch (e) { notify('共有リンクを読み込めませんでした'); }
    history.replaceState(null, '', location.pathname);
  }
  if (!loaded) { try { const s = localStorage.getItem(STORE); st = sanitize(s ? JSON.parse(s) : null); } catch (e) { st = sanitize(null); } }
  bind(); render();
}
boot();
