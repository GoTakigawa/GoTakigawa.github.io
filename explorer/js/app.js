import { pc, SCALES, CHORDS, ROOT_LABELS, makeSet, parseInterval, diatonic, romanOf, chordSymbol, identifyChord } from './theory.js';
import { TUNINGS, STRING_COUNTS, findTuning, midiLabel } from './tunings.js';
import { npsPattern, findVoicings, chordForms, sweepShapes, FORMS } from './positions.js';
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
  vo: { span: 4, minStrings: 3, rootBass: false, allowOpen: true, omit5: false },
  hideIv: [], hideCells: [],
  shapeTab: 'forms', sw: { size: 0, span: 5, rootStart: false, allowOpen: false, topOnly: true }
};
let st = structuredClone(DEFAULT);
let shapes = null, ssel = -1, statusTimer = null, chipAction = 'emph', fbAction = 'play', picks = [];

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
  d.hideIv = Array.isArray(s.hideIv) ? s.hideIv.filter(x => typeof x === 'string' && /^(bb|b|##|#)?\d{1,2}$/.test(x)) : [];
  d.hideCells = Array.isArray(s.hideCells) ? s.hideCells.filter(x => typeof x === 'string' && /^\d{1,2}:\d{1,2}$/.test(x)).slice(0, 300) : [];
  d.shapeTab = ['forms', 'sets', 'sweep', 'search'].includes(s.shapeTab) ? s.shapeTab : 'forms';
  if (s.sw && typeof s.sw === 'object') {
    d.sw.size = [0, 3, 4, 5, 6, 7, 8].includes(s.sw.size) ? s.sw.size : 0;
    d.sw.span = int(s.sw.span, 4, 7, 5);
    d.sw.rootStart = !!s.sw.rootStart; d.sw.allowOpen = !!s.sw.allowOpen; d.sw.topOnly = s.sw.topOnly !== false;
  }
  return d;
}
const tuning = () => st.tuning === 'custom' ? st.custom : (findTuning(st.strings, st.tuning) || TUNINGS[st.strings][0]).notes;
function save() { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) {} }
function update(fn, keepShape) { fn(); if (!keepShape) { ssel = -1; shapes = null; } save(); render(); }
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

// Chord the shape tools work on: the chosen chord, or the diatonic chord in scale mode
function chordIdFor(semis) {
  const key = semis.map(pc).sort((a, b) => a - b).join(',');
  for (const [id, c] of Object.entries(CHORDS)) if (c.iv.map(n => pc(parseInterval(n).semis)).sort((a, b) => a - b).join(',') === key) return id;
  return null;
}
function shapeChord() {
  if (st.mode === 'chord') { const set = makeSet(st.root, CHORDS[st.chord].iv); return { root: st.root, id: st.chord, pcs: set.pcs, set, cset: set, label: set.name(st.root) + chordSymbol(st.chord) }; }
  if (st.mode === 'scale' && scaleLen() === 7) {
    const d = st.diat >= 0 ? st.diat : 0, c = diatonic(st.root, SCALES[st.scale].iv, d, st.seventh), id = chordIdFor(c.semis);
    const scaleSet = makeSet(st.root, SCALES[st.scale].iv);
    const DEF = ['1','b2','2','b3','3','4','b5','5','b6','6','b7','7'];
    const cset = makeSet(c.root, id ? CHORDS[id].iv : c.semis.map(x => DEF[pc(x)]));
    return { root: c.root, id, pcs: c.pcs, set: scaleSet, cset, label: `${romanOf(SCALES[st.scale].iv, d)}（${scaleSet.name(c.root)}${id ? chordSymbol(id) : ''}）`, fromScale: true };
  }
  return null;
}
const isHiddenIv = (set, p) => { const iv = set.intervalOf(p); return !!iv && st.hideIv.includes(set.info(p).iv.name); };
const isHiddenCell = (s, f) => st.hideCells.includes(s + ':' + f);
// chord tone label (R, 3, ♭7 ...) of a pitch against the shape chord
const toneOf = (c, m) => { const iv = c.cset.intervalOf(m); return iv === '1' ? 'R' : iv || '?'; };

// Which pitch classes get the filled (purple) emphasis
function emphasisPcs(set) {
  if (st.mode === 'chord' || st.mode === 'notes') return set.pcs;
  if (selectedShape()) { const c = shapeChord(); if (c) return c.pcs; }
  if (st.diat >= 0 && scaleLen() === 7) return diatonic(st.root, SCALES[st.scale].iv, st.diat, st.seventh).pcs;
  return st.emph.map(i => set.ivs[i]).filter(Boolean).map(iv => pc(st.root + iv.semis));
}

