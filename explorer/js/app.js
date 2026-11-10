import { pc, SCALES, CHORDS, ROOT_LABELS, makeSet, parseInterval, diatonic, romanOf, chordSymbol, identifyChord, interpretDyad, identifyScales, diatonicRootName } from './theory.js?v=66';
import { INSTRUMENTS, TUNINGS, MAX_MINUS, countsOf, tuningsFor, findTuning, midiLabel } from './tunings.js?v=66';
import { npsPattern, findVoicings, chordForms, sweepShapes, FORMS, derivedForms, sweepScore, playScore } from './positions.js?v=66';
import { PianoEngine, VOICE_NAMES } from './audio.js?v=66';
import { parseChordText, parseScaleText, CHORD_PRESETS, SCALE_PRESETS, chordMidi, guideNote } from './progression.js?v=66';
import { Player, drumBar, DRUM_INSTR, DRUM_VEL } from './player.js?v=66';
import { buildMidi, download, fretboardCanvas, canvasBlob, pdfFromCanvas, encodeShare, decodeShare } from './export.js?v=66';
import { PitchListener } from './pitch.js?v=66';
import { initLayout } from './layout.js?v=66';
import { initTheme, themeColors } from './theme.js?v=66';
// the build number is the cache-busting ?v= of this file, shown next to BETA
{ const v = new URL(import.meta.url).searchParams.get('v'), el = document.getElementById('ver'); if (v && el) el.textContent = 'BETA ' + v; }
const MAX_BARS = 120;
// a preset is written per beat: f(beat index, position inside the beat 0..1) -> 0 off / 1 soft / 2 strong; it works at any resolution
const PRESET_DEF = {
  metro: { rows: { click: (b, x) => x === 0 ? (b === 0 ? 2 : 1) : 0 } },
  rock8: { rows: { hat: (b, x) => x === 0 ? 2 : x === 0.5 ? 1 : 0, snare: (b, x) => x === 0 && b % 2 === 1 ? 2 : 0, kick: (b, x) => x === 0 && b % 2 === 0 ? 2 : 0 } },
  four: { rows: { kick: (b, x) => x === 0 ? 2 : 0, hatO: (b, x) => x === 0.5 ? 2 : 0 } },
  beat16: { rows: { hat: (b, x) => x === 0 ? 2 : 1, snare: (b, x) => x === 0 && b % 2 === 1 ? 2 : 0, kick: (b, x) => x === 0 && b % 2 === 0 ? 2 : b % 2 === 1 && x === 0.75 ? 1 : 0 } },
  shuffle: { swing: { mode: '8', amt: 67 }, rows: { hat: (b, x) => x === 0 ? 2 : x === 0.5 ? 1 : 0, snare: (b, x) => x === 0 && b % 2 === 1 ? 2 : 0, kick: (b, x) => x === 0 && b % 2 === 0 ? 2 : 0 } },
  none: { rows: {} }
};


const $ = id => document.getElementById(id);
const STORE = 'gti-explorer:state';
const audio = new PianoEngine();

const DEFAULT = {
  v: 1, inst: 'guitar', cfg: {}, strings: 6, tuning: 'e-std', custom: [40,45,50,55,59,64], frets: 24, minus: [0,0,0,0,0,0], lefty: false,
  mode: 'scale', root: 4, scale: 'ionian', chord: 'm7', notes: [0, 4, 7],
  emph: [0], diat: -1, seventh: false,
  range: 'all', from: 5, to: 8, pattern: 0, ghost: true,
  strOn: [], label: 'name',
  vo: { span: 4, minStrings: 3, rootBass: false, allowOpen: true, omit5: false, kind: 'all', count: 0, easy: false, range: '' },
  hideIv: [], hideCells: [],
  quiz: { kind: 'note-scale', count: 10 },
  prog: { chords: 'I V vi IV', scales: '', bpm: 100, beats: 4, loop: true, count: true, click: true, drum: drumPreset('metro', 4), voice: 'piano', style: 'strum', guide: 'off', follow: true },
  shapeTab: 'forms', sw: { size: 0, notes: 0, span: 5, rootStart: false, allowOpen: false, topOnly: true, common: true }
};
let st = structuredClone(DEFAULT);
let voSets = [];
let shapes = null, ssel = -1, statusTimer = null, chipAction = 'emph', fbAction = 'play', picks = [];
// a chord chosen from the search results, used by Shapes only (Show stays as it is)
let shapeOverride = null;
// root used by the scale finder: 'none' (try all), 'bass' (lowest picked note) or a pitch class
let scRoot = 'none';

// ── state ──
const clampInt = (v, lo, hi, def) => Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : def;
const intIn = (v, lo, hi, def) => Number.isInteger(v) && v >= lo && v <= hi ? v : def;
// one instrument's setup (string count, tuning, frets, minus frets), checked
function cleanCfg(inst, s) {
  s = s && typeof s === 'object' ? s : {};
  const strings = countsOf(inst).includes(s.strings) ? s.strings : INSTRUMENTS[inst].def, list = tuningsFor(inst, strings);
  return {
    strings,
    tuning: s.tuning === 'custom' || findTuning(inst, strings, s.tuning) ? s.tuning : list[0].id,
    custom: Array.isArray(s.custom) && s.custom.length === strings && s.custom.every(m => Number.isInteger(m) && m >= 16 && m <= 80) ? s.custom : list[0].notes.slice(),
    frets: [20, 21, 22, 24, 27].includes(s.frets) ? s.frets : (inst === 'bass' ? 21 : 24),
    minus: Array.isArray(s.minus) && s.minus.length === strings ? s.minus.map(v => intIn(v, 0, MAX_MINUS, 0)) : Array(strings).fill(0)
  };
}
const cfgOfState = () => ({ strings: st.strings, tuning: st.tuning, custom: st.custom.slice(), frets: st.frets, minus: st.minus.slice() });
function sanitize(s) {
  const d = structuredClone(DEFAULT);
  d.strOn = Array(d.strings).fill(true);
  if (!s || typeof s !== 'object') return d;
  const int = intIn;
  // older saves have no instrument: 4 / 5 strings were the basses
  d.inst = INSTRUMENTS[s.inst] ? s.inst : (Number.isInteger(s.strings) && s.strings <= 5 ? 'bass' : 'guitar');
  Object.assign(d, cleanCfg(d.inst, s));
  d.cfg = {};
  if (s.cfg && typeof s.cfg === 'object') Object.keys(INSTRUMENTS).forEach(k => { if (k !== d.inst && s.cfg[k]) d.cfg[k] = cleanCfg(k, s.cfg[k]); });
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
    d.vo.span = int(s.vo.span, 3, 6, 4); d.vo.minStrings = int(s.vo.minStrings, 2, 9, 3);
    ['rootBass', 'allowOpen', 'omit5', 'easy'].forEach(k => { if (k in s.vo) d.vo[k] = !!s.vo[k]; });
    d.vo.kind = s.vo.kind === 'power' ? 'power' : 'all';
    d.vo.count = [0, 2, 3, 4, 5, 6].includes(s.vo.count) ? s.vo.count : 0;
    d.vo.range = typeof s.vo.range === 'string' && /^\d{1,2}〜\d{1,2}弦$/.test(s.vo.range) ? s.vo.range : '';
  }
  d.hideIv = Array.isArray(s.hideIv) ? s.hideIv.filter(x => typeof x === 'string' && /^(bb|b|##|#)?\d{1,2}$/.test(x)) : [];
  d.hideCells = Array.isArray(s.hideCells) ? s.hideCells.filter(x => typeof x === 'string' && /^\d{1,2}:-?\d{1,2}$/.test(x)).slice(0, 1500) : [];
  if (s.quiz && typeof s.quiz === 'object') {
    d.quiz.kind = ['note-scale', 'note-all', 'degree', 'interval', 'chord'].includes(s.quiz.kind) ? s.quiz.kind : 'note-scale';
    d.quiz.count = intIn(s.quiz.count, 1, 100, 10);
  }
  if (s.prog && typeof s.prog === 'object') {
    const q = s.prog, P = d.prog;
    if (typeof q.chords === 'string') P.chords = q.chords.slice(0, 3000);
    if (typeof q.scales === 'string') P.scales = q.scales.slice(0, 4000);
    P.bpm = int(q.bpm, 40, 220, 100); P.beats = int(q.beats, 1, 16, 4);
    ['loop', 'count', 'click', 'follow'].forEach(k => { if (k in q) P[k] = !!q[k]; });
    P.drum = cleanDrum(q.drum, P.beats); P.voice = VOICE_NAMES[q.voice] ? q.voice : 'piano';
    P.style = ['strum', 'arp', 'root', 'off'].includes(q.style) ? q.style : 'strum'; P.guide = q.guide === 'root' ? 'root' : 'off';
  }
  // the search tab is a temporary picking mode, so a reload starts from chord forms
  d.shapeTab = ['forms', 'sets', 'sweep'].includes(s.shapeTab) ? s.shapeTab : 'forms';
  if (s.sw && typeof s.sw === 'object') {
    d.sw.size = [0, 3, 4, 5, 6, 7, 8, 9].includes(s.sw.size) ? s.sw.size : 0;
    d.sw.span = int(s.sw.span, 4, 7, 5);
    d.sw.notes = int(s.sw.notes, 0, 16, 0);
    d.sw.rootStart = !!s.sw.rootStart; d.sw.allowOpen = !!s.sw.allowOpen; d.sw.topOnly = s.sw.topOnly !== false; d.sw.common = s.sw.common !== false;
  }
  return d;
}
const tuning = () => st.tuning === 'custom' ? st.custom : (findTuning(st.inst, st.strings, st.tuning) || tuningsFor(st.inst, st.strings)[0]).notes;
const minusOf = s => st.minus[s] || 0;                                   // extended frets on the headstock side, per string
const minusMax = () => Math.max(0, ...st.minus.slice(0, st.strings));
// switch between guitar and bass: each instrument keeps its own string count, tuning, frets and minus frets
function setInstrument(inst) {
  if (inst === st.inst || !INSTRUMENTS[inst]) return;
  st.cfg = st.cfg || {}; st.cfg[st.inst] = cfgOfState();
  Object.assign(st, cleanCfg(inst, st.cfg[inst])); st.inst = inst;
  st.strOn = Array(st.strings).fill(true); st.hideCells = []; picks = []; shapeOverride = null;
}
// while a progression is playing, the screen follows the bars: what is saved is the setting from before it started
const pb = { on: false, snap: null, bars: [], chord: null, scale: null, prevCenter: 5, sig: '' };
function save() {
  try {
    const o = pb.on && pb.snap ? { ...st, mode: pb.snap.mode, root: pb.snap.root, scale: pb.snap.scale, chord: pb.snap.chord, emph: pb.snap.emph, diat: pb.snap.diat, range: pb.snap.range, from: pb.snap.from, to: pb.snap.to, pattern: pb.snap.pattern } : st;
    localStorage.setItem(STORE, JSON.stringify(o));
  } catch (e) {}
}
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
  if (shapeOverride) {
    const set = makeSet(shapeOverride.root, CHORDS[shapeOverride.id].iv), sym = set.name(shapeOverride.root) + chordSymbol(shapeOverride.id);
    return { root: shapeOverride.root, id: shapeOverride.id, pcs: set.pcs, set, cset: set, sym, label: sym, override: true };
  }
  if (st.mode === 'chord') { const set = makeSet(st.root, CHORDS[st.chord].iv); return { root: st.root, id: st.chord, pcs: set.pcs, set, cset: set, sym: set.name(st.root) + chordSymbol(st.chord), label: set.name(st.root) + chordSymbol(st.chord) }; }
  if (st.mode === 'scale' && scaleLen() === 7) {
    const d = st.diat >= 0 ? st.diat : 0, c = diatonic(st.root, SCALES[st.scale].iv, d, st.seventh), id = chordIdFor(c.semis);
    const scaleSet = makeSet(st.root, SCALES[st.scale].iv);
    const DEF = ['1','b2','2','b3','3','4','b5','5','b6','6','b7','7'];
    const cset = makeSet(c.root, id ? CHORDS[id].iv : c.semis.map(x => DEF[pc(x)]));
    const sym = diatonicRootName(scaleSet, SCALES[st.scale].iv, d, c.root) + (id ? chordSymbol(id) : chordNameFor(c.semis));
    return { root: c.root, id, pcs: c.pcs, set: scaleSet, cset, sym, label: `${romanOf(SCALES[st.scale].iv, d)}（${sym}）`, fromScale: true };
  }
  return null;
}
const isHiddenIv = (set, p) => { const iv = set.intervalOf(p); return !!iv && st.hideIv.includes(set.info(p).iv.name); };
const isHiddenCell = (s, f) => st.hideCells.includes(s + ':' + f);
// chord tone label (R, 3, ♭7 ...) of a pitch against the shape chord
const toneOf = (c, m) => { const iv = c.cset.intervalOf(m); return iv === '1' ? 'R' : iv || '?'; };

