// ── Theory engine ──
// Degrees are stored as scale-degree indexes (0-6). Real pitches are always
// derived from tonic + mode + tuning, so changing key or tuning never breaks a song.

export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
export const pc = n => ((n % 12) + 12) % 12;
export const noteName = midi => NOTE_NAMES[pc(midi)] + (Math.floor(midi / 12) - 1);

export const MODES = {
  aeolian:          { name: 'Aeolian (Natural minor)', steps: [0,2,3,5,7,8,10], color: [5,6],   hint: '暗さと壮大さ。bVI・bVII が効く、メタルの基本形。' },
  phrygian:         { name: 'Phrygian',               steps: [0,1,3,5,7,8,10], color: [1],     hint: 'b2 の重さ。開放弦チャグとの相性が抜群。' },
  phrygianDominant: { name: 'Phrygian Dominant',      steps: [0,1,4,5,7,8,10], color: [1,6],   hint: 'エキゾチックな b2 と長3度。中東的な緊張感。' },
  locrian:          { name: 'Locrian',                steps: [0,1,3,5,6,8,10], color: [1,4],   hint: 'b5 を含む最も不安定なモード。不穏なブレイクダウンに。' },
  dorian:           { name: 'Dorian',                 steps: [0,2,3,5,7,9,10], color: [3],     hint: 'マイナーなのに明るい 6度。IV メジャーで抜け感。' },
  harmonicMinor:    { name: 'Harmonic minor',         steps: [0,2,3,5,7,8,11], color: [4,6],   hint: 'V がメジャーになり、中心へ強く戻る。ネオクラ的。' },
  hungarianMinor:   { name: 'Hungarian minor',        steps: [0,2,3,6,7,8,11], color: [3,5],   hint: '#4 と 7 の二つの増2度。濃い色彩。' },
  ionian:           { name: 'Ionian (Major)',         steps: [0,2,4,5,7,9,11], color: [3,5],   hint: '明るいメジャー。クリーンパートや開けたコーラスに。' },
  lydian:           { name: 'Lydian',                 steps: [0,2,4,6,7,9,11], color: [1,6],   hint: '#4 の浮遊感。II メジャーと maj7#11 が主役。' },
  mixolydian:       { name: 'Mixolydian',             steps: [0,2,4,5,7,9,10], color: [6],     hint: 'b7 で力強いメジャー。bVII→I の推進力。' },
  melodicMinor:     { name: 'Melodic minor',          steps: [0,2,3,5,7,9,11], color: [3,4],   hint: 'マイナーに 6・7 度が長音程。フュージョン寄りの色。' },
  lydianDominant:   { name: 'Lydian Dominant',        steps: [0,2,4,6,7,9,10], color: [1,6],   hint: '#4 と b7。浮遊感と推進力を両立。' }
};

const MAJOR = [0,2,4,5,7,9,11];
const ROMAN = ['I','II','III','IV','V','VI','VII'];

export const CHORD_TYPES = {
  '5':     { label: 'Power (5)',   degs: [0,4] },
  '58':    { label: 'Power + 8va', degs: [0,4,7] },
  triad:   { label: 'Triad',       degs: [0,2,4] },
  sus2:    { label: 'sus2',        degs: [0,1,4] },
  add9:    { label: 'add9',        degs: [0,2,4,8] },
  seventh: { label: '7th',         degs: [0,2,4,6] },
  eleven:  { label: '7 + 11',      degs: [0,2,4,6,10] },
  quartal: { label: 'Quartal',     degs: [0,3,6] }
};

