// ── Chord / scale progressions: text parsing, presets, chord voicing for playback ──
import { pc, SCALES, CHORDS, chordSymbol, parseInterval, makeSet } from './theory.js?v=51';

const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const norm = s => s.replace(/♭/g, 'b').replace(/♯/g, '#').replace(/[△Δ]/g, 'maj');

// chord suffix → chord id. Case matters (M7 / m7), so the table is checked as written first.
const SUFFIX = (() => {
  const t = { '': 'maj', M: 'maj', maj: 'maj', major: 'maj', m: 'm', min: 'm', mi: 'm', '-': 'm', minor: 'm', '5': '5', dim: 'dim', o: 'dim', '°': 'dim', aug: 'aug', '+': 'aug',
    sus2: 'sus2', sus4: 'sus4', sus: 'sus4', '6': '6', m6: 'm6', min6: 'm6', '7': '7', dom7: '7', maj7: 'maj7', M7: 'maj7', ma7: 'maj7', m7: 'm7', min7: 'm7', '-7': 'm7', mi7: 'm7',
    m7b5: 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5', min7b5: 'm7b5', 'm7(b5)': 'm7b5', dim7: 'dim7', 'o7': 'dim7', '°7': 'dim7',
    mmaj7: 'mMaj7', mM7: 'mMaj7', 'm(maj7)': 'mMaj7', minmaj7: 'mMaj7', '7sus4': '7sus4', '7sus': '7sus4', add9: 'add9', madd9: 'madd9', 'm(add9)': 'madd9', '69': '69', '6/9': '69', '6(9)': '69',
    '9': '9', maj9: 'maj9', M9: 'maj9', m9: 'm9', min9: 'm9', '7b9': '7b9', '7#9': '7s9', m11: 'm11', 'maj7#11': 'maj7s11', '7#11': '7s11', '13': '13', '7b5': '7b5', aug7: 'aug7', '+7': 'aug7', '7#5': 'aug7', add11: 'add11' };
  Object.keys(CHORDS).forEach(id => { const k = norm(chordSymbol(id)); if (!(k in t)) t[k] = id; });
  return t;
})();
export function chordIdFromSuffix(suf) {
  const a = norm(suf.trim());
  if (a in SUFFIX) return SUFFIX[a];
  const l = a.toLowerCase();
  return l !== a && l in SUFFIX && !['m', 'M'].includes(a[0]) ? SUFFIX[l] : null;
}

