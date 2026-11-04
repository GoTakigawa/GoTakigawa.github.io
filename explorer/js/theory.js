// ── Theory for Fretboard Explorer ──
// Scales and chords are defined by interval names ("1", "b3", "#11" ...).
// From the names we get both the pitch (semitones) and the correct letter
// for spelling, so G Phrygian reads G A♭ B♭ C D E♭ F and C7♯9 has a D♯.

export const pc = n => ((n % 12) + 12) % 12;

const MAJOR_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'], LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
const ACC = { '-2': '𝄫', '-1': '♭', '0': '', '1': '♯', '2': '𝄪' };
const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const ROOT_LABELS = ['C', 'C♯ / D♭', 'D', 'D♯ / E♭', 'E', 'F', 'F♯ / G♭', 'G', 'G♯ / A♭', 'A', 'A♯ / B♭', 'B'];

// "b3" → { deg: 2 (0-based letter step), semis: 3, label: '♭3' }
export function parseInterval(name) {
  const m = /^(bb|b|##|#)?(\d+)$/.exec(name);
  const acc = { bb: -2, b: -1, '#': 1, '##': 2 }[m[1] || ''] || 0;
  const num = parseInt(m[2], 10), deg = (num - 1) % 7, oct = Math.floor((num - 1) / 7);
  return { name, deg, semis: MAJOR_SEMIS[deg] + acc + 12 * oct, label: (m[1] || '').replace(/b/g, '♭').replace(/#/g, '♯') + num };
}

export const SCALES = {
  ionian:      { name: 'Major (Ionian)',     group: 'モード', iv: ['1','2','3','4','5','6','7'] },
  dorian:      { name: 'Dorian',             group: 'モード', iv: ['1','2','b3','4','5','6','b7'] },
  phrygian:    { name: 'Phrygian',           group: 'モード', iv: ['1','b2','b3','4','5','b6','b7'] },
  lydian:      { name: 'Lydian',             group: 'モード', iv: ['1','2','3','#4','5','6','7'] },
  mixolydian:  { name: 'Mixolydian',         group: 'モード', iv: ['1','2','3','4','5','6','b7'] },
  aeolian:     { name: 'Natural minor (Aeolian)', group: 'モード', iv: ['1','2','b3','4','5','b6','b7'] },
  locrian:     { name: 'Locrian',            group: 'モード', iv: ['1','b2','b3','4','b5','b6','b7'] },
  harmonicMinor:    { name: 'Harmonic minor',    group: 'マイナー系', iv: ['1','2','b3','4','5','b6','7'] },
  melodicMinor:     { name: 'Melodic minor',     group: 'マイナー系', iv: ['1','2','b3','4','5','6','7'] },
  phrygianDominant: { name: 'Phrygian dominant', group: 'マイナー系', iv: ['1','b2','3','4','5','b6','b7'] },
  lydianDominant:   { name: 'Lydian dominant',   group: 'マイナー系', iv: ['1','2','3','#4','5','6','b7'] },
  hungarianMinor:   { name: 'Hungarian minor',   group: 'マイナー系', iv: ['1','2','b3','#4','5','b6','7'] },
  doubleHarmonic:   { name: 'Double harmonic',   group: 'マイナー系', iv: ['1','b2','3','4','5','b6','7'] },
  majorPent:   { name: 'Major pentatonic',   group: 'ペンタ・ブルース', iv: ['1','2','3','5','6'] },
  minorPent:   { name: 'Minor pentatonic',   group: 'ペンタ・ブルース', iv: ['1','b3','4','5','b7'] },
  blues:       { name: 'Blues',              group: 'ペンタ・ブルース', iv: ['1','b3','4','b5','5','b7'] },
  majorBlues:  { name: 'Major blues',        group: 'ペンタ・ブルース', iv: ['1','2','b3','3','5','6'] },
  wholeTone:   { name: 'Whole tone',         group: '対称', iv: ['1','2','3','#4','#5','b7'] },
  dimHW:       { name: 'Diminished (H-W)',   group: '対称', iv: ['1','b2','#2','3','#4','5','6','b7'] },
  dimWH:       { name: 'Diminished (W-H)',   group: '対称', iv: ['1','2','b3','4','b5','b6','6','7'] },
  hirajoshi:   { name: 'Hirajoshi',          group: 'その他', iv: ['1','2','b3','5','b6'] },
  insen:       { name: 'In-sen',             group: 'その他', iv: ['1','b2','4','5','b7'] }
};

export const CHORDS = {
  '5':      { name: '5（パワー）', iv: ['1','5'] },
  'b5':     { name: '5(♭5)',       iv: ['1','b5'] },
  maj:      { name: 'メジャー',     iv: ['1','3','5'] },
  m:        { name: 'm',           iv: ['1','b3','5'] },
  dim:      { name: 'dim',         iv: ['1','b3','b5'] },
  aug:      { name: 'aug',         iv: ['1','3','#5'] },
  sus2:     { name: 'sus2',        iv: ['1','2','5'] },
  sus4:     { name: 'sus4',        iv: ['1','4','5'] },
  '6':      { name: '6',           iv: ['1','3','5','6'] },
  m6:       { name: 'm6',          iv: ['1','b3','5','6'] },
  '7':      { name: '7',           iv: ['1','3','5','b7'] },
  maj7:     { name: 'maj7',        iv: ['1','3','5','7'] },
  m7:       { name: 'm7',          iv: ['1','b3','5','b7'] },
  m7b5:     { name: 'm7♭5',        iv: ['1','b3','b5','b7'] },
  dim7:     { name: 'dim7',        iv: ['1','b3','b5','bb7'] },
  mMaj7:    { name: 'mMaj7',       iv: ['1','b3','5','7'] },
  '7sus4':  { name: '7sus4',       iv: ['1','4','5','b7'] },
  add9:     { name: 'add9',        iv: ['1','3','5','9'] },
  madd9:    { name: 'm(add9)',     iv: ['1','b3','5','9'] },
  '69':     { name: '6/9',         iv: ['1','3','5','6','9'] },
  '9':      { name: '9',           iv: ['1','3','5','b7','9'] },
  maj9:     { name: 'maj9',        iv: ['1','3','5','7','9'] },
  m9:       { name: 'm9',          iv: ['1','b3','5','b7','9'] },
  '7b9':    { name: '7♭9',         iv: ['1','3','5','b7','b9'] },
  '7s9':    { name: '7♯9',         iv: ['1','3','5','b7','#9'] },
  m11:      { name: 'm11',         iv: ['1','b3','5','b7','9','11'] },
  maj7s11:  { name: 'maj7♯11',     iv: ['1','3','5','7','#11'] },
  '7s11':   { name: '7♯11',        iv: ['1','3','5','b7','#11'] },
  '13':     { name: '13',          iv: ['1','3','5','b7','9','13'] },
  '7b5':    { name: '7♭5',         iv: ['1','3','b5','b7'] },
  aug7:     { name: 'aug7',        iv: ['1','3','#5','b7'] },
  add11:    { name: 'add11',       iv: ['1','3','5','11'] },
  majb5:    { name: '(♭5)',        iv: ['1','3','b5'] },
  ms5:      { name: 'm(♯5)',       iv: ['1','b3','#5'] },
  sus4b5:   { name: 'sus4(♭5)',    iv: ['1','4','b5'] },
  susb2:    { name: 'sus♭2',       iv: ['1','b2','5'] },
  sus2b5:   { name: 'sus2(♭5)',    iv: ['1','2','b5'] },
  maj7s5:   { name: 'maj7♯5',      iv: ['1','3','#5','7'] },
  '6sus2b5':{ name: '6sus2(♭5)',   iv: ['1','2','b5','6'] },
  quartal:  { name: '4度堆積',      iv: ['1','4','b7'] }
};
export const chordSymbol = id => ({ maj: '', '5': '5', b5: '5(♭5)' })[id] ?? CHORDS[id].name;

// Root spelling that keeps accidentals smallest across the interval set
function spellRoot(root, ivs) {
  let best = null;
  LETTERS.forEach((L, li) => {
    const rAcc = ((root - LETTER_PC[li] + 18) % 12) - 6;
    if (Math.abs(rAcc) > 1) return;
    let cost = Math.abs(rAcc) * 2, flats = rAcc < 0 ? 1 : 0, sharps = rAcc > 0 ? 1 : 0;
    ivs.forEach(iv => {
      const p = pc(root + iv.semis), lj = (li + iv.deg) % 7, acc = ((p - LETTER_PC[lj] + 18) % 12) - 6;
      cost += Math.abs(acc) + (Math.abs(acc) > 1 ? 10 : 0);
      if (acc < 0) flats++; if (acc > 0) sharps++;
    });
    if (!best || cost < best.cost || (cost === best.cost && sharps > best.sharps)) best = { li, cost, flats, sharps };
  });
  return best;
}

// A "set" is a root + interval names. It knows its pitch classes, labels and spelling.
export function makeSet(root, ivNames) {
  const ivs = ivNames.map(parseInterval);
  const r = spellRoot(root, ivs);
  const byPc = {};
  ivs.forEach((iv, i) => {
    const p = pc(root + iv.semis);
    if (byPc[p]) return;
    const letterIdx = (r.li + iv.deg) % 7, acc = ((p - LETTER_PC[letterIdx] + 18) % 12) - 6;
    byPc[p] = { iv, index: i, name: LETTERS[letterIdx] + (ACC[acc] ?? '') };
  });
  const useFlats = r.flats > r.sharps;
  const name = p => byPc[pc(p)] ? byPc[pc(p)].name : (useFlats ? FLAT_NAMES : SHARP_NAMES)[pc(p)];
  const note = m => {
    const e = byPc[pc(m)]; let oct = Math.floor(m / 12) - 1;
    if (e && e.name.startsWith('C') && pc(m) === 11) oct += 1;
    if (e && e.name.startsWith('B') && pc(m) === 0) oct -= 1;
    return name(m) + oct;
  };
  return {
    root, ivs, pcs: Object.keys(byPc).map(Number),
    has: p => !!byPc[pc(p)],
    info: p => byPc[pc(p)] || null,
    name, note,
    intervalOf: p => byPc[pc(p)] ? byPc[pc(p)].iv.label : null
  };
}

// Diatonic chord on a scale degree (triad or seventh) — only for 7-note scales
export function diatonic(root, ivNames, d, seventh) {
  const ivs = ivNames.map(parseInterval);
  const st = ivs.map(i => i.semis);
  const pick = k => st[(d + k) % 7] + 12 * Math.floor((d + k) / 7) - st[d];
  const tones = seventh ? [0, 2, 4, 6] : [0, 2, 4];
  const semis = tones.map(pick);
  return { root: pc(root + st[d]), semis, pcs: semis.map(s => pc(root + st[d] + s)) };
}
// Roman numeral with the suffix taken from the actual triad (same reading as the chord name)
const TRIAD_SUFFIX = {
  '4,7': [true, ''], '3,7': [false, ''], '3,6': [false, '°'], '4,8': [true, '+'], '4,6': [true, '(♭5)'],
  '3,8': [false, '(♯5)'], '2,7': [true, 'sus2'], '5,7': [true, 'sus4'], '1,7': [true, 'sus♭2'],
  '2,6': [true, 'sus2(♭5)'], '5,6': [true, 'sus4(♭5)'], '2,8': [true, 'sus2(♯5)'], '5,8': [true, 'sus4(♯5)'], '1,6': [true, 'sus♭2(♭5)']
};
export function romanOf(ivNames, d) {
  const ivs = ivNames.map(parseInterval), st = ivs.map(i => i.semis), n = st.length;
  const at = k => st[(d + k) % n] + 12 * Math.floor((d + k) / n);
  const third = at(2) - st[d], fifth = at(4) - st[d];
  const R = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][d];
  const acc = st[d] - MAJOR_SEMIS[d];
  const pre = acc === -1 ? '♭' : acc === 1 ? '♯' : acc === -2 ? '𝄫' : acc === 2 ? '𝄪' : '';
  const [upper, suf] = TRIAD_SUFFIX[third + ',' + fifth] || [true, '(' + third + ',' + fifth + ')'];
  return pre + (upper ? R : R.toLowerCase()) + suf;
}


// ── Chord finder: guess chord names from picked pitches (MIDI) ──
const DYADS = ['ユニゾン/オクターブ','短2度','長2度','短3度','長3度','完全4度','増4度/減5度','完全5度','短6度','長6度','短7度','長7度'];
const EXOTIC = ['quartal', 'add11', 'aug7', '7b5', 'majb5', 'sus2b5', 'maj7s5', '6sus2b5', 'ms5', 'sus4b5', 'susb2'];
const ROOTLESS_OK = ['7', 'maj7', 'm7', 'm7b5', 'dim7', '9', 'maj9', 'm9', '13'];
export function identifyChord(midis) {
  const uniq = [...new Set(midis)].sort((a, b) => a - b);
  if (!uniq.length) return { kind: 'empty', results: [] };
  const pcs = [...new Set(uniq.map(pc))], bass = pc(uniq[0]);
  if (pcs.length === 1) return { kind: 'single', results: [] };
  if (pcs.length === 2) {
    const iv = pc(pcs.find(p => p !== bass) - bass);
    const res = [];
    if (iv === 7) res.push(score(bass, '5', 'exact', true));
    if (iv === 6) res.push(score(bass, 'b5', 'exact', true));
    return { kind: 'dyad', interval: DYADS[iv], results: res.filter(Boolean) };
  }
  const out = [];
  for (let r = 0; r < 12; r++) {
    const rel = new Set(pcs.map(p => pc(p - r)));
    for (const [id, c] of Object.entries(CHORDS)) {
      if (id === 'quartal' || id === 'b5') continue;
      const cs = new Set(c.iv.map(n => pc(parseInterval(n).semis)));
      const same = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
      // unusual chord types only as root-position readings
      if (same(rel, cs) && (r === bass || !EXOTIC.includes(id))) out.push(score(r, id, 'exact', r === bass));
      else if (cs.has(7) && cs.size >= 4) { const no5 = new Set([...cs].filter(x => x !== 7)); if (same(rel, no5)) out.push(score(r, id, 'omit5', r === bass)); }
      // rootless readings only for the common 7th / 9th chords
      if (!rel.has(0) && pcs.length >= 3 && ROOTLESS_OK.includes(id)) { const withR = new Set([...rel, 0]); if (same(withR, cs)) out.push(score(r, id, 'rootless', false)); }
    }
  }
  function score(r, id, how, rootInBass) {
    let s = { exact: 100, omit5: 78, rootless: 55 }[how];
    if (rootInBass) s += 25;
    s -= CHORDS[id].iv.length * 1.5;                 // prefer simpler names
    if (EXOTIC.includes(id)) s -= 8;
    if (['6', 'm6'].includes(id)) s -= 3;             // a 6 chord is usually read as the m7 / m7♭5 it inverts
    const set = makeSet(r, CHORDS[id].iv);
    const name = set.name(r) + chordSymbol(id) + (how !== 'rootless' && !rootInBass ? '/' + set.name(bass) : how === 'rootless' ? '' : '');
    return { root: r, id, how, score: s, name: how === 'rootless' ? name + '（ルートなし）' : how === 'omit5' ? name + '（5度省略）' : name, set };
  }
  const seen = new Set();
  const results = out.sort((a, b) => b.score - a.score).filter(x => { if (seen.has(x.name)) return false; seen.add(x.name); return true; }).slice(0, 6);
  return { kind: 'chord', bass, results };
}

// ── Two notes: the lower one is the root; read the upper one against the scale ──
// scale = { root, iv } or null. Returns the interval and the chords (built on the
// lower note) that contain the upper note, diatonic ones first.
const TENSION = { 1: '♭9', 2: '9', 3: '♯9', 5: '11', 6: '♯11', 8: '♭13', 9: '13' };
export function interpretDyad(low, high, scale) {
  const r = pc(low), h = pc(high - low), compound = high - low > 12;
  const scaleSet = scale ? makeSet(scale.root, scale.iv) : null;
  const scalePcs = scaleSet ? new Set(scaleSet.pcs) : null;
  const toneLabel = (ivNames, semi) => { const iv = ivNames.map(parseInterval).find(x => pc(x.semis) === semi); return iv ? (iv.label === '1' ? 'R' : iv.label) : null; };
  const spell = (rootPc, ivNames) => (scaleSet && scalePcs.has(rootPc)) ? scaleSet : makeSet(rootPc, ivNames);
  const out = { root: r, interval: DYADS[h] + (compound ? '（オクターブ以上離れています）' : ''), rootInScale: scalePcs ? scalePcs.has(r) : null, highInScale: scalePcs ? scalePcs.has(pc(high)) : null, diatonic: [], others: [] };
  const seen = new Set();
  // diatonic chords on the lower note
  if (scale && scale.iv.length === 7 && scalePcs.has(r)) {
    const steps = scale.iv.map(n => parseInterval(n).semis);
    const d = steps.findIndex(s => pc(scale.root + s) === r);
    out.degree = romanOf(scale.iv, d);
    [false, true].forEach(seventh => {
      const c = diatonic(scale.root, scale.iv, d, seventh);
      const rel = c.semis.map(pc);
      const id = Object.entries(CHORDS).find(([, cc]) => { const k = cc.iv.map(n => pc(parseInterval(n).semis)).sort((a, b) => a - b).join(','); return k === rel.slice().sort((a, b) => a - b).join(','); });
      if (!id) return;
      const [cid, cc] = id, name = spell(r, cc.iv).name(r) + chordSymbol(cid);
      if (rel.includes(h)) { out.diatonic.push({ name, id: cid, tone: toneLabel(cc.iv, h), kind: seventh ? '4和音' : '3和音' }); seen.add(cid); }
      else if (seventh && TENSION[h] && scalePcs.has(pc(high))) out.diatonic.push({ name, id: cid, tone: TENSION[h], kind: 'テンション', tension: true });
    });
  }
  // other chord types on the lower note that contain the upper note (and fit the scale)
  for (const [cid, cc] of Object.entries(CHORDS)) {
    if (seen.has(cid) || cid === 'quartal') continue;
    const rel = cc.iv.map(n => pc(parseInterval(n).semis));
    if (!rel.includes(h)) continue;
    if (scalePcs && rel.some(x => !scalePcs.has(pc(r + x)))) continue;
    out.others.push({ name: spell(r, cc.iv).name(r) + chordSymbol(cid), id: cid, tone: toneLabel(cc.iv, h), size: cc.iv.length });
  }
  out.others.sort((a, b) => a.size - b.size);
  out.others = out.others.slice(0, 8);
  out.rootName = (scaleSet || makeSet(r, ['1'])).name(r);
  out.highName = (scaleSet || makeSet(r, ['1', ['1','b2','2','b3','3','4','b5','5','b6','6','b7','7'][h]])).name(high);
  return out;
}