const INTERVAL_NAMES = ['1','b2','2','b3','3','4','#4','5','b6','6','b7','7'];
const CHORD_SUFFIX = {
  '0,7':'5', '0,6':'5(b5)', '0,8':'5(#5)',
  '0,4,7':'', '0,3,7':'m', '0,3,6':'dim', '0,4,8':'aug', '0,4,6':'(b5)',
  '0,2,7':'sus2', '0,5,7':'sus4', '0,1,7':'sus(b2)', '0,2,6':'sus2(b5)', '0,1,6':'sus(b2,b5)',
  '0,2,4,7':'add9', '0,2,3,7':'m(add9)', '0,1,3,7':'m(addb9)', '0,1,4,7':'(addb9)', '0,2,3,6':'dim(add9)', '0,1,3,6':'dim(addb9)', '0,2,4,6':'(b5,add9)', '0,2,4,8':'aug(add9)',
  '0,4,7,11':'maj7', '0,3,7,10':'m7', '0,4,7,10':'7', '0,3,6,10':'m7b5', '0,3,6,9':'dim7',
  '0,3,7,11':'mMaj7', '0,4,8,11':'maj7#5', '0,4,6,11':'maj7(b5)', '0,4,6,10':'7(b5)', '0,3,8,10':'m7#5',
  '0,4,6,7,11':'maj7#11', '0,3,5,7,10':'m11', '0,4,5,7,11':'maj7(11)', '0,4,5,7,10':'7(11)', '0,4,6,7,10':'7#11',
  '0,3,5,6,10':'m11b5', '0,3,5,7,11':'mMaj7(11)', '0,3,6,7,11':'mMaj7(#11)', '0,4,5,8,11':'maj7#5(11)',
  '0,5,10':'quartal', '0,5,11':'(4,7)', '0,6,11':'(#4,7)', '0,5,9':'(4,6)', '0,4,10':'(3,b7)', '0,3,8':'(b3,b6)'
};

export function makeKey(tonic, modeId) {
  const mode = MODES[modeId] || MODES.aeolian;
  return { tonic, modeId, mode, scale: mode.steps.map(s => pc(s + tonic)) };
}

// Interval in semitones from the tonic to scale degree d (d may exceed 6 for compound degrees)
function degSemis(key, d) {
  const oct = Math.floor(d / 7);
  return key.mode.steps[((d % 7) + 7) % 7] + 12 * oct;
}

export function triadQuality(key, d) {
  const r = degSemis(key, d), third = degSemis(key, d + 2) - r, fifth = degSemis(key, d + 4) - r;
  if (third === 4 && fifth === 7) return 'maj';
  if (third === 3 && fifth === 7) return 'min';
  if (third === 3 && fifth === 6) return 'dim';
  if (third === 4 && fifth === 8) return 'aug';
  if (third === 4 && fifth === 6) return 'majb5';
  return 'other';
}

export function romanFor(key, d) {
  const diff = key.mode.steps[d] - MAJOR[d];
  const acc = diff === -1 ? 'b' : diff === -2 ? 'bb' : diff === 1 ? '#' : '';
  const q = triadQuality(key, d);
  const base = (q === 'min' || q === 'dim') ? ROMAN[d].toLowerCase() : ROMAN[d];
  return acc + base + (q === 'dim' ? '°' : q === 'aug' ? '+' : q === 'majb5' ? '(b5)' : '');
}

// Chord object for a bar: root pitch class, interval set, display name
export function chordFor(key, d, type) {
  const ct = CHORD_TYPES[type] || CHORD_TYPES['5'];
  const rootSemis = degSemis(key, d);
  const ints = ct.degs.map(k => degSemis(key, d + k) - rootSemis);
  const root = pc(key.tonic + rootSemis);
  const set = [...new Set(ints.map(pc))].sort((a, b) => a - b);
  const keyStr = set.join(',');
  const suffix = CHORD_SUFFIX[keyStr];
  const name = NOTE_NAMES[root] + (suffix !== undefined ? suffix : '(' + set.slice(1).map(i => INTERVAL_NAMES[i]).join(',') + ')');
  return { d, type, root, ints, pcs: set.map(i => pc(i + root)), name, roman: romanFor(key, d) };
}

// Lowest playable MIDI note of pitch class p on the given tuning (open strings up to fret 11)
export function lowestOf(p, tuning) {
  const low = Math.min(...tuning);
  for (let m = low; m < low + 12; m++) if (pc(m) === p) return m;
  return low;
}

// Riff hit voicings (low register, guitar-like)
export function chugNotes(chord, tuning) { return [lowestOf(chord.root, tuning)]; }
export function accentNotes(chord, tuning) {
  const r = lowestOf(chord.root, tuning);
  const fifth = chord.ints.find(i => pc(i) === 7 || pc(i) === 6 || pc(i) === 8);
  return [r, r + (fifth !== undefined ? pc(fifth) : 7), r + 12];
}
// Pad voicing (mid register, close position above the bass)
export function padNotes(chord) {
  let root = 48 + chord.root; if (root > 55) root -= 12;
  const notes = [root];
  chord.ints.slice(1).forEach(i => { let n = root + pc(i); while (n <= notes[notes.length - 1]) n += 12; notes.push(n); });
  if (chord.ints.length <= 2) notes.push(root + 12);
  return notes;
}