// Which pitch classes get the filled (purple) emphasis
function emphasisPcs(set) {
  if (pb.on && pb.chord && st.mode === 'scale') return makeSet(pb.chord.root, CHORDS[pb.chord.id].iv).pcs;   // chord tones over the scale
  if (selectedShape()) { const c = shapeChord(); if (c) return c.pcs; }
  if (st.mode === 'chord' || st.mode === 'notes') return set.pcs;
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

// Preview a scale: up one octave plus one more note, then back down (do re mi fa so la ti do re do ti la so fa mi re do)
function playScalePreview(root, ivNames) {
  const semis = makeSet(root, ivNames).ivs.map(iv => iv.semis), n = semis.length;
  let base = 60 + pc(root); if (base > 66) base -= 12;          // keep it in a comfortable middle range
  const at = i => base + semis[i % n] + 12 * Math.floor(i / n);
  const up = []; for (let i = 0; i <= n + 1; i++) up.push(at(i));
  const down = []; for (let i = n; i >= 0; i--) down.push(at(i));
  playNotes(up.concat(down), 0.26, 0.5);
}

// ── render ──
function renderControls() {
  document.querySelectorAll('.inst-btn').forEach(b => b.classList.toggle('on', b.dataset.inst === st.inst));
  $('strings').innerHTML = countsOf(st.inst).map(n => `<option value="${n}">${n}弦</option>`).join('');
  $('strings').value = st.strings;
  $('tuning').innerHTML = tuningsFor(st.inst, st.strings).map(t => `<option value="${t.id}">${t.name}</option>`).join('') + '<option value="custom">カスタム</option>';
  $('tuning').value = st.tuning;
  $('custom-tuning').hidden = st.tuning !== 'custom';
  if (st.tuning === 'custom') {
    const opts = m => { let h = ''; for (let n = 16; n <= 80; n++) h += `<option value="${n}" ${n === m ? 'selected' : ''}>${midiLabel(n)}</option>`; return h; };
    $('custom-tuning').innerHTML = st.custom.map((m, i) => `<label class="ct-cell"><span>${i + 1}弦</span><select data-s="${i}" aria-label="${st.strings - i}弦">${opts(m)}</select></label>`).reverse().join('');
    // label strings by guitar numbering (1 = highest)
    [...$('custom-tuning').querySelectorAll('.ct-cell span')].forEach((el, k) => el.textContent = (k + 1) + '弦');
  }
  $('frets').value = st.frets; $('lefty').checked = st.lefty;
  // minus frets: one number per string, the 1st string first
  $('minus-grid').innerHTML = tuning().map((m, s) => ({ s })).reverse().map(({ s }, k) => `<label class="ct-cell"><span>${k + 1}弦</span><select data-s="${s}" aria-label="${k + 1}弦のマイナスフレット">${Array.from({ length: MAX_MINUS + 1 }, (_, v) => `<option value="${v}" ${v === minusOf(s) ? 'selected' : ''}>${v ? '−' + v : '0'}</option>`).join('')}</select></label>`).join('');
  $('minus-sum').textContent = minusMax() ? '（最大 −' + minusMax() + '）' : '';
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
  $('fb-show-all').disabled = !nHidden; $('fb-deselect').disabled = !picks.length && ssel < 0;
  $('fb-show-all').textContent = nHidden ? `すべて表示（${st.hideIv.length ? '音' + st.hideIv.length : ''}${st.hideIv.length && st.hideCells.length ? '・' : ''}${st.hideCells.length ? '位置' + st.hideCells.length : ''}）` : 'すべて表示';
  $('fb-mode-hint').textContent = fbAction === 'hide' ? '押した位置を隠します。点線の丸を押すと戻ります' : fbAction === 'pick' ? '押した音を選びます。Shapes の「検索」に推測したコードが出ます' : '';
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
      return `<button class="deg-btn ${d === st.diat ? 'on' : ''}" data-d="${d}"><b>${romanOf(SCALES[st.scale].iv, d)}</b><small>${diatonicRootName(set, SCALES[st.scale].iv, d, c.root)}${chordNameFor(c.semis)}</small></button>`;
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
    if (st.diat >= 0 && scaleLen() === 7) { const c = diatonic(st.root, SCALES[st.scale].iv, st.diat, st.seventh); t += ` ／ ${romanOf(SCALES[st.scale].iv, st.diat)}（${diatonicRootName(set, SCALES[st.scale].iv, st.diat, c.root)}${chordNameFor(c.semis)}）`; }
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
  const rootNow = pb.on && pb.chord && st.mode === 'scale' ? pb.chord.root : st.root;
  const W = 1180, padL = 40, padR = 14, top = 22, gap = 28, H = top * 2 + gap * (n - 1);
  // minus frets stretch the board to the left; K counts the extra wires (the nut region needs one more)
  const M = minusMax(), K = M > 0 ? M + 1 : 0, p2 = Math.pow(2, K / 12);
  const len = (W - padL - padR) / (p2 - Math.pow(2, -F / 12));
  const raw = f => padL + len * (p2 - Math.pow(2, -f / 12));
  const X = x => st.lefty ? W - x : x;
  const fx = f => X(raw(f));
  const cx = f => f === 0 && !K ? X(padL - 13) : X((raw(f) + raw(f - 1)) / 2);
  const midY = top + gap * (n - 1) / 2;
  let svg = `<svg viewBox="0 0 ${W} ${H + 18}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${titleFor(set)} の指板">`;
  svg += `<rect width="${W}" height="${H + 18}" fill="var(--fb-bg)"/>`;
  svg += `<rect x="${Math.min(X(padL), X(W - padR))}" y="${top - 10}" width="${W - padL - padR}" height="${gap * (n - 1) + 20}" fill="var(--fb-area)"/>`;
  if (K) for (let i = 0; i < n; i++) {   // strings without that many minus frets start further right
    const x1 = raw(-(minusOf(n - 1 - i) + 1)); if (x1 - raw(-K) < 1) continue;
    svg += `<rect x="${Math.min(X(raw(-K)), X(x1))}" y="${top + gap * i - gap / 2}" width="${x1 - raw(-K)}" height="${gap}" fill="var(--fb-bg)"/>`;
  }
  if (st.range === 'frets' && !sh) {
    const lo = Math.min(st.from, st.to), hi = Math.max(st.from, st.to);
    const x0 = lo === 0 ? raw(0) - 26 : raw(lo - 1), x1 = raw(hi);
    svg += `<rect x="${Math.min(X(x0), X(x1))}" y="${top - 10}" width="${Math.abs(X(x1) - X(x0))}" height="${gap * (n - 1) + 20}" fill="var(--accent1)" fill-opacity=".10"/>`;
  }
  [3, 5, 7, 9, 15, 17, 19, 21, 27].filter(f => f <= F).forEach(f => svg += `<circle cx="${cx(f)}" cy="${midY}" r="4" fill="var(--fb-inlay)"/>`);
  [12, 24].filter(f => f <= F).forEach(f => svg += `<circle cx="${cx(f)}" cy="${midY - gap}" r="4" fill="var(--fb-inlay)"/><circle cx="${cx(f)}" cy="${midY + gap}" r="4" fill="var(--fb-inlay)"/>`);
  for (let f = 0; f <= F; f++) svg += `<line x1="${fx(f)}" y1="${top - 10}" x2="${fx(f)}" y2="${top + gap * (n - 1) + 10}" stroke="${f === 0 ? 'var(--fb-nut)' : 'var(--fb-fret)'}" stroke-width="${f === 0 ? 4 : 1.2}"/>`;
  for (let f = 1; f <= M; f++) svg += `<text x="${cx(-f)}" y="${H + 12}" fill="var(--text3)" font-size="10" text-anchor="middle" font-family="Barlow">−${f}</text>`;
  for (let f = 1; f <= F; f++) if ([1, 3, 5, 7, 9, 12, 15, 17, 19, 21, 24, 27].includes(f)) svg += `<text x="${cx(f)}" y="${H + 12}" fill="var(--text3)" font-size="10" text-anchor="middle" font-family="Barlow">${f}</text>`;
  let dots = '', hits = '', count = 0;
  const showHidden = fbAction === 'hide' || chipAction === 'hide';
  for (let i = 0; i < n; i++) {
    const s = n - 1 - i, y = top + gap * i, open = tun[s], on = st.strOn[s];
    // the 1st string (top) is the thinnest, the lowest string the thickest
    const mi = minusOf(s), xs = K ? fx(-(mi + 1)) : fx(0);
    for (let f = 1; f <= mi + 1 && K; f++) svg += `<line x1="${fx(-f)}" y1="${y - gap / 2}" x2="${fx(-f)}" y2="${y + gap / 2}" stroke="var(--fb-fret)" stroke-width="1.2"/>`;
    svg += `<line x1="${xs}" y1="${y}" x2="${X(W - padR)}" y2="${y}" stroke="${on ? 'var(--fb-str)' : 'var(--fb-inlay)'}" stroke-width="${(0.7 + i * 0.28).toFixed(2)}"/>`;
    svg += `<text x="${X(padL - 30)}" y="${y + 3.5}" fill="${on ? 'var(--fb-nut)' : 'var(--fb-fret)'}" font-size="11" text-anchor="middle" font-family="Barlow" font-weight="600">${set.name(open)}</text>`;
    for (let f = -mi; f <= F; f++) {
      const m = open + f, p = pc(m), x = cx(f);
      hits += `<rect class="fb-hit" data-m="${m}" data-c="${s}:${f}" x="${Math.min(f === 0 && !K ? X(padL - 26) : fx(f - 1), f === 0 && !K ? X(padL) : fx(f))}" y="${y - gap / 2}" width="${Math.abs(f === 0 && !K ? 26 : raw(f) - raw(f - 1))}" height="${gap}"><title>${set.note(m)}</title></rect>`;
      if (!set.has(p) && !(sh && inShape.has(s + ':' + f))) continue;
      const hidden = isHiddenCell(s, f) || isHiddenIv(set, p);
      const visible = vis(s, f) && !hidden;
      if (hidden) { if (showHidden && vis(s, f)) dots += `<circle cx="${x}" cy="${y}" r="9.5" fill="none" stroke="var(--text3)" stroke-width="1.2" stroke-dasharray="2.5 2.5"/>`; continue; }
      if (!visible && !(st.ghost && on)) continue;
      if (visible) count++;
      const isRoot = sh ? p === pc(shC.root) : st.mode !== 'notes' && p === pc(rootNow), isEm = emph.includes(p);
      const op = visible ? 1 : 0.16;
      const lbl = st.label === 'none' ? '' : shC && inShape.has(s + ':' + f) ? toneOf(shC, m) : st.label === 'interval' ? (set.intervalOf(p) || '') : st.label === 'degree' ? String(set.info(p) ? set.info(p).index + 1 : '') : set.name(p);
      const fs = lbl.length > 2 ? 8 : 10;
      if (isRoot) dots += `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="10.5" fill="var(--accent3)"/><text x="${x}" y="${y + 3.6}" fill="var(--on-green)" font-size="${fs}" font-weight="700" text-anchor="middle" font-family="Barlow">${lbl}</text></g>`;
      else if (isEm) dots += `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="10.5" fill="var(--accent1)"/><text x="${x}" y="${y + 3.6}" fill="var(--on-accent)" font-size="${fs}" font-weight="700" text-anchor="middle" font-family="Barlow">${lbl}</text></g>`;
      else dots += `<g opacity="${op}"><circle cx="${x}" cy="${y}" r="10" fill="var(--fb-bg)" stroke="var(--accent2)" stroke-width="1.6"/><text x="${x}" y="${y + 3.4}" fill="var(--accent2-text)" font-size="${lbl.length > 2 ? 7.5 : 9}" font-weight="600" text-anchor="middle" font-family="Barlow">${lbl}</text></g>`;
      const ord = order[s + ':' + f];
      if (visible && ord) dots += `<circle cx="${x + 10}" cy="${y - 10}" r="6.5" fill="var(--note-bg)"/><text x="${x + 10}" y="${y - 7.3}" fill="var(--note-fg)" font-size="8" font-weight="700" text-anchor="middle" font-family="Barlow">${ord}</text>`;
    }
  }
  // picked notes for the chord finder (any pitch, drawn on top)
  picks.forEach(k => {
    const [s, f] = k.split(':').map(Number); if (s >= n || f > F || f < -minusOf(s)) return;
    const x = cx(f), y = top + gap * (n - 1 - s);
    dots += `<circle cx="${x}" cy="${y}" r="11.5" fill="var(--note-bg)" stroke="var(--note-bg)" stroke-width="1.5"/><text x="${x}" y="${y + 3.6}" fill="var(--note-fg)" font-size="9" font-weight="700" text-anchor="middle" font-family="Barlow">${set.name(tun[s] + f)}</text>`;
  });
  if (sh) sh.muted.forEach(s => { const y = top + gap * (n - 1 - s); dots += `<text x="${cx(0)}" y="${y + 4}" fill="#f87171" font-size="12" text-anchor="middle" font-family="Barlow" font-weight="700">×</text>`; });
  svg += '<g id="fb-glow" class="fb-glow"></g>' + dots + hits + '</svg>';
  $('fretboard').innerHTML = svg;
  fbGeom = { cx, Y: s => top + gap * (n - 1 - s) };
  $('fb-live').setAttribute('viewBox', `0 0 ${W} ${H + 18}`);
  $('fb-title').textContent = titleFor(set) + (pb.on && pb.chord && st.mode === 'scale' ? ` ／ ${pb.chord.label}` : '') + (sh ? ` ／ ${sh.name}・${sh.title}` : '');
  $('fretboard').classList.toggle('hide-mode', fbAction === 'hide');
  return count;
}

// ── live tuner: pitch from the input → note, cents and a moving dot on the fretboard ──
let fbGeom = null;
const live = { level: 0, gap: false, on: false, hist: [], midi: null, near: null, pend: null, hand: null, lastT: 0, prim: null, pos: null, since: 0, trail: [], raf: 0, prevT: 0 };
const chordHist = []; let chordT = 0; const chordLive = { notes: [], root: null, t: -1e9 };
function onChordFrame(fr) {
  const now = performance.now();
  if (!fr.notes.length) { if (now - chordT > 1500) $('tn-chord').classList.add('idle'); return; }
  chordT = now; chordHist.push(fr.notes); if (chordHist.length > 5) chordHist.shift();
  if (chordHist.length < 3) return;
  const cnt = new Map(); chordHist.forEach(a => a.forEach(m => cnt.set(m, (cnt.get(m) || 0) + 1)));
  const need = Math.ceil(chordHist.length * 0.6), stable = [...cnt].filter(([, c]) => c >= need).map(([m]) => m).sort((a, b) => a - b);
  $('tn-chord').classList.remove('idle');
  const res = identifyChord(stable), set = res.results[0] ? res.results[0].set : currentSet();
  chordLive.notes = stable; chordLive.root = res.results[0] ? pc(res.results[0].root) : pc(stable[0]); chordLive.t = performance.now();
  quizChord(stable);
  const seen = new Set();
  $('tn-chord-notes').innerHTML = stable.map(m => `<span class="pick-note">${set.name(m)}<small>${Math.floor(m / 12) - 1}</small></span>`).join('') || '<span class="hint">音がはっきりしません</span>';
  let html = '';
  if (res.kind === 'single') html = '<p class="hint">1音だけ聞こえています。</p>';
  else if (res.kind === 'dyad') html = `<p class="hint">2音（${res.interval || ''}）です。低い方をルートとして読んでいます。${res.results[0] ? '' : ''}</p>` + res.results.map(r => `<div class="fd-item top"><b>${r.name}</b><button class="std small fd-go" data-root="${r.root}" data-id="${r.id}">このコードの形を見る</button></div>`).join('');
  else if (res.kind === 'chord') html = res.results.length
    ? res.results.slice(0, 4).map((r, i) => { const uniq = stable.filter(m => { const k = pc(m); if (seen.has(k + ':' + i)) return false; seen.add(k + ':' + i); return true; });
        return `<div class="fd-item ${i === 0 ? 'top' : ''}"><b>${r.name}</b><span>${uniq.map(x => `${r.set.name(x)}<small>${(r.set.intervalOf(x) || '?').replace(/^1$/, 'R')}</small>`).join(' ')}</span><button class="std small fd-go" data-root="${r.root}" data-id="${r.id}">このコードの形を見る</button></div>`; }).join('')
    : '<p class="hint">登録しているコードの形には当てはまりませんでした。</p>';
  $('tn-chord-res').innerHTML = html;
}
const listener = new PitchListener(fr => {
  const now = performance.now(); live.level = fr.level || 0;
  recordFrame(fr, now);
  if (fr.freq) {
    if (now - live.lastT > 250) { live.hist = []; live.gap = true; }   // a fresh attack: do not mix it with the old note
    live.hist.push(69 + 12 * Math.log2(fr.freq / tnA4())); if (live.hist.length > 5) live.hist.shift();
    const h = live.hist.slice().sort((x, y) => x - y); live.midi = h[h.length >> 1]; live.lastT = now;
  } else if (now - live.lastT > 400) live.hist = [];
}, onChordFrame);
// ── played notes history + scale estimate ──
const tnHist = []; const rec = { cand: null, n: 0, cur: null, silentAt: 0, gapped: false }; let histEst = false;
function recordFrame(fr, now) {
  if (!fr.freq) { rec.cand = null; rec.n = 0; if (!rec.silentAt) rec.silentAt = now; return; }
  if (rec.silentAt) { if (now - rec.silentAt > 250) rec.gapped = true; rec.silentAt = 0; }
  const r = Math.round(69 + 12 * Math.log2(fr.freq / tnA4()));
  if (r === rec.cand) rec.n++; else { rec.cand = r; rec.n = 1; }
  if (rec.n >= 5 && (r !== rec.cur || rec.gapped)) {      // steady for ~50 ms: a played note
    rec.cur = r; rec.gapped = false;
    tnHist.push(r); if (tnHist.length > 200) tnHist.shift();
    quizPlayed(r);
    renderHist();
  }
}
function renderHist() {
  const set = currentSet(), shown = tnHist.slice(-64);
  $('tn-hist-notes').textContent = shown.map(m => set.name(m)).join('  ') || '—';
  const box = $('tn-hist-notes'); box.scrollLeft = box.scrollWidth;
  $('tn-hist-n').textContent = tnHist.length ? `${tnHist.length}音` : '';
  $('th-play').disabled = !tnHist.length; $('th-clear').disabled = !tnHist.length; $('th-est').disabled = tnHist.length < 3;
  if (histEst) renderEstimate();
}
// how well each scale explains the played notes: share of notes inside it (outliers from detection errors are tolerated)
function estimateScales() {
  const cnt = Array(12).fill(0); tnHist.forEach(m => cnt[pc(m)]++);
  const total = tnHist.length, top = cnt.indexOf(Math.max(...cnt)), first = pc(tnHist[0]);
  const out = [];
  for (let r = 0; r < 12; r++) for (const [id, sc] of Object.entries(SCALES)) {
    const semis = sc.iv.map(n => pc(parseInterval(n).semis)), inSet = new Set(semis.map(x => pc(r + x)));
    let inside = 0; for (let p = 0; p < 12; p++) if (inSet.has(p)) inside += cnt[p];
    const fit = inside / total; if (fit < 0.85) continue;
    const used = [...inSet].filter(p => cnt[p] > 0).length;
    const score = fit * 100 - inSet.size * 1.2 + sc.pop * 2.2 + (r === top ? 5 : 0) + (r === first ? 2 : 0) + (cnt[r] > 0 ? 2 : 0) + used * 0.3;
    out.push({ root: r, id, fit, score, size: inSet.size, used, miss: [...inSet].filter(p => !cnt[p]).length });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}
function renderEstimate() {
  const box = $('tn-scales');
  if (tnHist.length < 6) { box.innerHTML = `<p class="hint" style="grid-column:1/-1">あと ${6 - tnHist.length} 音以上弾くと、推定できます。</p>`; return; }
  const res = estimateScales();
  if (!res.length) { box.innerHTML = '<p class="hint" style="grid-column:1/-1">当てはまるスケールが見つかりませんでした。</p>'; return; }
  box.innerHTML = res.map((x, i) => { const sp = makeSet(x.root, SCALES[x.id].iv); return `<div class="fd-item sc-item ${i === 0 ? 'top' : ''}"><b>${sp.name(x.root)} ${SCALES[x.id].name}</b>
      <span class="sc-meta">弾いた音の ${Math.round(x.fit * 100)}% が一致 · ${x.size}音中 ${x.used}音を使用</span>
      <div class="row"><button class="std small sc-go" data-root="${x.root}" data-id="${x.id}">Show をこのスケールにする</button><button class="std small play-btn sc-play" data-root="${x.root}" data-id="${x.id}" title="このスケールを再生" aria-label="スケールを再生">▶ 再生</button></div></div>`; }).join('');
}
function scaleResultClick(e) {
  const pv = e.target.closest('.sc-play');
  if (pv) { playScalePreview(+pv.dataset.root, SCALES[pv.dataset.id].iv); return; }
  const g = e.target.closest('.sc-go'); if (!g) return;
  shapeOverride = null;
  update(() => { st.mode = 'scale'; st.root = +g.dataset.root; st.scale = g.dataset.id; st.diat = -1; st.emph = [0]; st.pattern = 0; });
  notify('Show をそのスケールにしました');
}
function bindHist() {
  $('th-play').addEventListener('click', () => playNotes(tnHist.slice(-48), 0.22, 0.42));
  $('th-clear').addEventListener('click', () => { tnHist.length = 0; histEst = false; $('tn-scales').innerHTML = ''; renderHist(); });
  $('th-est').addEventListener('click', () => { histEst = true; renderEstimate(); });
  $('tn-scales').addEventListener('click', scaleResultClick);
  renderHist();
}
// ── strobe view: bands drift right when sharp and left when flat, and stand still when in tune ──
const strobe = { on: false, phase: 0, t: 0 };
function drawStrobe(t, cents, active) {
  const cv = $('tn-strobe'), dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
  if (!w) return;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  const dt = Math.min(100, t - (strobe.t || t)); strobe.t = t;
  if (active) strobe.phase += cents * 0.06 * dt / 1000;      // periods per second = 0.06 per cent
  const ok = active && Math.abs(cents) <= 5, rows = [1, 2, 4], P = 36, rh = h / rows.length;
  rows.forEach((mul, i) => {
    g.fillStyle = active ? cssVar(ok ? '--accent3' : '--accent2') : cssVar('--border2'); g.globalAlpha = active ? 0.9 - i * 0.12 : 1;
    const off = ((strobe.phase * mul) % 1 + 1) % 1 * P;
    for (let x = -P + off; x < w; x += P) g.fillRect(x, i * rh + 3, P / 2, rh - 6);
  });
  g.globalAlpha = 1;
  g.fillStyle = cssVar('--text'); g.globalAlpha = 0.4; g.fillRect(w / 2 - 0.5, 0, 1, h); g.globalAlpha = 1;
}
function tnView(v) {
  strobe.on = v === 'strobe';
  $('tn-single').classList.toggle('strobe', strobe.on); $('tn-strobe').hidden = !strobe.on;
  document.querySelectorAll('.tn-view').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  try { localStorage.setItem('gti-explorer:tnview', v); } catch (e) {}
  if (strobe.on) drawStrobe(performance.now(), 0, false);
}
function tnA4() { return clampInt(parseFloat($('tn-a4').value), 400, 480, 440); }
function renderTunerStrings() {
  const tun = tuning(), set = currentSet(), n = tun.length;
  $('tn-strings').innerHTML = tun.map((m, s) => `<div class="tn-str" data-s="${s}"><small>${n - s}弦</small><b>${set.name(m)}</b><small class="tn-d"></small></div>`).join('');
}
function tunerReadout(active, m) {
  const set = currentSet(), tun = tuning(), el = $('tn-note');
  const strs = [...$('tn-strings').children];
  if (!active) { $('tn-needle').classList.remove('on', 'ok'); el.classList.remove('ok'); strs.forEach(c => { c.classList.remove('near', 'ok'); c.querySelector('.tn-d').textContent = ''; }); return; }
  const near = Math.round(m), cents = (m - near) * 100, ok = Math.abs(cents) <= 5;
  el.innerHTML = `${set.name(near)}<small>${Math.floor(near / 12) - 1}</small>`; el.classList.toggle('ok', ok);
  $('tn-hz').textContent = (tnA4() * Math.pow(2, (m - 69) / 12)).toFixed(1) + ' Hz';
  $('tn-cents').textContent = (cents >= 0 ? '+' : '−') + Math.abs(cents).toFixed(0) + ' ¢';
  const nd = $('tn-needle'); nd.classList.add('on'); nd.classList.toggle('ok', ok); nd.style.left = (50 + Math.max(-50, Math.min(50, cents))) + '%';
  // which open string is being tuned: the closest one within a minor third
  let best = -1, bd = 1e9; tun.forEach((t, s) => { const d = Math.abs(m - t); if (d < bd) { bd = d; best = s; } });
  strs.forEach((c, s) => {
    const d = (m - tun[s]) * 100, isNear = s === best && bd <= 1.5;
    c.classList.toggle('near', isNear); c.classList.toggle('ok', isNear && Math.abs(d) <= 5);
    c.querySelector('.tn-d').textContent = isNear ? (d >= 0 ? '+' : '−') + Math.abs(d).toFixed(0) + '¢' : '';
  });
}
// Glow for a list of places { x, y, root }: green for the root, sky blue otherwise
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#888';
function glowSvg(items, fade, t) {
  const breathe = 0.65 + 0.35 * Math.sin(t / 260);
  let g = `<defs><filter id="lv-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4.5"/></filter><filter id="lv-glow2" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="1.6"/></filter></defs><g opacity="${fade.toFixed(2)}">`;
  items.forEach(c => {
    const hi = c.root ? 'var(--accent3)' : 'var(--accent2)', core = c.root ? '#c9f9dc' : '#bfe9fb', x = c.x.toFixed(1);
    g += `<circle cx="${x}" cy="${c.y}" r="14" fill="none" stroke="${hi}" stroke-width="7" filter="url(#lv-glow)" opacity="${(0.55 + 0.4 * breathe).toFixed(2)}"/>`;
    g += `<circle cx="${x}" cy="${c.y}" r="14" fill="none" stroke="${hi}" stroke-width="3" filter="url(#lv-glow2)" opacity="${(0.5 + 0.4 * breathe).toFixed(2)}"/>`;
    g += `<circle cx="${x}" cy="${c.y}" r="14" fill="none" stroke="${core}" stroke-width="1.6"/>`;
  });
  return g + '</g>';
}

const effKind = () => listener.mode === 'auto' ? listener.kind : listener.mode;
// show the block that matches what is being heard; both blocks have the same height so nothing jumps
function showKind(kind) {
  const m = listener.mode;
  chordHist.length = 0; chordLive.notes = [];
  $('tn-chord').classList.toggle('idle', kind !== 'chord');
  $('tn-chord-res').innerHTML = '';
  $('tn-chord-notes').innerHTML = m === 'single' ? '<span class="hint">単音モードです。コードは認識しません。</span>' : '<span class="hint">コードを鳴らすと、聞こえた音とコード名の候補を出します。</span>';
  $('fb-live').innerHTML = '';
  live.near = null; live.pend = null; live.prim = null; live.pos = null; live.trail = []; live.sincePitch = null;
}

function liveFrame(t) {
  live.raf = requestAnimationFrame(liveFrame);
  const dt = Math.min(100, t - (live.prevT || t)); live.prevT = t;
  const active = live.midi !== null && t - live.lastT < 350;
  if (!active && t - live.lastT > 1500) { tunerReadout(false); }
  const layer = $('fb-live');
  if (active) tunerReadout(true, live.midi);
  if (strobe.on) drawStrobe(t, active ? (live.midi - Math.round(live.midi)) * 100 : 0, active);
  $('tn-level').style.width = (live.on ? Math.max(0, Math.min(100, (20 * Math.log10(Math.max(live.level || 0, 1e-5)) + 60) / 60 * 100)) : 0).toFixed(0) + '%';
  if (effKind() === 'chord') {
    // every place that gives any of the heard notes; the root of the best reading is green
    const age = t - chordLive.t, fadeC = age < 2000 ? 1 : Math.max(0, 1 - (age - 2000) / 800);
    if (!$('tn-show').checked || !fbGeom || !chordLive.notes.length || fadeC <= 0) { layer.innerHTML = ''; return; }
    const tunC = tuning(), items = [];
    chordLive.notes.forEach(m => tunC.forEach((open, s) => { const f = m - open; if (st.strOn[s] && f >= -minusOf(s) && f <= st.frets) items.push({ x: fbGeom.cx(f), y: fbGeom.Y(s), root: chordLive.root !== null && pc(m) === chordLive.root }); }));
    layer.innerHTML = items.length ? glowSvg(items, fadeC, t) : ''; return;
  }
  if (!$('tn-show').checked || !fbGeom || live.midi === null) { layer.innerHTML = ''; return; }
  const tun = tuning(), n = tun.length;
  // commit a new note only when it has been steady for ~40 ms (skips pluck noise and half-way readings)
  const rnd = Math.round(live.midi);
  if (live.near === null || live.gap) { live.near = rnd; live.pend = null; live.gap = false; }   // first reading of a new attack shows at once; later readings still have to hold
  else if (rnd !== live.near && Math.abs(live.midi - live.near) > 0.65) {
    if (!live.pend || live.pend.n !== rnd) live.pend = { n: rnd, t };
    else if (t - live.pend.t >= 40) { live.near = rnd; live.pend = null; }
  } else live.pend = null;
  const near = live.near;
  const fade = active ? 1 : Math.max(0, 1 - (t - live.lastT - 350) / 600);
  if (fade <= 0) { layer.innerHTML = ''; return; }
  const cands = []; for (let s = 0; s < n; s++) { const f = near - tun[s]; if (st.strOn[s] && f >= -minusOf(s) && f <= st.frets) cands.push({ s, f }); }
  if (!cands.length) { layer.innerHTML = ''; return; }
  // The same pitch can sit at several places, so every place that gives it glows the same way
  const isRoot = st.mode !== 'notes' && pc(near) === pc(st.root);
  const g = glowSvg(cands.map(c => ({ x: fbGeom.cx(c.f), y: fbGeom.Y(c.s), root: isRoot })), fade, t);
  layer.innerHTML = g;
}
async function tunerStart() {
  const msg = $('tn-msg');
  try {
    await listener.start($('tn-device').value);
  } catch (e) {
    msg.textContent = e && e.name === 'NotAllowedError' ? '入力（マイク）の使用が許可されていません。ブラウザのアドレスバーの設定から、このページのマイク入力を許可してください。'
      : e && e.name === 'NotFoundError' ? '入力デバイスが見つかりません。オーディオインターフェースやマイクの接続を確認してください。' : '入力を開始できませんでした：' + (e && e.message || e);
    return;
  }
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput'), cur = $('tn-device').value;
    $('tn-device').innerHTML = '<option value="">既定の入力</option>' + devs.map(d => `<option value="${d.deviceId}">${(d.label || '入力デバイス').replace(/</g, '&lt;')}</option>`).join('');
    $('tn-device').value = devs.some(d => d.deviceId === cur) ? cur : '';
  } catch (e) {}
  live.on = true; live.gap = false; live.hist = []; live.sincePitch = null; live.midi = null; live.near = null; live.pend = null; live.hand = null; live.prim = null; live.pos = null; live.trail = []; live.lastT = -1e9;
  $('tn-toggle').classList.add('on'); $('tn-toggle').setAttribute('aria-pressed', 'true'); $('tn-toggle-label').textContent = 'ギター入力をオフにする';
  $('tn-status').classList.add('on'); $('tn-state').textContent = '入力中';
  msg.textContent = '';
  cancelAnimationFrame(live.raf); live.prevT = 0; live.raf = requestAnimationFrame(liveFrame);
}
async function tunerStop() {
  cancelAnimationFrame(live.raf); live.on = false; live.midi = null;
  await listener.stop(); $('fb-live').innerHTML = ''; tunerReadout(false);
  $('tn-note').textContent = '—'; $('tn-hz').textContent = '— Hz'; $('tn-cents').textContent = '—';
  $('tn-toggle').classList.remove('on'); $('tn-toggle').setAttribute('aria-pressed', 'false'); $('tn-toggle-label').textContent = 'ギター入力をオンにする';
  $('tn-status').classList.remove('on'); $('tn-state').textContent = '停止中'; $('tn-level').style.width = '0%';
  $('tn-msg').textContent = 'ギター入力をオンにして、ギターを弾いてください。音声はこのページの中で処理するだけで、どこにも送られません。';
  $('tn-chord').classList.add('idle');
}

function renderMetrics(set, count) {
  const tun = tuning();
  $('m-target').textContent = titleFor(set);
  $('m-notes').textContent = set.ivs.map(iv => set.name(set.root + iv.semis)).join(' ');
  $('m-tuning').textContent = (st.tuning === 'custom' ? 'カスタム' : (findTuning(st.inst, st.strings, st.tuning) || {}).name) + ` · ${st.strings}弦`;
  $('m-open').textContent = tun.slice().reverse().map(m => set.name(m)).join(' ');
  const lo = Math.min(st.from, st.to), hi = Math.max(st.from, st.to);
  $('m-range').textContent = selectedShape() ? selectedShape().title : st.range === 'frets' ? `${lo}〜${hi}フレット` : st.range === 'pattern' ? `パターン ${st.pattern % scaleLen() + 1}` : `${minusMax() ? '−' + minusMax() : 0}〜${st.frets}フレット`;
  $('m-count').innerHTML = `${count}<span class="metric-unit">か所</span>`;
}

// ── shapes: chord forms / string sets / sweeps / search ──
function computeShapes() {
  const c = shapeChord(); if (!c || st.shapeTab === 'search') return [];
  const tun = tuning(), n = tun.length, F = st.frets, rootPc = pc(c.root), name = m => c.set.name(m);
  const fromFrets = (frets, title, meta) => {
    const cells = [], muted = [];
    frets.forEach((f, s) => f === null ? muted.push(s) : cells.push({ s, f }));
    // chord tones written high string → low string to match the diagram (1st string on top)
    const tones = frets.map((f, s) => f === null ? '×' : toneOf(c, tun[s] + f)).reverse().join(' ');
    return { title, meta, cells, muted, tones, name: chordNameWithBass(c, Math.min(...cells.map(x => tun[x.s] + x.f))), tab: frets.map(f => f === null ? 'x' : f).join(' '), play: cells.map(x => tun[x.s] + x.f), strum: true };
  };
  if (st.shapeTab === 'forms') {
    // registered forms first; any other chord gets forms derived from the basic shapes
    let list = c.id && FORMS[c.id] ? chordForms(tun, c.id, rootPc, F, c.pcs) : [];
    if (!list.length) list = derivedForms(tun, c.pcs, rootPc, F);
    return list.map(v => fromFrets(v.frets, v.name, `${v.name} · ${v.low ? v.low + '〜' + v.high + 'f' : '開放'}`));
  }
  if (st.shapeTab === 'sets') {
    const power = st.vo.kind === 'power', relOf = p => pc(p - c.root);
    let need = c.pcs.slice();
    // power-chord family: leave out the 3rd (or ♭3rd) and keep the root, the 5th and the colour tones
    if (power) need = need.filter(p => ![3, 4].includes(relOf(p)));
    // more than four tones: drop the 5th, then 9th, then 11th so the shape fits four strings
    // (the power family keeps its 5th and drops the colour tones instead)
    const order = power ? [2, 5, 1, 9, 10, 11] : [7, 2, 5, 1, 3];
    for (const drop of order) { if (need.length <= (power ? 3 : 4)) break; need = need.filter(p => relOf(p) !== drop); }
    const k = Math.min(st.vo.count || Math.max(need.length, power ? 3 : 0), n);
    voSets = [];
    if (need.length < 2 || k < need.length) return [];
    let list = findVoicings(tun, need, rootPc, Math.min(F, 19), { span: st.vo.span, minStrings: k, maxStrings: k, requireAll: true, allowOpen: st.vo.allowOpen, need, limit: 3000, noUnison: true });
    if (st.vo.easy) list = list.filter(v => playScore(v.frets).ok);
    const topOf = v => Math.max(...v.frets.map((f, s) => f === null ? -1 : s));
    // standard tuning labels use string numbers counted from the 1st string
    const labelOf = v => { const used = v.frets.map((f, s) => f === null ? null : s).filter(x => x !== null); return `${n - used[used.length - 1]}〜${n - used[0]}弦`; };
    list.forEach(v => v.strs = labelOf(v));
    voSets = [...new Set(list.slice().sort((x, y) => topOf(y) - topOf(x)).map(v => v.strs))];
    if (power) voSets.reverse();
    if (st.vo.range && voSets.includes(st.vo.range)) list = list.filter(v => v.strs === st.vo.range);
    // high string sets first (power-chord family: low strings first)
    list.sort((x, y) => (power ? topOf(x) - topOf(y) : topOf(y) - topOf(x)) || x.low - y.low);
    const fifth = c.cset.ivs.find(iv => [6, 7, 8].includes(iv.semis));
    const plain = need.length === 2 && fifth && fifth.semis === 7;
    return list.map(v => {
      const bass = Math.min(...v.frets.map((f, s) => f === null ? Infinity : tun[s] + f));
      const f = fromFrets(v.frets, v.strs, `${v.strs} · ${v.low || 0}〜${v.high}f`);
      if (power) { const rn = c.cset.name(c.root); f.name = (plain ? rn + '5' : c.sym + '（3度抜き）') + (pc(bass) === pc(c.root) ? '' : '/' + c.cset.name(bass)); }
      return f; });
  }
  if (st.shapeTab === 'sweep') {
    const sizes = st.sw.size ? [st.sw.size] : [9, 8, 7, 6, 5, 4, 3];
    let list = sweepShapes(tun, c.pcs, rootPc, Math.min(F, 24), { span: st.sw.span, sizes, rootStart: st.sw.rootStart, allowOpen: st.sw.allowOpen });
    if (st.sw.topOnly) list = list.filter(sw => sw.hi === n - 1);
    if (st.sw.notes) list = list.filter(sw => sw.notes.length === st.sw.notes);
    // how standard each shape is: inside a chord-form box, root start, regular two-note strings, compact
    const forms = (c.id && FORMS[c.id] ? chordForms(tun, c.id, rootPc, F, c.pcs) : []).concat(derivedForms(tun, c.pcs, rootPc, F));
    const boxes = forms.map(f => ({ low: f.low, high: f.high }));
    list.forEach(sw => { const r = sweepScore(sw, rootPc, boxes); sw.score = r.score; sw.common = r.common; });
    if (st.sw.common) list = list.filter(sw => sw.common);
    // treble side first, then the more standard shapes, then lower on the neck
    list.sort((x, y) => y.hi - x.hi || y.lo - x.lo || y.score - x.score || x.low - y.low);
    return list.map(sw => {
      const cells = sw.notes.map((x, i) => ({ s: x.s, f: x.f, order: i + 1 }));
      const tones = sw.notes.map(x => toneOf(c, x.m)).join(' → ');
      const strs = `${n - sw.hi}〜${n - sw.lo}弦`;
      return { std: sw.common, name: chordNameWithBass(c, sw.notes[0].m), title: `${sw.size}弦スウィープ（${strs}）`, meta: `${strs} · ${sw.notes.length}音 · ${sw.low}〜${sw.high}f · ${toneOf(c, sw.notes[0].m)} から`, cells, muted: [], tones,
        tab: sw.notes.map(x => `${n - x.s}弦${x.f}`).join(' '), play: sw.notes.map(x => x.m), strum: false };
    });
  }
  return [];
}
// Chord symbol for a shape; when the lowest note is not the root it becomes a slash chord
function chordNameWithBass(c, bassMidi) { return pc(bassMidi) === pc(c.root) ? c.sym : `${c.sym}/${c.cset.name(bassMidi)}`; }
function selectedShape() { return shapes && ssel >= 0 ? shapes[ssel] || null : null; }

// Small diagram of a shape: 1st string on top, a few frets around the shape
function thumb(item, c) {
  const tun = tuning(), n = tun.length;
  const fr = item.cells.map(x => x.f).filter(f => f > 0);
  const lo = fr.length ? Math.max(1, Math.min(...fr)) : 1, hi = Math.max(lo + 3, fr.length ? Math.max(...fr) : 4);
  const cols = hi - lo + 1, W = 18 + cols * 22 + 6, gap = 9, top = 8, H = top * 2 + gap * (n - 1) + 10;
  const x0 = 18, colX = f => x0 + (f - lo) * 22 + 11, Y = s => top + gap * (n - 1 - s);
  let g = `<svg class="thumb" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">`;
  for (let k = 0; k <= cols; k++) g += `<line x1="${x0 + k * 22}" y1="${top - 3}" x2="${x0 + k * 22}" y2="${top + gap * (n - 1) + 3}" stroke="${k === 0 && lo === 1 ? 'var(--text2)' : 'var(--border2)'}" stroke-width="${k === 0 && lo === 1 ? 2.5 : 1}"/>`;
  for (let s = 0; s < n; s++) g += `<line x1="${x0}" y1="${Y(s)}" x2="${x0 + cols * 22}" y2="${Y(s)}" stroke="var(--text3)" stroke-width="${(0.5 + (n - 1 - s) * 0.18).toFixed(2)}"/>`;
  item.muted.forEach(s => g += `<text x="9" y="${Y(s) + 3}" fill="#f87171" font-size="8" text-anchor="middle" font-family="Barlow" font-weight="700">×</text>`);
  item.cells.forEach(cell => {
    const m = tun[cell.s] + cell.f, isR = pc(m) === pc(c.root);
    const x = cell.f === 0 ? 9 : colX(cell.f), y = Y(cell.s);
    if (cell.f === 0) g += `<circle cx="${x}" cy="${y}" r="3.6" fill="none" stroke="${isR ? 'var(--accent3)' : 'var(--accent1)'}" stroke-width="1.4"/>`;
    else g += `<circle cx="${x}" cy="${y}" r="4.2" fill="${isR ? 'var(--accent3)' : 'var(--accent1)'}"/>`;
    if (cell.order) g += `<text x="${x}" y="${y + 2.4}" fill="var(--on-accent)" font-size="6" font-weight="700" text-anchor="middle" font-family="Barlow">${cell.order}</text>`;
  });
  g += `<text x="${x0 + 2}" y="${H - 1}" fill="var(--text3)" font-size="8" font-family="Barlow">${lo}f</text></svg>`;
  return g;
}

function renderShapes() {
  const c = shapeChord();
  $('shape-panel').hidden = false;
  // without a chord (single notes, 5/6/8-note scales) only the search tab works
  const tab = c ? st.shapeTab : 'search', search = tab === 'search';
  document.querySelectorAll('.shape-tab').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); b.disabled = !c && b.dataset.tab !== 'search'; });
  $('opts-search').hidden = !search; $('shape-list').hidden = search; $('shape-clear').hidden = search;
  $('opts-sweep').hidden = tab !== 'sweep'; $('opts-sets').hidden = tab !== 'sets';
  if (search) {
    $('shape-target').textContent = '指板で選んだ音';
    $('shape-count').textContent = '';
    $('shape-hint').textContent = '指板の上で音を押して選ぶと（もう一度押すと外れます）、何のコードになっているかを推測します。いちばん低い音をベースとして扱い、ルートと違う場合は分数コードで表示します。';
    renderFinder();
    return;
  }
  $('finder-results').innerHTML = ''; $('scale-finder').hidden = true;
  if (!shapes) shapes = computeShapes();
  $('shape-back').hidden = !c.override || pb.on;
  $('shape-target').textContent = c.label + (c.override && !pb.on ? '（検索から選んだコード）' : '') + '　構成音：' + c.cset.ivs.map(iv => `${c.cset.name(c.root + iv.semis)}(${iv.label === '1' ? 'R' : iv.label})`).join(' ') + (c.fromScale && st.diat < 0 && !c.override ? '　※ダイアトニックで選んだコードに切り替わります' : '');
  $('sets-span').value = st.vo.span; $('sets-open').checked = st.vo.allowOpen; $('sets-easy').checked = st.vo.easy;
  $('sets-kind').value = st.vo.kind; $('sets-count').value = String(st.vo.count);
  $('sets-range').innerHTML = '<option value="">すべて</option>' + voSets.map(x => `<option value="${x}">${x}</option>`).join('');
  $('sets-range').value = voSets.includes(st.vo.range) ? st.vo.range : '';
  $('sw-size').innerHTML = '<option value="0">すべて</option>' + [3, 4, 5, 6, 7, 8, 9].filter(k => k <= st.strings).map(k => `<option value="${k}">${k}弦</option>`).join('');
  $('sw-notes').value = st.sw.notes;
  $('sw-size').value = st.sw.size; $('sw-span').value = st.sw.span; $('sw-root').checked = st.sw.rootStart; $('sw-open').checked = st.sw.allowOpen; $('sw-top').checked = st.sw.topOnly; $('sw-common').checked = st.sw.common;
  const hints = {
    forms: (c.id && FORMS[c.id] ? '一般的なコードフォーム（E型・A型・D型・C型・G型など）を、いまのチューニングに置き直して並べています。' : 'このコードは定番フォームの登録がないため、E型・A型などの基本フォームの音を近いコードトーンへずらして作った形（変形）を並べています。') + '7・8弦では上の6本で作ります。',
    sets: st.vo.kind === 'power'
      ? `パワーコード系：3度（短3度）を抜いて、ルート・5度とあれば7度などの音だけで隣り合う弦に置いた形です。3本ならルート・5度・ルート（またはその転回）の形になり、低音弦側から並べています。「使う弦の本数」を増やすと、同じ音をオクターブで重ねた形も出ます。`
      : `転回形：隣り合う弦に構成音を重ねずに置いた形です。どの音が一番下・一番上に来るかの違いで並びます（3和音ならトライアドの転回形、4和音ならクローズやドロップ2・3の形）。「使う弦の本数」を音の数より増やすと、同じ音を重ねた形（たとえば3和音を2〜5弦の4本で）も出ます。高音弦側から並べています。${c.pcs.length > 4 ? '5音以上のコードは、5度・9度・11度の順に省いて4音にしています。' : ''}`,
    sweep: `コードトーンを順番に1弦1〜2音ずつ上がっていくスウィープの形です。高音弦側から並べ、同じ弦の範囲では一般的な形（コードフォームの範囲に収まる・ルートから始まる・幅が狭い）を先にしています。${st.sw.common ? '「一般的な形だけ」をオフにすると、ほかの形も出ます。' : ''}番号が弾く順番です。`
  };
  $('shape-hint').textContent = hints[st.shapeTab];
  const noForm = false;
  $('shape-count').textContent = noForm ? '' : shapes.length >= 300 ? '300件以上' : `${shapes.length}件`;
  const shown = shapes.slice(0, 240);
  $('shape-list').innerHTML = noForm
    ? '<p class="hint">このコードの定番フォームはまだ登録していません。「転回形」や「検索」を使ってください。</p>'
    : shown.map((v, i) => `<button class="vo-item ${i === ssel ? 'on' : ''}" data-i="${i}">${thumb(v, c)}<span class="vo-body"><span class="vo-name">${v.name}${v.std ? '<i class="std-tag">定番</i>' : ''}</span><span class="vo-tones">${v.tones}</span><span class="vo-meta">${v.meta}</span><span class="vo-tab">${v.tab}</span></span></button>`).join('')
      || '<p class="hint">条件に合う形が見つかりませんでした。条件をゆるめてみてください。</p>';
  if (shapes.length > shown.length) $('shape-list').insertAdjacentHTML('beforeend', `<p class="hint" style="grid-column:1/-1">ほか ${shapes.length - shown.length} 件。条件で絞り込んでください。</p>`);
  $('shape-clear').disabled = ssel < 0;
}