// Cells (string:fret) allowed by range / pattern / voicing / strings
function visibility(set) {
  const tun = tuning(), F = st.frets;
  let allow = null; // null = everything
  const sh = selectedShape();
  if (sh) {
    allow = new Set(sh.cells.map(c => c.s + ':' + c.f));
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
    const hid = st.hideIv.includes(iv.name);
    return `<button class="iv-chip ${on ? 'on' : ''} ${i === 0 ? 'root' : ''} ${hid ? 'hid' : ''}" data-i="${i}" ${chipAction === 'emph' && (st.mode !== 'scale' || st.diat >= 0) ? 'data-ro="1"' : ''}><b>${set.name(p)}</b><small>${hid ? '非表示' : iv.label}</small></button>`;
  }).join('');
  document.querySelectorAll('.chip-act').forEach(b => b.classList.toggle('on', b.dataset.act === chipAction));
  document.querySelectorAll('.fb-act').forEach(b => b.classList.toggle('on', b.dataset.act === fbAction));
  const nHidden = st.hideIv.length + st.hideCells.length;
  $('hide-restore').disabled = !nHidden; $('hide-restore').textContent = nHidden ? `隠した音をすべて戻す（${st.hideIv.length ? '音 ' + st.hideIv.length + ' ' : ''}${st.hideCells.length ? '位置 ' + st.hideCells.length : ''}）` : '隠した音をすべて戻す';
  if (chipAction === 'hide') { $('iv-hint').textContent = '押した音を指板から隠します（もう一度押すと戻ります）。点線の丸は隠している位置です。'; } else
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
  const emph = emphasisPcs(set), vis = visibility(set), sh = selectedShape();
  const order = {}, inShape = new Set(); if (sh) sh.cells.forEach(c => { inShape.add(c.s + ':' + c.f); if (c.order) order[c.s + ':' + c.f] = c.order; });
  const shC = sh ? shapeChord() : null;
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
  if (st.range === 'frets' && !sh) {
    const lo = Math.min(st.from, st.to), hi = Math.max(st.from, st.to);
    const x0 = lo === 0 ? raw(0) - 26 : raw(lo - 1), x1 = raw(hi);
    svg += `<rect x="${Math.min(X(x0), X(x1))}" y="${top - 10}" width="${Math.abs(X(x1) - X(x0))}" height="${gap * (n - 1) + 20}" fill="rgba(140,77,255,.10)"/>`;
  }
  [3, 5, 7, 9, 15, 17, 19, 21, 27].filter(f => f <= F).forEach(f => svg += `<circle cx="${cx(f)}" cy="${midY}" r="4" fill="#262626"/>`);
  [12, 24].filter(f => f <= F).forEach(f => svg += `<circle cx="${cx(f)}" cy="${midY - gap}" r="4" fill="#262626"/><circle cx="${cx(f)}" cy="${midY + gap}" r="4" fill="#262626"/>`);
  for (let f = 0; f <= F; f++) svg += `<line x1="${fx(f)}" y1="${top - 10}" x2="${fx(f)}" y2="${top + gap * (n - 1) + 10}" stroke="${f === 0 ? '#9a9a9a' : '#2c2c2c'}" stroke-width="${f === 0 ? 4 : 1.2}"/>`;
  for (let f = 1; f <= F; f++) if ([1, 3, 5, 7, 9, 12, 15, 17, 19, 21, 24, 27].includes(f)) svg += `<text x="${cx(f)}" y="${H + 12}" fill="#666" font-size="10" text-anchor="middle" font-family="Barlow">${f}</text>`;
  let dots = '', hits = '', count = 0;
  const showHidden = fbAction === 'hide' || chipAction === 'hide';
  for (let i = 0; i < n; i++) {
    const s = n - 1 - i, y = top + gap * i, open = tun[s], on = st.strOn[s];
    // the 1st string (top) is the thinnest, the lowest string the thickest
    svg += `<line x1="${fx(0)}" y1="${y}" x2="${X(W - padR)}" y2="${y}" stroke="${on ? '#5a5a5a' : '#262626'}" stroke-width="${(0.7 + i * 0.28).toFixed(2)}"/>`;
    svg += `<text x="${X(padL - 30)}" y="${y + 3.5}" fill="${on ? '#9a9a9a' : '#3a3a3a'}" font-size="11" text-anchor="middle" font-family="Barlow" font-weight="600">${set.name(open)}</text>`;
    for (let f = 0; f <= F; f++) {
      const m = open + f, p = pc(m), x = cx(f);
      hits += `<rect class="fb-hit" data-m="${m}" data-c="${s}:${f}" x="${Math.min(f === 0 ? X(padL - 26) : fx(f - 1), f === 0 ? X(padL) : fx(f))}" y="${y - gap / 2}" width="${Math.abs((f === 0 ? 26 : raw(f) - raw(f - 1)))}" height="${gap}"><title>${set.note(m)}</title></rect>`;
      if (!set.has(p)) continue;
      const hidden = isHiddenCell(s, f) || isHiddenIv(set, p);
      const visible = vis(s, f) && !hidden;
      if (hidden) { if (showHidden && vis(s, f)) dots += `<circle cx="${x}" cy="${y}" r="9.5" fill="none" stroke="#555" stroke-width="1.2" stroke-dasharray="2.5 2.5"/>`; continue; }
      if (!visible && !(st.ghost && on)) continue;
      if (visible) count++;
      const isRoot = st.mode !== 'notes' && p === pc(sh && st.mode === 'scale' ? shapeChord().root : st.root), isEm = emph.includes(p);
      const op = visible ? 1 : 0.16;
      const lbl = st.label === 'none' ? '' : shC && inShape.has(s + ':' + f) ? toneOf(shC, m) : st.label === 'interval' ? set.intervalOf(p) : st.label === 'degree' ? String(set.info(p).index + 1) : set.name(p);
      const fs = lbl.length > 2 ? 8 : 10;
      if (isRoot) dots += `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="10.5" fill="#86efac"/><text x="${x}" y="${y + 3.6}" fill="#0a0a0a" font-size="${fs}" font-weight="700" text-anchor="middle" font-family="Barlow">${lbl}</text></g>`;
      else if (isEm) dots += `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="10.5" fill="#8c4dff"/><text x="${x}" y="${y + 3.6}" fill="#0a0a0a" font-size="${fs}" font-weight="700" text-anchor="middle" font-family="Barlow">${lbl}</text></g>`;
      else dots += `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="10" fill="#000" stroke="#38bdf8" stroke-width="1.6"/><text x="${x}" y="${y + 3.4}" fill="#9fdcf9" font-size="${lbl.length > 2 ? 7.5 : 9}" font-weight="600" text-anchor="middle" font-family="Barlow">${lbl}</text></g>`;
      const ord = order[s + ':' + f];
      if (visible && ord) dots += `<circle cx="${x + 10}" cy="${y - 10}" r="6.5" fill="#e8e8e8"/><text x="${x + 10}" y="${y - 7.3}" fill="#0a0a0a" font-size="8" font-weight="700" text-anchor="middle" font-family="Barlow">${ord}</text>`;
    }
  }
  // picked notes for the chord finder (any pitch, drawn on top)
  picks.forEach(k => {
    const [s, f] = k.split(':').map(Number); if (s >= n || f > F) return;
    const x = cx(f), y = top + gap * (n - 1 - s);
    dots += `<circle cx="${x}" cy="${y}" r="11.5" fill="#f5f5f5" stroke="#fff" stroke-width="1.5"/><text x="${x}" y="${y + 3.6}" fill="#0a0a0a" font-size="9" font-weight="700" text-anchor="middle" font-family="Barlow">${set.name(tun[s] + f)}</text>`;
  });
  if (sh) sh.muted.forEach(s => { const y = top + gap * (n - 1 - s); dots += `<text x="${X(padL - 13)}" y="${y + 4}" fill="#f87171" font-size="12" text-anchor="middle" font-family="Barlow" font-weight="700">×</text>`; });
  svg += dots + hits + '</svg>';
  $('fretboard').innerHTML = svg;
  $('fb-title').textContent = titleFor(set) + (sh ? ` ／ ${sh.title}` : '');
  $('fretboard').classList.toggle('hide-mode', fbAction === 'hide');
  return count;
}