// ── Chord suggestion ──
// Generic functional roles by scale degree, adapted per mode via the mode's colour degrees.
const ROLE = ['home', 'away', 'home2', 'away', 'tension', 'away', 'tension'];
const ROLE_LABEL = { home: '中心', home2: '中心の代理', away: '広がる', tension: '緊張する' };
export const roleOf = d => ROLE[d];
export const roleLabel = d => ROLE_LABEL[ROLE[d]];

function transition(key, from, to) {
  const reasons = []; let score = 0;
  if (from === to) return { score: -4, reasons: ['同じコードで押し、リズムで展開する'] };
  const rf = ROLE[from], rt = ROLE[to];
  if (rf === 'tension' && to === 0) { score += 10; reasons.push('緊張を中心で解決'); }
  else if (rf === 'tension' && rt === 'home2') { score += 5; reasons.push('解決をずらして余韻を残す'); }
  if ((rf === 'home' || rf === 'home2') && rt === 'away') { score += 6; reasons.push('中心から景色を広げる'); }
  if (rf === 'away' && rt === 'tension') { score += 6; reasons.push('広げた後に戻る力を作る'); }
  if (rf === 'away' && to === 0) { score += 4; reasons.push('柔らかく中心に戻る'); }
  const a = pc(key.tonic + key.mode.steps[from]), b = pc(key.tonic + key.mode.steps[to]);
  const motion = pc(b - a);
  if (motion === 11) { score += 4; reasons.push('ベースが半音下降'); }
  else if (motion === 10) { score += 3; reasons.push('ベースが全音下降'); }
  else if (motion === 1) { score += 3; reasons.push('半音上へ寄せて圧をかける'); }
  return { score, reasons };
}

export function suggestChords(key, bars, index, variation = 0) {
  const prev = bars[index - 1], next = bars[index + 1];
  const used = bars.slice(0, index).map(b => b.d);
  const out = [];
  for (let d = 0; d < 7; d++) {
    let score = 0; const reasons = [];
    if (!prev) { if (d === 0) { score += 12; reasons.push('中心から始める'); } }
    else { const t = transition(key, prev.d, d); score += t.score; reasons.push(...t.reasons); }
    if (next) { const t = transition(key, d, next.d); score += t.score * 0.7; if (t.reasons.length) reasons.push('次の ' + romanFor(key, next.d) + ' へ：' + t.reasons[0]); }
    if (key.mode.color.includes(d)) { score += 5; reasons.push(key.mode.name.split(' ')[0] + ' らしさを出す ' + romanFor(key, d)); }
    if (triadQuality(key, d) === 'dim' || triadQuality(key, d) === 'majb5') score -= 1;
    score -= used.filter(u => u === d).length * 1.2;
    // deterministic variation (no randomness): same state + same variation → same suggestions
    score += ((d * 7 + index * 3 + variation * 5) % 11) * (variation ? 0.6 : 0.12);
    out.push({ d, score, roman: romanFor(key, d), role: roleLabel(d), reason: reasons.slice(0, 2).join('。') || '素直につなぐ' });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, 4);
}

// ── Rhythm helpers ──
export function stepsPerBar(num, den) { return Math.round(num * 16 / den); }
const gcd = (a, b) => b ? gcd(b, a % b) : a;
export const lcm = (a, b) => a / gcd(a, b) * b;

// "3+3+2" → accent at each group start, chugs fill the rest (or rests if fill=false)
export function patternFromGrouping(str, fill = true) {
  const groups = String(str).split(/[^0-9]+/).map(Number).filter(n => n > 0 && n <= 32);
  if (!groups.length) return null;
  const steps = [];
  groups.forEach(g => { for (let i = 0; i < g; i++) steps.push(i === 0 ? 2 : (fill ? 1 : 0)); });
  return steps.length <= 64 ? steps : null;
}

// Euclidean rhythm (Bjorklund via bucket method), hits as accents, optional rotation
export function euclid(k, n, rot = 0) {
  if (n < 1 || n > 64 || k < 0) return null;
  k = Math.min(k, n);
  const steps = [];
  for (let i = 0; i < n; i++) steps.push(Math.floor((i * k) / n) !== Math.floor(((i - 1) * k) / n) || (i === 0 && k > 0) ? 2 : 0);
  const r = ((rot % n) + n) % n;
  return steps.slice(n - r).concat(steps.slice(0, n - r));
}