// ── scale finder (picked notes) ──
function renderScaleFinder(notes) {
  $('scale-finder').hidden = false;
  const bassName = notes.length ? currentSet().name(notes[0].m) : '';
  $('sc-root').innerHTML = `<option value="none">指定なし</option><option value="bass">最低音${bassName ? '（' + bassName + '）' : ''}</option>` + ROOT_LABELS.map((n, i) => `<option value="${i}">${n}</option>`).join('');
  $('sc-root').value = String(scRoot);
  const pcsN = new Set(notes.map(x => pc(x.m))).size;
  const root = scRoot === 'none' ? null : scRoot === 'bass' ? (notes.length ? pc(notes[0].m) : null) : +scRoot;
  if (pcsN < (root === null ? 3 : 2)) { $('scale-results').innerHTML = `<p class="hint">${root === null ? '3種類以上' : '2種類以上'}の音を選ぶと、それを含むスケールを推測します。</p>`; return; }
  const list = identifyScales(notes.map(x => x.m), root);
  if (!list.length) { $('scale-results').innerHTML = '<p class="hint">選んだ音をすべて含むスケールは見つかりませんでした。</p>'; return; }
  const shown = list.slice(0, 12);
  $('scale-results').innerHTML = shown.map((x, i) => `<div class="fd-item sc-item ${i === 0 ? 'top' : ''}"><b>${x.name}</b>
      <span class="sc-meta">${x.size}音中 ${x.picked}音が一致${x.exact ? '（すべて）' : ''} · ${SCALES[x.id].group}</span>
      ${x.missing.length ? `<span class="sc-miss">足りない音：<em>${x.missing.join(' ')}</em></span>` : ''}
      <div class="row"><button class="std small sc-go" data-root="${x.root}" data-id="${x.id}">Show をこのスケールにする</button><button class="std small play-btn sc-play" data-root="${x.root}" data-id="${x.id}" title="このスケールを再生" aria-label="スケールを再生">▶ 再生</button></div></div>`).join('')
    + (list.length > shown.length ? `<p class="hint">ほか ${list.length - shown.length} 件。ルートを指定すると絞り込めます。</p>` : '');
}