// root written as a letter (A, F#, Bb) or a Roman numeral (ii, bVII) relative to `key`
function parseRoot(tok, key) {
  let m = /^([A-G])([#♯b♭]?)/.exec(tok);
  if (m) { const acc = /[#♯]/.test(m[2]) ? 1 : /[b♭]/.test(m[2]) ? -1 : 0; return { root: pc(LETTER_PC[m[1]] + acc), text: m[1] + (acc > 0 ? '♯' : acc < 0 ? '♭' : ''), rest: tok.slice(m[0].length), roman: false }; }
  m = /^([b#♭♯]?)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)/.exec(tok);
  if (!m) return null;
  const deg = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii'].indexOf(m[2].toLowerCase()), acc = /[#♯]/.test(m[1]) ? 1 : /[b♭]/.test(m[1]) ? -1 : 0;
  return { root: pc(key + MAJOR[deg] + acc), rest: tok.slice(m[0].length), roman: true, flat: acc < 0, lower: m[2] === m[2].toLowerCase() };
}
const FLATS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
const nameOf = (root, flat) => flat ? FLATS[pc(root)] : makeSet(root, ['1']).name(root);

export function parseChordToken(tok, key = 0) {
  tok = tok.trim(); if (!tok) return null;
  let bassTxt = null; const sl = tok.indexOf('/');
  if (sl > 0 && !tok.includes('6/9')) { bassTxt = tok.slice(sl + 1); tok = tok.slice(0, sl); }
  const r = parseRoot(tok, key); if (!r) return null;
  let suf = r.rest;
  if (r.roman) {
    // lower case = minor; "iim7" and "ii7" both mean a minor seventh; °/ø as usual
    if (r.lower) suf = /^(m(?!aj|M)|min|-|°|o|ø|dim)/.test(suf) ? suf : 'm' + suf;
    else if (/^7$/.test(suf)) suf = '7';
  }
  const id = chordIdFromSuffix(suf); if (!id) return null;
  const out = { root: r.root, id, label: (r.roman ? nameOf(r.root, r.flat) : r.text) + chordSymbol(id) };
  if (bassTxt) { const b = parseRoot(bassTxt, key); if (b && !b.rest) { out.bass = b.root; out.label += '/' + (b.roman ? nameOf(b.root, b.flat) : b.text); } }
  return out;
}

// "Am7 D7 | Gmaj7 Cmaj7": bars are split by "|" (or new lines); inside a bar, spaces / commas split chords.
// With no "|" at all, every token is one bar.
export function parseBars(text, parseTok) {
  const src = text.replace(/[、，]/g, ',').trim(), errors = [], bars = [];
  if (!src) return { bars, errors };
  const hasBar = /[|｜\n]/.test(src);
  const chunks = hasBar ? src.split(/[|｜\n]+/) : null;
  const handle = (chunk, bar) => {
    const toks = chunk.split(/[\s,]+/).filter(Boolean), out = [];
    for (const t of toks) { const c = parseTok(t); if (c) out.push(c); else errors.push(t); }
    if (out.length) bars.push(out);
  };
  if (hasBar) chunks.forEach(c => handle(c)); else src.split(/[\s,]+/).filter(Boolean).forEach(t => handle(t));
  return { bars, errors };
}
export const parseChordText = (text, key = 0) => parseBars(text, t => parseChordToken(t, key));

// scale names: "A Dorian", "ii Dorian", "E minor pentatonic"
const SC_NORM = s => s.toLowerCase().replace(/[^a-z0-9#♯♭]/g, '').replace(/♭/g, 'b').replace(/♯/g, '#');
const SC_ALIAS = { major: 'ionian', minor: 'aeolian', naturalminor: 'aeolian', minorpentatonic: 'minorPent', majorpentatonic: 'majorPent', pentatonic: 'minorPent', minorpent: 'minorPent', majorpent: 'majorPent',
  blues: 'blues', minorblues: 'blues', majorblues: 'majorBlues', harmonicminor: 'harmonicMinor', melodicminor: 'melodicMinor', phrygiandominant: 'phrygianDominant', lydiandominant: 'lydianDominant', altered: 'altered', wholetone: 'wholeTone', superlocrian: 'altered', halfdiminished: 'locrianNat2' };
export function scaleIdFromName(name) {
  const k = SC_NORM(name); if (!k) return null;
  if (SC_ALIAS[k]) return SC_ALIAS[k];
  for (const id of Object.keys(SCALES)) if (SC_NORM(id) === k) return id;
  for (const [id, s] of Object.entries(SCALES)) if (SC_NORM(s.name) === k) return id;
  const hits = Object.entries(SCALES).filter(([id, s]) => SC_NORM(s.name).startsWith(k));
  return hits.length === 1 || (hits.length > 1 && k.length >= 4) ? hits[0][0] : null;
}
export function parseScaleToken(tok, key = 0) {
  tok = tok.trim(); const r = parseRoot(tok, key); if (!r) return null;
  const id = scaleIdFromName(r.rest.trim() || 'major') ; if (!id) return null;
  return { root: r.root, id, label: (r.roman ? nameOf(r.root, r.flat) : r.text) + ' ' + SCALES[id].name.replace(/\s*\(.*\)$/, '') };
}
// scale bars are written "A Dorian | D Mixolydian" (a bar may hold two scales split by ";" or ",")
export function parseScaleText(text, key = 0) {
  const src = text.trim(), errors = [], bars = [];
  if (!src) return { bars, errors };
  const hasBar = /[|｜\n]/.test(src);
  (hasBar ? src.split(/[|｜\n]+/) : src.split(/[;；]+/)).forEach(chunk => {
    const out = [];
    chunk.split(/[;；]+/).map(x => x.trim()).filter(Boolean).forEach(t => { const sc = parseScaleToken(t, key); if (sc) out.push(sc); else errors.push(t); });
    if (out.length) bars.push(out);
  });
  return { bars, errors };
}

export const CHORD_PRESETS = [
  { name: 'I – V – vi – IV（ポップスの王道）', text: 'I V vi IV' },
  { name: 'vi – IV – I – V', text: 'vi IV I V' },
  { name: 'I – vi – IV – V（50年代）', text: 'I vi IV V' },
  { name: 'ii – V – I（ジャズ）', text: 'iim7 V7 Imaj7 Imaj7' },
  { name: 'I – vi – ii – V（ターンアラウンド）', text: 'Imaj7 vi7 iim7 V7' },
  { name: 'I – ♭VII – IV – I（ロック）', text: 'I bVII IV I' },
  { name: 'i – ♭VII – ♭VI – V（マイナー／メタル）', text: 'i bVII bVI V' },
  { name: 'i – iv – v – i（マイナー）', text: 'i iv v i' },
  { name: 'アンダルシア（vi – V – IV – III）', text: 'vi V IV III' },
  { name: 'カノン進行（8小節）', text: 'I V vi iii IV I IV V' },
  { name: '12小節ブルース', text: 'I7 I7 I7 I7 | IV7 IV7 I7 I7 | V7 IV7 I7 V7' }
];
export const SCALE_PRESETS = [
  { name: 'ii – V – I（Dorian → Mixolydian → Ionian）', text: 'ii Dorian | V Mixolydian | I Ionian | I Ionian' },
  { name: 'I – IV – V（Mixolydian）', text: 'I Mixolydian | IV Mixolydian | V Mixolydian | I Mixolydian' },
  { name: 'ブルース（I – IV – I – V）', text: 'I Blues | IV Blues | I Blues | V Blues' },
  { name: 'マイナー（Aeolian ↔ Phrygian）', text: 'I Aeolian | I Aeolian | I Phrygian | I Phrygian' },
  { name: 'ダイアトニック・モード（7小節）', text: 'I Ionian | ii Dorian | iii Phrygian | IV Lydian | V Mixolydian | vi Aeolian | vii Locrian' },
  { name: 'マイナーペンタ（I – ♭VII – ♭VI – V）', text: 'I Minor pentatonic | bVII Minor pentatonic | bVI Minor pentatonic | V Minor pentatonic' }
];

// MIDI notes to sound for a chord. bassOnly = the lowest note alone (and a 5th for the bass instrument).
export function chordMidi(c, bass = false) {
  const iv = CHORDS[c.id].iv.map(n => parseInterval(n).semis);
  const lowBase = bass ? 28 : 40;                         // E1 / E2 region
  const low = lowBase + pc(c.root - lowBase);
  const bassNote = c.bass !== undefined ? lowBase + pc(c.bass - lowBase) : low;
  const body = bass ? [low + 7] : iv.map(s => low + 12 + s);   // bass: the root and its 5th
  return { bass: bassNote, body, all: [bassNote].concat(body) };
}
// root of a scale / chord for a short guide tone (comfortable middle register)
export const guideNote = (root, bass = false) => (bass ? 36 : 52) + pc(root - (bass ? 36 : 52));