// ── Lead line ──
// Lead events: { n: midi | null (rest), len: steps (16ths) }, played back to back from bar 1.
export const LEAD_LENGTHS = [
  { len: 1, label: '16分', sym: '𝅘𝅥𝅯' }, { len: 2, label: '8分', sym: '♪' }, { len: 3, label: '付点8分', sym: '♪.' },
  { len: 4, label: '4分', sym: '♩' }, { len: 8, label: '2分', sym: '𝅗𝅥' }, { len: 16, label: '全', sym: '𝅝' }
];
export const leadTotal = lead => lead.reduce((s, e) => s + e.len, 0);
export function leadRange(tuning) { return { lo: Math.max(36, Math.min(...tuning) + 12), hi: Math.min(96, Math.max(...tuning) + 22) }; }

// Which chord sits under a step of the progression
export function chordIndexAt(step, spb, bars) { return Math.min(bars - 1, Math.floor(step / spb)); }

// Four candidate next notes. Chord tones lead on strong beats; scale tones connect in between.
export function suggestLead(key, chordsList, lead, spb, beatSteps, tuning, len, variation = 0) {
  const pos = leadTotal(lead), cap = spb * chordsList.length;
  if (pos >= cap) return [];
  const { lo, hi } = leadRange(tuning);
  const chord = chordsList[chordIndexAt(pos, spb, chordsList.length)];
  const strong = pos % beatSteps === 0, barHead = pos % spb === 0;
  const played = lead.filter(e => e.n !== null), prev = played.length ? played[played.length - 1].n : null;
  const pool = []; for (let m = lo; m <= hi; m++) { const p = pc(m); if (key.scale.includes(p) || chord.pcs.includes(p)) pool.push(m); }
  const isCT = m => chord.pcs.includes(pc(m));
  const centre = Math.round((lo + hi) / 2);
  const anchor = prev ?? centre;
  const v = variation;
  const lastBarTail = pos >= cap - spb && pos % spb >= spb / 2;
  const profiles = [
    { tag: 'コードトーン', why: `${chord.name} の構成音。伴奏としっかり重なります。`, target: anchor + [0, 3, -3, 5][v % 4], ct: true },
    { tag: 'なめらかに', why: '近くの音へ。強い拍ではコードトーン、間の拍ではスケールの音でつなぎます。', target: anchor + [2, -2, 1, -1][v % 4], ct: strong },
    { tag: '上へ', why: '少し上へ広げて、フレーズに勢いをつけます。', target: anchor + 4 + (v % 3), ct: barHead },
    { tag: '跳ぶ', why: '離れた音へ跳んで、表情を変えます。近い音と組み合わせると歌いやすくなります。', target: anchor + (anchor > centre + 5 ? -7 : 7) - (v % 3) }
  ];
  if (prev === null) Object.assign(profiles[0], { tag: '始まりの音', why: `${chord.name} のルート。落ち着いて始められます。`, target: centre, root: true });
  if (lastBarTail) Object.assign(profiles[0], { tag: '着地', why: '終わりは中心の音へ。フレーズがまとまります。', target: anchor, tonic: true });
  const recent = played.slice(-6).map(e => e.n);
  const used = new Set();
  return profiles.map(pf => {
    let cands = pool.filter(m => !used.has(m));
    if (pf.ct) cands = cands.filter(isCT);
    if (pf.root) cands = cands.filter(m => pc(m) === chord.root);
    if (pf.tonic) cands = cands.filter(m => pc(m) === key.tonic);
    if (!cands.length) cands = pool.filter(m => !used.has(m));
    const scored = cands.map(m => {
      let s = Math.abs(m - pf.target);
      if (prev !== null && m === prev) s += 3.5;
      s += recent.filter(r => r === m).length * 0.4;
      if (strong && !isCT(m)) s += 3;
      // a held note is checked against every chord it rings over
      for (let t = pos + 1; t < Math.min(pos + len, cap); t++) if (!chordsList[chordIndexAt(t, spb, chordsList.length)].pcs.includes(pc(m))) s += 0.25;
      return { m, s };
    }).sort((a, b) => a.s - b.s || a.m - b.m);
    const n = scored[0].m; used.add(n);
    return { n, name: noteName(n), tag: pf.tag, why: pf.why, ct: isCT(n) };
  });
}