// ── chord finder (picked notes) ──
function renderFinder() {
  const tun = tuning();
  const notes = picks.map(k => { const [s, f] = k.split(':').map(Number); return { s, f, m: tun[s] + f }; }).filter(x => x.s < tun.length).sort((a, b) => a.m - b.m);
  const res = identifyChord(notes.map(x => x.m));
  const spellFor = res.results[0] ? res.results[0].set : currentSet();
  $('pick-notes').innerHTML = notes.map(x => `<span class="pick-note">${spellFor.name(x.m)}<small>${tun.length - x.s}弦 ${x.f}f</small></span>`).join('') || '<span class="hint">指板の上で音を押して選んでください（もう一度押すと外れます）。</span>';
  let html = '';
  if (res.kind === 'single') html = '<p class="hint">1音だけです。もう1音以上選ぶとコードを推測します。</p>';
  else if (res.kind === 'dyad') {
    // two notes: lower = root, read the upper one against the selected scale
    const lowN = notes[0].m, highN = notes.filter(x => pc(x.m) !== pc(lowN)).pop().m;
    const scale = st.mode === 'scale' ? { root: st.root, iv: SCALES[st.scale].iv } : null;
    const d = interpretDyad(lowN, highN, scale);
    const scaleName = scale ? `${makeSet(st.root, SCALES[st.scale].iv).name(st.root)} ${SCALES[st.scale].name}` : '';
    const card = (x, extra) => `<div class="fd-item ${extra || ''}"><b>${x.name}</b><span>${d.highName} は <em>${x.tone}</em>${x.kind ? '（' + x.kind + '）' : ''}</span><button class="std small fd-go" data-root="${d.root}" data-id="${x.id}">このコードの形を見る</button></div>`;
    html = `<p class="fd-lead"><b>${d.rootName}</b> をルートとすると、<b>${d.highName}</b> は ${d.interval}。` +
      (scale ? `${scaleName} では、${d.rootInScale ? `${d.rootName} は ${d.degree || 'スケール音'}` : `${d.rootName} はスケール外`}、${d.highInScale ? `${d.highName} はスケール音です。` : `${d.highName} はスケール外の音です。`}` : 'スケール表示にすると、そのスケールに合うコードで解釈します。') + '</p>';
    if (d.diatonic.length) html += `<p class="sec-sub fd-sub">ダイアトニックコード${d.degree ? '（' + d.degree + '）' : ''}</p>` + d.diatonic.map((x, i) => card(x, i === 0 ? 'top' : '')).join('');
    if (d.others.length) html += `<p class="sec-sub fd-sub">${scale ? 'ほかにスケールに合うコード' : '上の音を含むコード'}（${d.rootName} がルート）</p>` + d.others.map(x => card({ ...x, kind: '' })).join('');
    if (!d.diatonic.length && !d.others.length) html += '<p class="hint">このスケールの中では、この2音を含むコードが見つかりませんでした。</p>';
  }
  else if (res.kind === 'chord') html = res.results.length
    ? res.results.map((r, i) => {
        const seen = new Set(), uniq = notes.filter(x => { const k = pc(x.m); if (seen.has(k)) return false; seen.add(k); return true; });
        return `<div class="fd-item ${i === 0 ? 'top' : ''}"><b>${r.name}</b><span>${uniq.map(x => `${r.set.name(x.m)}<small>${(r.set.intervalOf(x.m) || '?').replace(/^1$/, 'R')}</small>`).join(' ')}</span><button class="std small fd-go" data-root="${r.root}" data-id="${r.id}">このコードの形を見る</button></div>`;
      }).join('')
    : '<p class="hint">登録しているコードの形には当てはまりませんでした。</p>';
  $('finder-results').innerHTML = html;
  $('pick-play').disabled = !notes.length; $('pick-clear').disabled = !notes.length;
  renderScaleFinder(notes);
}