function renderMetrics(set, count) {
  const tun = tuning();
  $('m-target').textContent = titleFor(set);
  $('m-notes').textContent = set.ivs.map(iv => set.name(set.root + iv.semis)).join(' ');
  $('m-tuning').textContent = (st.tuning === 'custom' ? 'カスタム' : (findTuning(st.strings, st.tuning) || {}).name) + ` · ${st.strings}弦`;
  $('m-open').textContent = tun.slice().reverse().map(m => set.name(m)).join(' ');
  const lo = Math.min(st.from, st.to), hi = Math.max(st.from, st.to);
  $('m-range').textContent = selectedShape() ? selectedShape().title : st.range === 'frets' ? `${lo}〜${hi}フレット` : st.range === 'pattern' ? `パターン ${st.pattern % scaleLen() + 1}` : `0〜${st.frets}フレット`;
  $('m-count').innerHTML = `${count}<span class="metric-unit">か所</span>`;
}

// ── shapes: chord forms / string sets / sweeps / search ──
function computeShapes() {
  const c = shapeChord(); if (!c) return [];
  const tun = tuning(), n = tun.length, F = st.frets, rootPc = pc(c.root), name = m => c.set.name(m);
  const fromFrets = (frets, title, meta) => {
    const cells = [], muted = [];
    frets.forEach((f, s) => f === null ? muted.push(s) : cells.push({ s, f }));
    // chord tones written high string → low string to match the diagram (1st string on top)
    const tones = frets.map((f, s) => f === null ? '×' : toneOf(c, tun[s] + f)).reverse().join(' ');
    return { title, meta, cells, muted, tones, tab: frets.map(f => f === null ? 'x' : f).join(' '), play: cells.map(x => tun[x.s] + x.f), strum: true };
  };
  if (st.shapeTab === 'forms') {
    return chordForms(tun, c.id, rootPc, F, c.pcs).map(v => fromFrets(v.frets, v.name, `${v.name} · ${v.low ? v.low + '〜' + v.high + 'f' : '開放'}`));
  }
  if (st.shapeTab === 'sets') {
    // more than four tones: drop the 5th, then 9th, then 11th so the shape fits four strings
    let need = c.pcs.slice();
    if (need.length > 4) {
      const relOf = p => pc(p - c.root);
      for (const drop of [7, 2, 5, 1, 3]) { if (need.length <= 4) break; need = need.filter(p => relOf(p) !== drop || need.length <= 4); }
    }
    const k = Math.min(need.length, n);
    const list = findVoicings(tun, need, rootPc, Math.min(F, 19), { span: st.vo.span, minStrings: k, maxStrings: k, requireAll: true, allowOpen: st.vo.allowOpen, need, limit: 300 });
    // high string sets first
    list.sort((x, y) => Math.max(...y.frets.map((f, s) => f === null ? -1 : s)) - Math.max(...x.frets.map((f, s) => f === null ? -1 : s)) || x.low - y.low);
    return list.map(v => { const used = v.frets.map((f, s) => f === null ? null : s).filter(x => x !== null);
      const strs = `${n - used[used.length - 1]}〜${n - used[0]}弦`;
      return fromFrets(v.frets, strs, `${strs} · ${v.low || 0}〜${v.high}f`); });
  }
  if (st.shapeTab === 'sweep') {
    const sizes = st.sw.size ? [st.sw.size] : [8, 7, 6, 5, 4, 3];
    let list = sweepShapes(tun, c.pcs, rootPc, Math.min(F, 24), { span: st.sw.span, sizes, rootStart: st.sw.rootStart, allowOpen: st.sw.allowOpen });
    if (st.sw.topOnly) list = list.filter(sw => sw.hi === n - 1);
    // treble side first: sets ending nearer the 1st string, then fewer strings, then lower on the neck
    list.sort((x, y) => y.hi - x.hi || y.lo - x.lo || x.low - y.low);
    return list.map(sw => {
      const cells = sw.notes.map((x, i) => ({ s: x.s, f: x.f, order: i + 1 }));
      const tones = sw.notes.map(x => toneOf(c, x.m)).join(' → ');
      const strs = `${n - sw.hi}〜${n - sw.lo}弦`;
      return { title: `${sw.size}弦スウィープ（${strs}）`, meta: `${strs} · ${sw.low}〜${sw.high}f · ${toneOf(c, sw.notes[0].m)} から`, cells, muted: [], tones,
        tab: sw.notes.map(x => `${n - x.s}弦${x.f}`).join(' '), play: sw.notes.map(x => x.m), strum: false };
    });
  }
  const list = findVoicings(tun, c.pcs, rootPc, Math.min(F, 17), { ...st.vo, requireAll: true, minStrings: Math.min(st.vo.minStrings, n) });
  return list.map(v => fromFrets(v.frets, 'ボイシング', `${v.low ? v.low + '〜' : '開放〜'}${v.high}f · ${v.strings}弦`));
}
function selectedShape() { return shapes && ssel >= 0 ? shapes[ssel] || null : null; }