function syncListenerRange() {
  // lowest sound the tuning (and its minus frets) can make; a few semitones below it is the floor of the pitch search
  const tun = tuning(); let low = Infinity; tun.forEach((m, s) => { low = Math.min(low, m - minusOf(s)); });
  listener.setLow(440 * Math.pow(2, (low - 5 - 69) / 12), low - 2);
}
function render() {
  renderControls();
  syncListenerRange();
  const set = currentSet();
  renderSetInfo(set);
  const count = renderFretboard();
  renderMetrics(set, count);
  renderShapes();
  renderTunerStrings();
  renderProg();
  drawNext();
}

// ── events ──
function bind() {
  $('root').innerHTML = ROOT_LABELS.map((n, i) => `<option value="${i}">${n}</option>`).join('');
  const groups = {}; Object.entries(SCALES).forEach(([id, s]) => (groups[s.group] = groups[s.group] || []).push(`<option value="${id}">${s.name}</option>`));
  $('scale').innerHTML = Object.entries(groups).map(([g, o]) => `<optgroup label="${g}">${o.join('')}</optgroup>`).join('');
  $('chord').innerHTML = Object.entries(CHORDS).map(([id, c]) => `<option value="${id}">${c.name}</option>`).join('');

  $('strings').addEventListener('change', e => update(() => { st.strings = +e.target.value; st.tuning = tuningsFor(st.inst, st.strings)[0].id; st.custom = tuningsFor(st.inst, st.strings)[0].notes.slice(); st.minus = Array(st.strings).fill(0); st.strOn = Array(st.strings).fill(true); st.hideCells = []; picks = []; }));
  document.querySelectorAll('.inst-btn').forEach(b => b.addEventListener('click', () => update(() => setInstrument(b.dataset.inst))));
  $('minus-grid').addEventListener('change', e => { const s = e.target.dataset.s; if (s === undefined) return; update(() => { st.minus[+s] = intIn(+e.target.value, 0, MAX_MINUS, 0); st.hideCells = st.hideCells.filter(c => +c.split(':')[1] >= 0); picks = picks.filter(c => +c.split(':')[1] >= -minusOf(+c.split(':')[0])); }, true); });
  $('tuning').addEventListener('change', e => update(() => { if (e.target.value === 'custom' && st.tuning !== 'custom') st.custom = tuning().slice(); st.tuning = e.target.value; }));
  $('custom-tuning').addEventListener('change', e => { const s = e.target.dataset.s; if (s === undefined) return; update(() => { st.custom[+s] = +e.target.value; }); });
  $('frets').addEventListener('change', e => update(() => { st.frets = +e.target.value; }));
  $('lefty').addEventListener('change', e => update(() => { st.lefty = e.target.checked; }, true));
  $('root-to-low').addEventListener('click', () => update(() => { st.root = pc(Math.min(...tuning())); }));
  document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => { shapeOverride = null; update(() => { st.mode = b.dataset.mode; }); }));
  $('shape-back').addEventListener('click', () => { shapeOverride = null; update(() => {}); });
  $('root').addEventListener('change', e => { shapeOverride = null; update(() => { st.root = +e.target.value; }); });
  $('scale').addEventListener('change', e => (shapeOverride = null, update(() => { st.scale = e.target.value; st.emph = [0]; st.diat = -1; st.pattern = 0; }), playScalePreview(st.root, SCALES[st.scale].iv)));
  $('scale-play').addEventListener('click', () => playScalePreview(st.root, SCALES[st.scale].iv));
  $('chord').addEventListener('change', e => { shapeOverride = null; update(() => { st.chord = e.target.value; }); });
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
  $('emph-chord').addEventListener('click', () => update(() => { st.diat = -1; st.emph = [0, 2, 4].filter(i => i < scaleLen()); }));
  $('emph-clear').addEventListener('click', () => update(() => { st.diat = -1; st.emph = []; }));
  $('diat').addEventListener('click', e => {
    const b = e.target.closest('.deg-btn'); if (!b) return; const d = +b.dataset.d;
    shapeOverride = null;
    update(() => { st.diat = st.diat === d ? -1 : d; });
    if (st.diat >= 0) { const c = diatonic(st.root, SCALES[st.scale].iv, d, st.seventh); playNotes(c.semis.map(s => 48 + c.root + s), 0.05, 1.2); }
  });
  $('seventh').addEventListener('change', e => update(() => { st.seventh = e.target.checked; }));

  // shapes
  document.querySelectorAll('.shape-tab').forEach(b => b.addEventListener('click', () => {
    const t = b.dataset.tab;
    if (t === 'search') fbAction = 'pick'; else if (fbAction === 'pick') fbAction = 'play';
    update(() => { st.shapeTab = t; });
  }));
  $('sc-root').addEventListener('change', e => { scRoot = e.target.value === 'none' || e.target.value === 'bass' ? e.target.value : +e.target.value; renderShapes(); });
  $('scale-results').addEventListener('click', scaleResultClick);
  $('finder-results').addEventListener('click', e => {
    const g = e.target.closest('.fd-go'); if (!g) return;
    fbAction = 'play';
    shapeOverride = { root: +g.dataset.root, id: g.dataset.id };
    update(() => { st.shapeTab = 'forms'; });
    notify('Shapes だけをそのコードに切り替えました（Show の設定と選んだ音はそのままです）');
  });
  const vo = (k, v) => update(() => { st.vo[k] = v; });
  $('sets-span').addEventListener('change', e => vo('span', +e.target.value));
  $('sets-open').addEventListener('change', e => vo('allowOpen', e.target.checked));
  $('sets-easy').addEventListener('change', e => vo('easy', e.target.checked));
  $('sets-kind').addEventListener('change', e => update(() => { st.vo.kind = e.target.value; st.vo.range = ''; }));
  $('sets-count').addEventListener('change', e => update(() => { st.vo.count = +e.target.value; st.vo.range = ''; }));
  $('sets-range').addEventListener('change', e => vo('range', e.target.value));
  const sw = (k, v) => update(() => { st.sw[k] = v; });
  $('sw-size').addEventListener('change', e => sw('size', +e.target.value));
  $('sw-notes').addEventListener('change', e => sw('notes', +e.target.value));
  $('sw-common').addEventListener('change', e => sw('common', e.target.checked));
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
  document.querySelectorAll('.fb-act').forEach(b => b.addEventListener('click', () => {
    fbAction = b.dataset.act;
    if (fbAction === 'pick' && st.shapeTab !== 'search') { update(() => { st.shapeTab = 'search'; }); $('shape-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    else render();
  }));
  $('pick-play').addEventListener('click', () => { const tun = tuning(); const ms = picks.map(k => { const [s, f] = k.split(':').map(Number); return tun[s] + f; }).sort((a, b) => a - b); playNotes(ms, 0.05, 1.4); });
  $('pick-clear').addEventListener('click', () => { picks = []; render(); });
  $('sw-top').addEventListener('change', e => update(() => { st.sw.topOnly = e.target.checked; }));
  // fretboard-wide actions
  $('fb-hide-all').addEventListener('click', () => {
    const set = currentSet(), tun = tuning(), cells = new Set(st.hideCells);
    tun.forEach((open, s) => { for (let f = -minusOf(s); f <= st.frets; f++) if (set.has(open + f)) cells.add(s + ':' + f); });
    fbAction = 'hide';
    update(() => { st.hideCells = [...cells]; }, true);
    notify('すべての音を隠しました。「押すと隠す」のまま、見せたい位置を押すと戻ります');
  });
  $('fb-show-all').addEventListener('click', () => update(() => { st.hideIv = []; st.hideCells = []; }, true));
  $('fb-deselect').addEventListener('click', () => { picks = []; ssel = -1; render(); });

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
    tun.forEach((open, s) => { for (let f = -minusOf(s); f <= st.frets; f++) if (set.has(open + f) && vis(s, f) && !isHiddenCell(s, f) && !isHiddenIv(set, pc(open + f))) list.add(open + f); });
    const up = [...list].sort((a, b) => a - b).slice(0, 48);
    if (!up.length) return notify('表示中の音がありません');
    playNotes(up.concat(up.slice(0, -1).reverse()), 0.17, 0.35);
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

// ── progression: chords / scales bar by bar, the fretboard follows ──
const progKey = () => pb.on && pb.snap ? pb.snap.root : st.root;
function progBars() {
  const key = progKey(), c = parseChordText(st.prog.chords, key), sc = parseScaleText(st.prog.scales, key);
  const longest = Math.max(c.bars.length, sc.bars.length), n = Math.min(MAX_BARS, longest);
  const bars = Array.from({ length: n }, (_, i) => ({ chords: c.bars.length ? c.bars[i % c.bars.length] : [], scales: sc.bars.length ? sc.bars[i % sc.bars.length] : [] }));
  return { bars, errors: [...c.errors, ...sc.errors], cut: longest > MAX_BARS, key };
}
const ROMAN_RE = /(^|[\s|｜,、])[b#♭♯]?(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(?![A-Za-z]{3,})/;
function renderProg() {
  const P = st.prog, r = progBars();
  if (!pb.on) pb.bars = r.bars;
  [['pg-chords', P.chords], ['pg-scales', P.scales]].forEach(([id, v]) => { if (document.activeElement !== $(id) && $(id).value !== v) $(id).value = v; });
  $('pg-bpm').value = P.bpm; $('pg-beats').value = P.beats; $('pg-loop').checked = P.loop; $('pg-count').checked = P.count; $('pg-click').checked = P.click;
  renderDrum(); $('pg-voice').value = P.voice; $('pg-style').value = P.style; $('pg-guide').value = P.guide; $('pg-follow').checked = P.follow;
  const sig = JSON.stringify([r.bars.map(b => [b.chords.map(c => c.label), b.scales.map(x => x.label)]), r.key]);
  if (sig !== pb.sig) {
    pb.sig = sig;
    { const n = r.bars.length; $('pg-bars').style.setProperty('--cols', n <= 8 ? Math.max(1, n) : [8, 6, 4].find(c => n % c === 0) || 8); }
    $('pg-bars').innerHTML = r.bars.map((b, i) => `<button class="pg-bar" data-i="${i}" title="この小節から再生"><small>${i + 1}</small><b>${b.chords.map(c => c.label).join(' ') || '—'}</b><em>${b.scales.map(x => x.label).join(' / ')}</em><i class="beatbar"></i></button>`).join('')
      || '<span class="hint">コード進行かスケール進行を入力してください。</span>';
  }
  const keyName = currentSet().name(r.key);
  const msg = $('pg-msg');
  msg.classList.toggle('err', !!r.errors.length);
  msg.textContent = r.errors.length ? `読み取れなかった表記：${r.errors.join('  ')}`
    : r.cut ? `${MAX_BARS}小節までを使います。`
    : ROMAN_RE.test(P.chords + ' ' + P.scales) ? `度数（I、V、vi など）は、キー ${keyName}（Show のルート）として読み取っています。` : '';
  $('pg-play').disabled = !r.bars.length && !pb.on;
  $('pg-play').classList.toggle('on', pb.on); $('pg-play').setAttribute('aria-pressed', String(pb.on));
  $('pg-play-label').textContent = pb.on ? '停止' : '再生';
  $('pg-play-ico').innerHTML = pb.on ? '<rect x="6" y="6" width="12" height="12" rx="1.5"/>' : '<path d="M7 4.5v15l13-7.5z"/>';
}
// the window of frets that fits the chord (nearest to where the hand was) or, with scales only, around the root
function pickWindow(ch, sc, dry) {
  const tun = tuning(), F = st.frets, cands = [];
  const add = (lo, hi, bonus) => { lo = Math.max(0, lo); hi = Math.min(F, Math.max(hi, lo + 4)); lo = Math.max(0, Math.min(lo, hi - 4)); cands.push({ lo, hi, bonus }); };
  if (ch) {
    const pcs = makeSet(ch.root, CHORDS[ch.id].iv).pcs;
    const forms = (FORMS[ch.id] ? chordForms(tun, ch.id, ch.root, F, pcs) : []).concat(derivedForms(tun, pcs, ch.root, F));
    forms.forEach(f => add(f.low ? f.low - 1 : 0, f.high + 1, 0));
  }
  const rp = pc((ch || sc).root);
  tun.forEach((open, s) => { for (let f = 0; f <= F; f++) if (pc(open + f) === rp) add(f - 1, f + 3, 2); });
  let best = null;
  cands.forEach(c => { const sc2 = Math.abs((c.lo + c.hi) / 2 - pb.prevCenter) + c.bonus; if (!best || sc2 < best.s) best = { s: sc2, c }; });
  if (!best) return [0, Math.min(F, 4)];
  if (!dry) pb.prevCenter = (best.c.lo + best.c.hi) / 2;
  return [best.c.lo, best.c.hi];
}
// the chord that comes next (the next chord of this bar, or the first of the next bar), for the dashed preview on the fretboard
function nextChordAfter(bi, ci) {
  const n = pb.bars.length, bar = pb.bars[bi]; if (!bar) return null;
  let nb = bi, nc = ci + 1;
  if (nc >= Math.max(1, bar.chords.length)) { nb = bi + 1; nc = 0; if (nb >= n) { if (!st.prog.loop) return null; nb = 0; } }
  const b2 = pb.bars[nb]; if (!b2 || !b2.chords.length) return null;
  const ch = b2.chords[Math.min(nc, b2.chords.length - 1)], cur = bar.chords[Math.min(ci, bar.chords.length - 1)];
  if (cur && cur.root === ch.root && cur.id === ch.id) return null;
  const sc = b2.scales.length ? b2.scales[Math.min(nc, b2.scales.length - 1)] : null;
  return { ch, sc, win: null };
}
function drawNext() {
  const L = $('fb-glow'); if (!L) return;
  if (!pb.on || !pb.next || !fbGeom) { L.innerHTML = ''; return; }
  const { ch, win } = pb.next, tun = tuning(), g = fbGeom, set = makeSet(ch.root, CHORDS[ch.id].iv), F = st.frets;
  const lo = win ? win[0] : 0, hi = win ? win[1] : F; let h = '';
  tun.forEach((open, sIdx) => { if (!st.strOn[sIdx]) return; for (let f = lo; f <= hi; f++) { const p = pc(open + f); if (!set.has(p)) continue;
    const col = p === pc(ch.root) ? 'var(--accent3)' : 'var(--accent2)';
    const cx = g.cx(f).toFixed(1), cy = g.Y(sIdx);
    h += `<circle cx="${cx}" cy="${cy}" r="21" fill="${col}" opacity=".75" filter="url(#nx-glow)"/><circle cx="${cx}" cy="${cy}" r="14" fill="${col}" filter="url(#nx-glow2)"/>`; } });
  // behind the notes; starts faint and brightens as the next chord comes closer (the animation is set back by the time already elapsed)
  const dur = Math.max(0.2, pb.chDur || 2), el = Math.max(0, Math.min(dur, (performance.now() - (pb.chT0 || performance.now())) / 1000));
  L.setAttribute('style', `animation-duration:${dur.toFixed(3)}s;animation-delay:${(-el).toFixed(3)}s`);
  L.innerHTML = '<defs><filter id="nx-glow" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="8"/></filter><filter id="nx-glow2" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="3.5"/></filter></defs>' + h;
}
function applyBar(bi, ci) {
  if (!pb.on || !pb.snap) return;
  const bar = pb.bars[bi]; if (!bar) return;
  const ch = bar.chords.length ? bar.chords[Math.min(ci, bar.chords.length - 1)] : null;
  const sc = bar.scales.length ? bar.scales[Math.min(ci, bar.scales.length - 1)] : null;
  if (!ch && !sc) return;
  pb.chord = ch; pb.scale = sc;
  pb.chT0 = performance.now(); pb.chDur = (st.prog.beats / Math.max(1, bar.chords.length)) * 60 / st.prog.bpm;
  pb.next = nextChordAfter(bi, ci);
  if (sc) { st.mode = 'scale'; st.root = sc.root; st.scale = sc.id; st.diat = -1; st.emph = ch ? [] : [0]; }
  else { st.mode = 'chord'; st.root = ch.root; st.chord = ch.id; }
  shapeOverride = ch ? { root: ch.root, id: ch.id } : null; shapes = null; ssel = -1;
  if (st.prog.follow) { const w = pickWindow(ch, sc); st.range = 'frets'; st.from = w[0]; st.to = w[1]; if (pb.next) pb.next.win = pickWindow(pb.next.ch, pb.next.sc, true); }
  else { st.range = pb.snap.range; st.from = pb.snap.from; st.to = pb.snap.to; }
  render();
}
function markBar(bi, beats, beatDur) {
  document.querySelectorAll('#pg-bars .pg-bar').forEach(b => {
    const on = +b.dataset.i === bi; b.classList.toggle('on', on);
    const bb = b.querySelector('.beatbar'); if (!bb) return;
    bb.style.transition = 'none'; bb.style.width = '0';
    if (on) { void bb.offsetWidth; bb.style.transition = `width ${(beats * beatDur).toFixed(3)}s linear`; bb.style.width = '100%'; }
  });
}
// the notes of one bar, in beats from the bar start: { b, d, n: [midi], v } (used for playback and for the MIDI file)
function barEvents(bar, beats, bassInst) {
  const P = st.prog, ev = [], k = Math.max(1, bar.chords.length), per = beats / k;
  bar.chords.forEach((c, j) => {
    const b0 = j * per, m = chordMidi(c, bassInst);
    if (P.style === 'off') return;
    if (bassInst) {
      if (P.style === 'root') ev.push({ b: b0, d: per * 0.95, n: [m.bass], v: 0.9 });
      else for (let b = 0; b < Math.max(1, Math.round(per)); b++) ev.push({ b: b0 + b, d: 0.9, n: [P.style === 'arp' && b % 2 ? m.body[0] : m.bass], v: 0.9 });
    } else if (P.style === 'root') ev.push({ b: b0, d: per * 0.95, n: [m.bass], v: 0.9 });
    else if (P.style === 'strum') ev.push({ b: b0, d: per * 0.95, n: m.all, v: 0.9 });
    else {
      const cnt = Math.max(1, Math.floor(per / 0.5)), seq = m.all.concat(m.all.slice(1, -1).reverse());
      for (let i = 0; i < cnt; i++) ev.push({ b: b0 + i * 0.5, d: 1.1, n: [seq[i % seq.length]], v: 0.85 });
    }
  });
  if (P.guide === 'root' && bar.scales.length) ev.push({ b: 0, d: 0.8, n: [guideNote(bar.scales[0].root, bassInst)], v: 0.6 });
  return ev;
}
function schedBar(bi, t, beatDur, beats) {
  const bar = pb.bars[bi]; if (!bar) return;
  const per = beats / Math.max(1, bar.chords.length);
  bar.chords.forEach((c, j) => { if (j > 0) player.at(t + j * per * beatDur, () => applyBar(bi, j)); });
  barEvents(bar, beats, st.inst === 'bass').forEach(e => audio.play(e.n, t + e.b * beatDur, e.d * beatDur, e.v));
}
const player = new Player(audio, {
  bars: () => pb.bars.length,
  opts: () => ({ bpm: st.prog.bpm, beats: st.prog.beats, clickOn: st.prog.click, drum: st.prog.drum, countIn: st.prog.count, loop: st.prog.loop }),
  sched: schedBar,
  onBar: (bi, countIn) => {
    if (!pb.on) return;
    if (countIn) { markBar(-1, 0, 0); $('pg-msg').classList.remove('err'); $('pg-msg').textContent = 'カウントイン…'; return; }
    $('pg-msg').textContent = '';
    applyBar(bi, 0); markBar(bi, st.prog.beats, 60 / st.prog.bpm);
  },
  onEnd: () => stopProg()
});
async function startProg(from = 0) {
  const r = progBars(); if (!r.bars.length) return;
  if (!pb.on) {
    pb.snap = { mode: st.mode, root: st.root, scale: st.scale, chord: st.chord, emph: st.emph.slice(), diat: st.diat, range: st.range, from: st.from, to: st.to, pattern: st.pattern, shape: shapeOverride, ssel };
    pb.prevCenter = st.range === 'frets' ? (st.from + st.to) / 2 : 5;
    pb.on = true;
  }
  pb.bars = r.bars;
  await player.start(from);
  renderProg();
}
function stopProg() {
  player.stop();
  if (pb.on && pb.snap) {
    const sn = pb.snap; Object.assign(st, { mode: sn.mode, root: sn.root, scale: sn.scale, chord: sn.chord, emph: sn.emph, diat: sn.diat, range: sn.range, from: sn.from, to: sn.to, pattern: sn.pattern });
    shapeOverride = sn.shape; shapes = null; ssel = -1;
  }
  pb.on = false; pb.snap = null; pb.chord = pb.scale = null; pb.next = null;
  document.querySelectorAll('#pg-bars .pg-bar').forEach(b => { b.classList.remove('on'); const bb = b.querySelector('.beatbar'); if (bb) { bb.style.transition = 'none'; bb.style.width = '0'; } });
  save(); render();
}
function bindProg() {
  const P = st.prog;
  $('pg-chords-pre').innerHTML = '<option value="">プリセット</option>' + CHORD_PRESETS.map((x, i) => `<option value="${i}">${x.name}</option>`).join('');
  $('pg-scales-pre').innerHTML = '<option value="">プリセット</option>' + SCALE_PRESETS.map((x, i) => `<option value="${i}">${x.name}</option>`).join('');
  $('pg-voice').innerHTML = Object.entries(VOICE_NAMES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  audio.setVoice(P.voice);
  const set = (fn, redraw = true) => { fn(); save(); if (redraw) renderProg(); };
  const live2 = () => { if (pb.on) { const r = progBars(); if (r.bars.length) pb.bars = r.bars; else stopProg(); } };
  $('pg-chords').addEventListener('input', e => set(() => { st.prog.chords = e.target.value; live2(); }));
  $('pg-scales').addEventListener('input', e => set(() => { st.prog.scales = e.target.value; live2(); }));
  $('pg-chords-pre').addEventListener('change', e => { const x = CHORD_PRESETS[+e.target.value]; e.target.value = ''; if (x) set(() => { st.prog.chords = x.text; live2(); }); });
  $('pg-scales-pre').addEventListener('change', e => { const x = SCALE_PRESETS[+e.target.value]; e.target.value = ''; if (x) set(() => { st.prog.scales = x.text; live2(); }); });
  $('pg-bpm').addEventListener('change', e => set(() => { st.prog.bpm = intIn(parseInt(e.target.value), 40, 220, st.prog.bpm); }));
  $('pg-beats').addEventListener('change', e => set(() => { const old = st.prog.beats; st.prog.beats = clampInt(parseFloat(e.target.value), 1, 16, old); st.prog.drum = drumBeats(st.prog.drum, old, st.prog.beats); }));
  [['pg-loop', 'loop'], ['pg-count', 'count'], ['pg-click', 'click'], ['pg-follow', 'follow']].forEach(([id, k]) => $(id).addEventListener('change', e => set(() => { st.prog[k] = e.target.checked; })));
  bindDrum(set);
  $('pg-voice').addEventListener('change', e => { set(() => { st.prog.voice = e.target.value; audio.setVoice(e.target.value); }); playNotes([52, 59, 64, 67], 0.05, 1.0); });
  $('pg-style').addEventListener('change', e => set(() => { st.prog.style = e.target.value; }));
  $('pg-guide').addEventListener('change', e => set(() => { st.prog.guide = e.target.value; }));
  $('pg-play').addEventListener('click', () => pb.on ? stopProg() : startProg(0));
  $('pg-bars').addEventListener('click', e => { const b = e.target.closest('.pg-bar'); if (!b) return; const i = +b.dataset.i; if (pb.on) player.jump(i); else startProg(i); });
  window.addEventListener('pagehide', () => { if (pb.on) stopProg(); });
  $('pg-midi').addEventListener('click', exportMidi);
  $('pg-share').addEventListener('click', copyShare);
  $('pg-png').addEventListener('click', () => exportBoard('png'));
  $('pg-pdf').addEventListener('click', () => exportBoard('pdf'));
}
const MIDI_PROGRAM = { piano: 0, guitar: 25, organ: 16, pad: 89, bass: 33 };
function exportMidi() {
  const r = progBars(); if (!r.bars.length) return notify('進行が空です。コード進行かスケール進行を入力してください');
  const P = st.prog, bassInst = st.inst === 'bass', TPB = 480, notes = [];
  r.bars.forEach((bar, i) => barEvents(bar, P.beats, bassInst).forEach(e => e.n.forEach((m, k) => notes.push({ tick: (i * P.beats + e.b) * TPB + (e.n.length > 1 ? k * 6 : 0), dur: e.d * TPB, midi: m, vel: e.v }))));
  const data = buildMidi({ bpm: P.bpm, beats: P.beats, program: bassInst ? 33 : MIDI_PROGRAM[P.voice] ?? 0, title: 'GTI Fretboard Explorer', notes });
  download(new Blob([data], { type: 'audio/midi' }), 'progression.mid');
  notify(`MIDI を書き出しました（${r.bars.length}小節・${P.bpm} BPM）`);
}
function shareUrl() {
  const P = st.prog, base = pb.on && pb.snap ? pb.snap : st;
  const obj = { v: 1, p: { chords: P.chords, scales: P.scales, bpm: P.bpm, beats: P.beats, loop: P.loop, count: P.count, click: P.click, drum: P.drum, voice: P.voice, style: P.style, guide: P.guide, follow: P.follow }, r: base.root, i: st.inst, c: { strings: st.strings, tuning: st.tuning, custom: st.custom, frets: st.frets, minus: st.minus } };
  return location.origin + location.pathname + '#s=' + encodeShare(obj);
}
async function copyShare() {
  const url = shareUrl();
  try { await navigator.clipboard.writeText(url); notify('共有リンクをコピーしました（進行・テンポ・楽器の設定が入っています）'); }
  catch (e) { history.replaceState(null, '', url.slice(url.indexOf('#'))); notify('アドレスバーのリンクをコピーしてください'); }
}
function applyShared(obj) {
  if (!obj || typeof obj !== 'object' || !obj.p) return false;
  const inst = INSTRUMENTS[obj.i] ? obj.i : 'guitar', raw = { ...st, inst, ...cleanCfg(inst, obj.c), prog: obj.p, root: obj.r, cfg: {} };
  st = sanitize(raw); return true;
}
async function exportBoard(kind) {
  const svg = $('fretboard').querySelector('svg'); if (!svg) return;
  const set = currentSet(), tn = (st.tuning === 'custom' ? 'カスタム' : (findTuning(st.inst, st.strings, st.tuning) || {}).name) + ` ・ ${st.strings}弦`;
  const rng = $('m-range').textContent, title = $('fb-title').textContent || titleFor(set);
  try {
    const c = await fretboardCanvas(svg, title, `${INSTRUMENTS[st.inst].name} ・ ${tn} ・ ${rng}`);
    const base = 'fretboard-' + title.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);
    if (kind === 'png') download(await canvasBlob(c), base + '.png'); else download(await pdfFromCanvas(c), base + '.pdf');
    notify(kind === 'png' ? '指板図を PNG で保存しました' : '指板図を PDF で保存しました');
  } catch (e) { notify('書き出しに失敗しました'); }
}

// ── quiz: a note / degree / interval / chord is shown, and you play it on the guitar (right / wrong only) ──
const quiz = { on: false, q: null, n: 0, ok: 0, streak: 0, best: 0, times: [], t0: 0, lock: false, missed: false, result: null, timer: 0, prevMode: null };
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const SHARP_N = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'], FLAT_N = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const nameOf = p => ROOT_LABELS[p].includes('/') ? pickOne([SHARP_N[p], FLAT_N[p]]) : SHARP_N[p];
const QZ_INTERVALS = [[1, '短2度'], [2, '長2度'], [3, '短3度'], [4, '長3度'], [5, '完全4度'], [6, '増4度（減5度）'], [7, '完全5度'], [8, '短6度'], [9, '長6度'], [10, '短7度'], [11, '長7度']];
const QZ_CHORDS = ['maj', 'm', 'dim', 'aug', 'sus2', 'sus4', '6', '7', 'maj7', 'm7'].filter(k => CHORDS[k]);
const QZ_HINT = { 'note-scale': 'いま選んでいるルートとスケールの構成音が出ます。', 'note-all': '12音すべてからランダムに出ます。', degree: 'いま選んでいるルートとスケールの、何度の音かを弾きます。', interval: '出された音から、指定のインターバルだけ上の音を弾きます。', chord: '出されたコードを、ストロークで弾いてください（構成音がそろえば正解）。' };
const setTnMode = m => { const b = document.querySelector(`.tn-mode[data-m="${m}"]`); if (b && !b.classList.contains('on')) b.click(); };
function makeQuestion() {
  const kind = st.quiz.kind;
  if (kind === 'note-scale' || kind === 'degree') {
    const sc = SCALES[st.scale], set = makeSet(st.root, sc.iv);
    if (kind === 'note-scale') { const i = Math.floor(Math.random() * sc.iv.length); return { kind, pcs: [pc(st.root + parseInterval(sc.iv[i]).semis)], text: set.name(st.root + parseInterval(sc.iv[i]).semis), ans: set.name(st.root + parseInterval(sc.iv[i]).semis) }; }
    const i = Math.floor(Math.random() * sc.iv.length), iv = parseInterval(sc.iv[i]), t = pc(st.root + iv.semis);
    return { kind, pcs: [t], text: `${set.name(st.root)} ${sc.name} の ${iv.label}度`, ans: set.name(t) };
  }
  if (kind === 'note-all') { const t = Math.floor(Math.random() * 12), n = nameOf(t); return { kind, pcs: [t], text: n, ans: n }; }
  if (kind === 'interval') {
    const r = Math.floor(Math.random() * 12), [semis, lbl] = pickOne(QZ_INTERVALS), t = pc(r + semis);
    return { kind, pcs: [t], text: `${nameOf(r)} から ${lbl} 上`, ans: nameOf(t) };
  }
  const r = Math.floor(Math.random() * 12), id = pickOne(QZ_CHORDS), set = makeSet(r, CHORDS[id].iv);
  return { kind: 'chord', pcs: set.pcs.slice(), text: set.name(r) + chordSymbol(id), ans: set.pcs.map(p => set.name(p)).join(' ') };
}
function startQuiz() {
  if (pb.on) stopProg();
  Object.assign(quiz, { on: true, n: 0, ok: 0, streak: 0, best: 0, times: [], result: null, lock: false, missed: false });
  const on = document.querySelector('.tn-mode.on'); quiz.prevMode = on ? on.dataset.m : null;
  if (!live.on) tunerStart();
  nextQ();
}
function endQuizMode() { if (quiz.prevMode) setTnMode(quiz.prevMode); quiz.prevMode = null; }
function stopQuiz() { clearTimeout(quiz.timer); Object.assign(quiz, { on: false, q: null, lock: false }); endQuizMode(); renderQuiz(); }
function nextQ() {
  clearTimeout(quiz.timer);
  if (quiz.n >= st.quiz.count) return finishQuiz();
  quiz.q = makeQuestion(); quiz.t0 = performance.now(); quiz.lock = false; quiz.missed = false;
  setTnMode(quiz.q.kind === 'chord' ? 'chord' : 'single');
  renderQuiz();
}
function quizDone(correct, skipped) {
  if (quiz.lock || !quiz.q) return;
  quiz.lock = true; quiz.n++;
  const sec = (performance.now() - quiz.t0) / 1000, first = correct && !quiz.missed;
  if (first) { quiz.ok++; quiz.streak++; quiz.best = Math.max(quiz.best, quiz.streak); quiz.times.push(sec); } else quiz.streak = 0;
  const fb = $('qz-fb');
  fb.className = 'qz-fb ' + (first ? 'ok' : 'ng');
  fb.textContent = skipped ? `答え：${quiz.q.ans}` : first ? `✓ 正解（${sec.toFixed(1)}秒）` : '✓ 正解（やり直し）';
  $('qz-skip').hidden = true; renderQuizInfo();
  quiz.timer = setTimeout(nextQ, first ? 700 : 1600);
}
function quizWrong() {
  if (quiz.lock || !quiz.q) return;
  quiz.missed = true; const fb = $('qz-fb'); fb.className = 'qz-fb ng'; fb.textContent = '✗ 違います';
}
function quizPlayed(m) {
  if (!quiz.on || !quiz.q || quiz.lock || quiz.q.kind === 'chord') return;
  if (quiz.q.pcs.includes(pc(m))) quizDone(true); else quizWrong();
}
function quizChord(stable) {
  if (!quiz.on || !quiz.q || quiz.lock || quiz.q.kind !== 'chord' || stable.length < 2) return;
  const P = new Set(stable.map(pc)), T = new Set(quiz.q.pcs);
  if ([...P].some(p => !T.has(p))) quizWrong();
  else if ([...T].every(p => P.has(p))) quizDone(true);
}
function finishQuiz() {
  const avg = quiz.times.length ? quiz.times.reduce((a, b) => a + b, 0) / quiz.times.length : 0;
  quiz.result = { n: quiz.n, ok: quiz.ok, avg, best: quiz.best };
  quiz.on = false; quiz.q = null; endQuizMode(); renderQuiz();
}
function renderQuizInfo() {
  $('qz-info').textContent = quiz.on && quiz.q ? `第 ${Math.min(quiz.n + (quiz.lock ? 0 : 1), st.quiz.count)} / ${st.quiz.count} 問 ・ 一発正解 ${quiz.ok} ・ 連続 ${quiz.streak}` : '';
}
function renderQuiz() {
  const Q = st.quiz, active = quiz.on && quiz.q;
  $('qz-kind').value = Q.kind; $('qz-count').value = Q.count; $('qz-hint').textContent = QZ_HINT[Q.kind];
  $('qz-kind').disabled = $('qz-count').disabled = quiz.on;
  $('qz-count').closest('.num-wrap').querySelectorAll('.num-btn').forEach(b => { b.disabled = quiz.on; });
  $('qz-start-label').textContent = quiz.on ? 'やめる' : 'クイズを始める';
  $('qz-start').classList.toggle('on', quiz.on);
  const pr = $('qz-prompt'), fb = $('qz-fb');
  $('qz-skip').hidden = !active || quiz.lock;
  fb.className = 'qz-fb'; fb.textContent = '';
  if (active) pr.textContent = quiz.q.text + '  を弾く';
  else if (quiz.result) {
    const r = quiz.result; pr.textContent = '結果';
    fb.innerHTML = `<div class="qz-result"><div><b>${r.ok} / ${r.n}</b>一発正解</div><div><b>${r.avg ? r.avg.toFixed(1) : '—'}</b>平均（秒）</div><div><b>${r.best}</b>連続正解</div></div>`;
  } else pr.textContent = '「クイズを始める」を押すと、ギター入力が入って出題が始まります。';
  renderQuizInfo();
}
function bindQuiz() {
  $('qz-kind').addEventListener('change', e => { update(() => { st.quiz.kind = e.target.value; }, true); quiz.result = null; renderQuiz(); });
  $('qz-count').addEventListener('change', e => { update(() => { st.quiz.count = clampInt(parseFloat(e.target.value), 1, 100, st.quiz.count); }, true); e.target.value = st.quiz.count; });
  $('qz-start').addEventListener('click', () => quiz.on ? stopQuiz() : startQuiz());
  $('qz-skip').addEventListener('click', () => quizDone(false, true));
  renderQuiz();
}

// ── drum / click pattern (see player.js): rows of 0..2 per step; any set of instruments, resolution, length and swing ──
const DRUM_PRESETS = { metro: 'メトロノーム', rock8: '8ビート', four: '4つ打ち', beat16: '16ビート', shuffle: 'シャッフル', none: '空' };
const DRUM_RES = { 2: '8分', 3: '8分3連', 4: '16分', 6: '16分3連', 8: '32分' };
const DRUM_NEXT = [2, 0, 1];   // press: off -> strong -> soft -> off (levels: 0 off, 1 soft, 2 strong)
function drumLen(D, beats) { return beats * D.res * D.bars; }
// writes the preset into D in place: the number of bars, the resolution and the instruments already there stay; only the instruments the preset needs are added,
// the others are emptied
function applyPreset(D, id, beats) {
  const def = PRESET_DEF[id] || PRESET_DEF.none, per = beats * D.res;
  const bar = f => Array.from({ length: per }, (_, i) => { const b = Math.floor(i / D.res), x = (i % D.res) / D.res; return String(f(b, Math.round(x * 1e6) / 1e6) | 0); }).join('');
  const rows = {};
  Object.keys(def.rows).forEach(k => { rows[k] = bar(def.rows[k]); });
  Object.keys(D.rows).forEach(k => { if (!rows[k]) rows[k] = '0'.repeat(per); });
  Object.keys(rows).forEach(k => { D.rows[k] = rows[k].repeat(D.bars); });
  D.swing = def.swing && D.res % 2 === 0 ? { ...def.swing } : { mode: 'off', amt: D.swing.amt };
  D.pre = id;
  return D;
}
function drumPreset(id, beats) { return applyPreset({ v: 2, pre: id, res: 4, bars: 1, swing: { mode: 'off', amt: 67 }, rows: {} }, id, beats); }
function cleanDrum(d, beats) {
  if (!d || typeof d !== 'object') return drumPreset('metro', beats);
  if (d.v !== 2) {   // the earlier format: rows k s h c of 0/1, 4 steps per beat
    if (DRUM_PRESETS[d.pre]) return drumPreset(d.pre, beats);
    const n = beats * 4, fix = v => (typeof v === 'string' && /^[01]*$/.test(v) ? v : '').slice(0, n).padEnd(n, '0').replace(/1/g, '2');
    return { v: 2, pre: 'custom', res: 4, bars: 1, swing: { mode: 'off', amt: 67 }, rows: { kick: fix(d.k), snare: fix(d.s), hat: fix(d.h), click: fix(d.c) } };
  }
  const res = [2, 3, 4, 6, 8].includes(d.res) ? d.res : 4, bars = intIn(d.bars, 1, MAX_BARS, 1), sw = d.swing || {};
  const D = { v: 2, pre: 'custom', res, bars, swing: { mode: ['8', '16'].includes(sw.mode) ? sw.mode : 'off', amt: intIn(sw.amt, 50, 80, 67) }, rows: {} };
  const n = drumLen(D, beats);
  DRUM_INSTR.forEach(x => { const v = d.rows && d.rows[x.id]; if (typeof v === 'string') D.rows[x.id] = v.replace(/[^0-3]/g, '0').replace(/3/g, '2').slice(0, n).padEnd(n, '0'); });
  return D;
}
// the beats per bar changed: keep every bar's steps in place (cut or pad each bar)
function drumBeats(D, oldBeats, newBeats) {
  if (D.pre !== 'custom') { const E = structuredClone(D); return applyPreset(E, D.pre, newBeats); }   // a preset follows the time signature
  const o = oldBeats * D.res, n = newBeats * D.res, E = { ...D, rows: {} };
  for (const id of Object.keys(D.rows)) { let r = ''; for (let b = 0; b < D.bars; b++) r += D.rows[id].slice(b * o, (b + 1) * o).slice(0, n).padEnd(n, '0'); E.rows[id] = r; }
  return E;
}
const DR_PAGE = 4;   // bars shown at once in the step grid
let drPage = 0;
function renderDrum() {
  const D = st.prog.drum, per = st.prog.beats * D.res, have = DRUM_INSTR.filter(x => D.rows[x.id] != null);
  const pages = Math.ceil(D.bars / DR_PAGE); drPage = Math.max(0, Math.min(pages - 1, drPage));
  const from = drPage * DR_PAGE * per, to = Math.min(D.bars, (drPage + 1) * DR_PAGE) * per;
  $('dr-pager').hidden = pages < 2;
  $('dr-pg-lbl').textContent = `${drPage * DR_PAGE + 1}–${Math.min(D.bars, (drPage + 1) * DR_PAGE)} 小節目 / 全${D.bars}小節`;
  $('dr-pg-prev').disabled = drPage === 0; $('dr-pg-next').disabled = drPage >= pages - 1;
  $('dr-pre').value = D.pre; $('dr-res').value = D.res; $('dr-bars').value = D.bars; $('dr-swing').value = D.swing.mode; $('dr-amt').value = D.swing.amt;
  $('dr-amt-w').hidden = D.swing.mode === 'off';
  { const m = D.swing.amt, near = x => Math.abs(m - x) <= 1; $('dr-amt-note').textContent = near(50) ? '＝ストレート' : near(67) ? '＝3連の中抜き' : near(75) ? '＝付点（強いハネ）' : ''; }
  const miss = DRUM_INSTR.filter(x => D.rows[x.id] == null);
  $('dr-add').innerHTML = '<option value="">＋ 楽器を追加</option>' + miss.map(x => `<option value="${x.id}">${x.label}</option>`).join(''); $('dr-add').disabled = !miss.length;
  $('dr-grid').innerHTML = have.length ? have.map(x => {
    const row = D.rows[x.id];
    return `<div class="dr-row"><span class="dr-lbl">${x.label}</span><button type="button" class="dr-rm" data-rm="${x.id}" aria-label="${x.label}を外す" title="この楽器を外す">×</button>${Array.from({ length: to - from }, (_, k) => { const i = from + k; return `<button type="button" class="dr-c l${row[i]} ${i % D.res === 0 ? 'beat' : ''} ${i % per === 0 && i ? 'bar' : ''}" data-r="${x.id}" data-i="${i}" aria-label="${x.label} ${Math.floor(i / per) + 1}小節 ${Math.floor(i % per / D.res) + 1}拍 ${i % D.res + 1}"></button>`; }).join('')}</div>`;
  }).join('') : '<p class="hint">楽器がありません。「＋ 楽器を追加」から選んでください。</p>';
}
function drumAudition() { audio.ready().then(() => drumBar(audio, audio.now + 0.05, 60 / Math.max(st.prog.bpm, 60), st.prog.beats, st.prog.drum, 0)); }
function bindDrum(set) {
  const edit = fn => set(() => { const D = st.prog.drum; fn(D); D.pre = 'custom'; });
  $('dr-pre').innerHTML = Object.entries(DRUM_PRESETS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('') + '<option value="custom">編集済み</option>';
  $('dr-res').innerHTML = Object.entries(DRUM_RES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  $('dr-pre').addEventListener('change', e => { if (e.target.value === 'custom') return; set(() => { applyPreset(st.prog.drum, e.target.value, st.prog.beats); }); drumAudition(); });
  $('dr-res').addEventListener('change', e => edit(D => {   // keep the notes that sit on both grids
    const nr = +e.target.value, old = D.res;
    for (const id of Object.keys(D.rows)) { const r = D.rows[id], out = Array(drumLen({ res: nr, bars: D.bars }, st.prog.beats)).fill('0'); for (let i = 0; i < r.length; i++) { const j = i * nr / old; if (r[i] !== '0' && Number.isInteger(j) && j < out.length) out[j] = r[i]; } D.rows[id] = out.join(''); }
    D.res = nr; if (D.swing.mode !== 'off' && nr % 2) D.swing.mode = 'off';
  }));
  $('dr-bars').addEventListener('change', e => edit(D => {   // a longer pattern repeats what is there; a shorter one is cut
    const nb = clampInt(parseFloat(e.target.value), 1, MAX_BARS, D.bars), per = st.prog.beats * D.res;
    for (const id of Object.keys(D.rows)) { const base = D.rows[id].slice(0, per); let r = ''; for (let b = 0; b < nb; b++) r += D.rows[id].slice(b * per, (b + 1) * per) || base; D.rows[id] = r.padEnd(per * nb, '0'); }
    D.bars = nb;
  }));
  $('dr-swing').addEventListener('change', e => edit(D => { D.swing.mode = e.target.value; }));
  $('dr-amt').addEventListener('change', e => edit(D => { D.swing.amt = intIn(parseInt(e.target.value), 50, 80, D.swing.amt); }));
  $('dr-add').addEventListener('change', e => { const id = e.target.value; if (!id) return; edit(D => { D.rows[id] = '0'.repeat(drumLen(D, st.prog.beats)); }); });
  $('dr-pg-prev').addEventListener('click', () => { drPage--; renderDrum(); });
  $('dr-pg-next').addEventListener('click', () => { drPage++; renderDrum(); });
  $('dr-grid').addEventListener('click', e => {
    const rm = e.target.closest('.dr-rm'); if (rm) { edit(D => { delete D.rows[rm.dataset.rm]; }); return; }
    const c = e.target.closest('.dr-c'); if (!c) return;
    const id = c.dataset.r, i = +c.dataset.i; let lv = 0;
    edit(D => { const row = D.rows[id].split(''); lv = DRUM_NEXT[+row[i]]; row[i] = String(lv); D.rows[id] = row.join(''); });
    if (lv) audio.ready().then(() => audio.click(audio.now + 0.01, lv === 2, id, DRUM_VEL[lv]));
  });
}

function bindVolume() {
  let vol = 80, muted = false;
  try { const o = JSON.parse(localStorage.getItem('gti-explorer:vol') || 'null'); if (o) { vol = Math.min(100, Math.max(0, +o.vol || 0)); muted = !!o.muted; } } catch (e) {}
  const rng = $('vol-range');
  const apply = () => {
    rng.value = vol; $('vol-num').textContent = muted ? 'M' : vol; rng.style.setProperty('--p', vol + '%');
    $('vol').classList.toggle('muted', muted); $('vol-mute').setAttribute('aria-pressed', String(muted));
    $('vol-wave').style.display = muted || vol === 0 ? 'none' : ''; $('vol-x').style.display = muted || vol === 0 ? '' : 'none';
    audio.setLevel(vol / 100, muted);
    try { localStorage.setItem('gti-explorer:vol', JSON.stringify({ vol, muted })); } catch (e) {}
  };
  rng.addEventListener('input', () => { vol = +rng.value; if (vol > 0) muted = false; apply(); });
  $('vol-mute').addEventListener('click', () => { if (vol === 0) vol = 80; else muted = !muted; apply(); });
  apply();
}
function bindTuner() {
  let a4 = 440; try { a4 = +localStorage.getItem('gti-explorer:a4') || 440; } catch (e) {}
  $('tn-a4').value = clampInt(a4, 400, 480, 440);
  $('tn-a4').addEventListener('change', () => { $('tn-a4').value = clampInt(parseFloat($('tn-a4').value), 400, 480, 440); try { localStorage.setItem('gti-explorer:a4', $('tn-a4').value); } catch (e) {} });
  $('tn-toggle').addEventListener('click', () => live.on ? tunerStop() : tunerStart());
  document.querySelectorAll('.tn-mode').forEach(btn => btn.addEventListener('click', () => {
    listener.mode = btn.dataset.m; listener.kind = btn.dataset.m === 'chord' ? 'chord' : 'single'; listener.cnt = 0;
    document.querySelectorAll('.tn-mode').forEach(b => b.classList.toggle('on', b === btn));
    showKind(listener.kind);
  }));
  listener.onKind = kind => showKind(kind);
  $('tn-chord-res').addEventListener('click', e => {
    const g = e.target.closest('.fd-go'); if (!g) return;
    fbAction = 'play'; shapeOverride = { root: +g.dataset.root, id: g.dataset.id };
    update(() => { st.shapeTab = 'forms'; });
    notify('Shapes だけをそのコードに切り替えました（Show の設定はそのままです）');
  });
  document.querySelectorAll('.tn-view').forEach(b => b.addEventListener('click', () => tnView(b.dataset.v)));
  let v = 'meter'; try { v = localStorage.getItem('gti-explorer:tnview') === 'strobe' ? 'strobe' : 'meter'; } catch (e) {}
  tnView(v);
  $('tn-device').addEventListener('change', () => { if (live.on) tunerStart(); });
  window.addEventListener('pagehide', () => { if (live.on) tunerStop(); });
}

async function boot() {
  try { const s = localStorage.getItem(STORE); st = sanitize(s ? JSON.parse(s) : null); } catch (e) { st = sanitize(null); }
  let shared = false;
  try { const m = /[#&]s=([A-Za-z0-9_-]+)/.exec(location.hash); if (m) { shared = applyShared(decodeShare(m[1])); history.replaceState(null, '', location.pathname + location.search); } } catch (e) {}
  initLayout(); initTheme(() => { try { render(); } catch (e) {} });
  bind(); bindTuner(); bindVolume(); bindProg(); bindHist(); bindQuiz(); render();
  if (shared) { save(); notify('共有された進行と設定を読み込みました'); }
}
boot();