// Small diagram of a shape: 1st string on top, a few frets around the shape
function thumb(item, c) {
  const tun = tuning(), n = tun.length;
  const fr = item.cells.map(x => x.f).filter(f => f > 0);
  const lo = fr.length ? Math.max(1, Math.min(...fr)) : 1, hi = Math.max(lo + 3, fr.length ? Math.max(...fr) : 4);
  const cols = hi - lo + 1, W = 18 + cols * 22 + 6, gap = 9, top = 8, H = top * 2 + gap * (n - 1) + 10;
  const x0 = 18, colX = f => x0 + (f - lo) * 22 + 11, Y = s => top + gap * (n - 1 - s);
  let g = `<svg class="thumb" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
  for (let k = 0; k <= cols; k++) g += `<line x1="${x0 + k * 22}" y1="${top - 3}" x2="${x0 + k * 22}" y2="${top + gap * (n - 1) + 3}" stroke="${k === 0 && lo === 1 ? '#bbb' : '#333'}" stroke-width="${k === 0 && lo === 1 ? 2.5 : 1}"/>`;
  for (let s = 0; s < n; s++) g += `<line x1="${x0}" y1="${Y(s)}" x2="${x0 + cols * 22}" y2="${Y(s)}" stroke="#555" stroke-width="${(0.5 + (n - 1 - s) * 0.18).toFixed(2)}"/>`;
  item.muted.forEach(s => g += `<text x="9" y="${Y(s) + 3}" fill="#f87171" font-size="8" text-anchor="middle" font-family="Barlow" font-weight="700">×</text>`);
  item.cells.forEach(cell => {
    const m = tun[cell.s] + cell.f, isR = pc(m) === pc(c.root);
    const x = cell.f === 0 ? 9 : colX(cell.f), y = Y(cell.s);
    if (cell.f === 0) g += `<circle cx="${x}" cy="${y}" r="3.6" fill="none" stroke="${isR ? '#86efac' : '#8c4dff'}" stroke-width="1.4"/>`;
    else g += `<circle cx="${x}" cy="${y}" r="4.2" fill="${isR ? '#86efac' : '#8c4dff'}"/>`;
    if (cell.order) g += `<text x="${x}" y="${y + 2.4}" fill="#0a0a0a" font-size="6" font-weight="700" text-anchor="middle" font-family="Barlow">${cell.order}</text>`;
  });
  g += `<text x="${x0 + 2}" y="${H - 1}" fill="#777" font-size="8" font-family="Barlow">${lo}f</text></svg>`;
  return g;
}

function renderShapes() {
  const c = shapeChord();
  $('shape-panel').hidden = !c;
  if (!c) return;
  if (!shapes) shapes = computeShapes();
  document.querySelectorAll('.shape-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === st.shapeTab));
  $('shape-target').textContent = c.label + '　構成音：' + c.cset.ivs.map(iv => `${c.cset.name(c.root + iv.semis)}(${iv.label === '1' ? 'R' : iv.label})`).join(' ') + (c.fromScale && st.diat < 0 ? '　※ダイアトニックで選んだコードに切り替わります' : '');
  $('opts-search').hidden = st.shapeTab !== 'search'; $('opts-sweep').hidden = st.shapeTab !== 'sweep'; $('opts-sets').hidden = st.shapeTab !== 'sets';
  $('vo-span').value = st.vo.span; $('vo-min').value = st.vo.minStrings;
  $('vo-root').checked = st.vo.rootBass; $('vo-open').checked = st.vo.allowOpen; $('vo-omit5').checked = st.vo.omit5;
  $('vo-omit5-row').hidden = c.pcs.length < 4;
  $('sets-span').value = st.vo.span; $('sets-open').checked = st.vo.allowOpen;
  $('sw-size').innerHTML = '<option value="0">すべて</option>' + [3, 4, 5, 6, 7, 8].filter(k => k <= st.strings).map(k => `<option value="${k}">${k}弦</option>`).join('');
  $('sw-size').value = st.sw.size; $('sw-span').value = st.sw.span; $('sw-root').checked = st.sw.rootStart; $('sw-open').checked = st.sw.allowOpen; $('sw-top').checked = st.sw.topOnly;
  const hints = {
    forms: '一般的なコードフォーム（E型・A型・D型・C型・G型など）を、いまのチューニングに置き直して並べています。7・8弦では上の6本で作ります。',
    sets: `隣り合う${Math.min(c.pcs.length > 4 ? 4 : c.pcs.length, st.strings)}本の弦に構成音を1つずつ置く形です（3和音ならトライアド、4和音ならドロップ系の形）。高音弦側から並べています。${c.pcs.length > 4 ? '5音以上のコードは、5度・9度・11度の順に省いて4音にしています。' : ''}`,
    sweep: 'コードトーンを順番に1弦1〜2音ずつ上がっていくスウィープの形です。高音弦側の形から並べています。番号が弾く順番です。',
    search: '隣り合う弦だけを使い、構成音がすべて入る押さえ方を条件で探します。'
  };
  $('shape-hint').textContent = hints[st.shapeTab];
  const noForm = st.shapeTab === 'forms' && (!c.id || !FORMS[c.id]);
  $('shape-count').textContent = noForm ? '' : shapes.length >= 300 ? '300件以上' : `${shapes.length}件`;
  const shown = shapes.slice(0, 120);
  $('shape-list').innerHTML = noForm
    ? '<p class="hint">このコードの定番フォームはまだ登録していません。「弦セット」や「検索」を使ってください。</p>'
    : shown.map((v, i) => `<button class="vo-item ${i === ssel ? 'on' : ''}" data-i="${i}">${thumb(v, c)}<span class="vo-body"><span class="vo-tones">${v.tones}</span><span class="vo-meta">${v.meta}</span><span class="vo-tab">${v.tab}</span></span></button>`).join('')
      || '<p class="hint">条件に合う形が見つかりませんでした。条件をゆるめてみてください。</p>';
  if (shapes.length > shown.length) $('shape-list').insertAdjacentHTML('beforeend', `<p class="hint" style="grid-column:1/-1">ほか ${shapes.length - shown.length} 件。条件で絞り込んでください。</p>`);
  $('shape-clear').disabled = ssel < 0;
}

// ── chord finder (picked notes) ──
function renderFinder() {
  const tun = tuning(), on = fbAction === 'pick' || picks.length;
  $('finder-panel').hidden = !on;
  if (!on) return;
  const notes = picks.map(k => { const [s, f] = k.split(':').map(Number); return { s, f, m: tun[s] + f }; }).filter(x => x.s < tun.length).sort((a, b) => a.m - b.m);
  const res = identifyChord(notes.map(x => x.m));
  const spellFor = res.results[0] ? res.results[0].set : currentSet();
  $('pick-notes').innerHTML = notes.map(x => `<span class="pick-note">${spellFor.name(x.m)}<small>${tun.length - x.s}弦 ${x.f}f</small></span>`).join('') || '<span class="hint">指板の上で音を押して選んでください（もう一度押すと外れます）。</span>';
  let html = '';
  if (res.kind === 'single') html = '<p class="hint">1音だけです。もう1音以上選ぶとコードを推測します。</p>';
  else if (res.kind === 'dyad') html = `<p class="hint">2音の音程：<span>${res.interval}</span>${res.results.length ? '（' + res.results.map(r => r.name).join(' / ') + '）' : ''}</p>`;
  else if (res.kind === 'chord') html = res.results.length
    ? res.results.map((r, i) => {
        const seen = new Set(), uniq = notes.filter(x => { const k = pc(x.m); if (seen.has(k)) return false; seen.add(k); return true; });
        return `<div class="fd-item ${i === 0 ? 'top' : ''}"><b>${r.name}</b><span>${uniq.map(x => `${r.set.name(x.m)}<small>${(r.set.intervalOf(x.m) || '?').replace(/^1$/, 'R')}</small>`).join(' ')}</span></div>`;
      }).join('')
    : '<p class="hint">登録しているコードの形には当てはまりませんでした。</p>';
  $('finder-results').innerHTML = html;
  $('pick-play').disabled = !notes.length; $('pick-clear').disabled = !notes.length;
}

async function renderSeed() { try { $('seed-display').textContent = await encodeSeed(st); } catch (e) {} }

function render() {
  renderControls();
  const set = currentSet();
  renderSetInfo(set);
  const count = renderFretboard();
  renderMetrics(set, count);
  renderShapes();
  renderFinder();
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

  $('strings').addEventListener('change', e => update(() => { st.strings = +e.target.value; st.tuning = TUNINGS[st.strings][0].id; st.custom = TUNINGS[st.strings][0].notes.slice(); st.strOn = Array(st.strings).fill(true); st.hideCells = []; picks = []; }));
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
    if (chipAction === 'hide') { const nm = set.ivs[i].name; update(() => { st.hideIv = st.hideIv.includes(nm) ? st.hideIv.filter(x => x !== nm) : [...st.hideIv, nm]; }, true); return; }
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

  // shapes
  document.querySelectorAll('.shape-tab').forEach(b => b.addEventListener('click', () => update(() => { st.shapeTab = b.dataset.tab; })));
  const vo = (k, v) => update(() => { st.vo[k] = v; });
  $('vo-span').addEventListener('change', e => vo('span', +e.target.value));
  $('vo-min').addEventListener('change', e => vo('minStrings', +e.target.value));
  $('vo-root').addEventListener('change', e => vo('rootBass', e.target.checked));
  $('vo-open').addEventListener('change', e => vo('allowOpen', e.target.checked));
  $('vo-omit5').addEventListener('change', e => vo('omit5', e.target.checked));
  $('sets-span').addEventListener('change', e => vo('span', +e.target.value));
  $('sets-open').addEventListener('change', e => vo('allowOpen', e.target.checked));
  const sw = (k, v) => update(() => { st.sw[k] = v; });
  $('sw-size').addEventListener('change', e => sw('size', +e.target.value));
  $('sw-span').addEventListener('change', e => sw('span', +e.target.value));
  $('sw-root').addEventListener('change', e => sw('rootStart', e.target.checked));
  $('sw-open').addEventListener('change', e => sw('allowOpen', e.target.checked));
  $('shape-list').addEventListener('click', e => {
    const b = e.target.closest('.vo-item'); if (!b) return;
    ssel = +b.dataset.i; render();
    const v = selectedShape();
    if (v.strum) playNotes(v.play.slice().sort((x, y) => x - y), 0.045, 1.4);
    else playNotes(v.play.concat(v.play.slice(0, -1).reverse()), 0.11, 0.3);
  });
  $('shape-clear').addEventListener('click', () => { ssel = -1; render(); });

  // hide controls
  document.querySelectorAll('.chip-act').forEach(b => b.addEventListener('click', () => { chipAction = b.dataset.act; render(); }));
  document.querySelectorAll('.fb-act').forEach(b => b.addEventListener('click', () => { fbAction = b.dataset.act; render(); }));
  $('pick-play').addEventListener('click', () => { const tun = tuning(); const ms = picks.map(k => { const [s, f] = k.split(':').map(Number); return tun[s] + f; }).sort((a, b) => a - b); playNotes(ms, 0.05, 1.4); });
  $('pick-clear').addEventListener('click', () => { picks = []; render(); });
  $('sw-top').addEventListener('change', e => update(() => { st.sw.topOnly = e.target.checked; }));
  $('hide-restore').addEventListener('click', () => update(() => { st.hideIv = []; st.hideCells = []; }, true));

  // sound
  $('fretboard').addEventListener('click', e => {
    const h = e.target.closest('.fb-hit'); if (!h) return;
    if (fbAction === 'pick') {
      const c = h.dataset.c;
      picks = picks.includes(c) ? picks.filter(x => x !== c) : [...picks, c];
      if (picks.includes(c)) playNotes([+h.dataset.m], 0, 0.6);
      render(); return;
    }
    if (fbAction === 'hide') {
      const set = currentSet(); if (!set.has(+h.dataset.m)) return;
      const c = h.dataset.c; update(() => { st.hideCells = st.hideCells.includes(c) ? st.hideCells.filter(x => x !== c) : [...st.hideCells, c]; }, true); return;
    }
    playNotes([+h.dataset.m], 0, 0.8);
  });
  $('play-set').addEventListener('click', () => {
    const set = currentSet(), vis = visibility(set), tun = tuning(), list = new Set();
    tun.forEach((open, s) => { for (let f = 0; f <= st.frets; f++) if (set.has(open + f) && vis(s, f) && !isHiddenCell(s, f) && !isHiddenIv(set, pc(open + f))) list.add(open + f); });
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
