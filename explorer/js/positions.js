// ── Position logic: N-notes-per-string patterns and chord voicing search ──
import { pc } from './theory.js?v=111';

// Scale pattern: starting on degree `start` on the lowest string, take `nps`
// consecutive scale notes per string going up. Returns Set of "string:fret".
export function npsPattern(tuning, rootPc, semis, start, nps, frets) {
  const sorted = [...new Set(semis.map(s => pc(s)))].sort((a, b) => a - b);
  const len = sorted.length;
  const low = tuning[0];
  // first occurrence of the start degree on the lowest string (fret >= 0)
  let first = low; while (pc(first) !== pc(rootPc + sorted[start % len])) first++;
  for (let shift = 0; shift <= 24; shift += 12) {
    const cells = new Set(); let ok = true;
    let deg = start, oct = 0;
    const pitchAt = (d, o) => rootPc + sorted[d % len] + 12 * (o + Math.floor(d / len));
    // align octave so the first pitch equals `first + shift`
    const base = first + shift - pitchAt(start, 0);
    for (let s = 0; s < tuning.length && ok; s++) {
      for (let k = 0; k < nps; k++) {
        const m = pitchAt(deg, oct) + base, f = m - tuning[s];
        if (f < 0 || f > frets) { ok = false; break; }
        cells.add(s + ':' + f); deg++;
      }
    }
    if (ok) return cells;
  }
  return new Set();
}

// Chord voicings on contiguous string sets within a fret span.
// opts: { span, minStrings, rootBass, allowOpen, requireAll, omit5 }
export function findVoicings(tuning, chordPcs, rootPc, frets, opts) {
  const n = tuning.length, out = [], seen = new Set();
  const need = new Set((opts.need || chordPcs).map(pc));
  if (opts.omit5) { const fifth = pc(rootPc + 7); if (need.size > 3) need.delete(fifth); }
  const maxStr = opts.maxStrings || n;
  for (let lo = 0; lo < n; lo++) for (let hi = lo + opts.minStrings - 1; hi < n && hi - lo + 1 <= maxStr; hi++) {
    for (let base = 0; base <= frets; base++) {
      // candidate frets per string inside [base, base+span-1], plus open strings
      const opts1 = [];
      for (let s = lo; s <= hi; s++) {
        const c = [];
        if (opts.allowOpen && base <= 3 && need.has(pc(tuning[s]))) c.push(0); // open strings only near the nut
        for (let f = Math.max(1, base); f < base + opts.span && f <= frets; f++) if (chordPcs.includes(pc(tuning[s] + f))) c.push(f);
        if (!c.length) { opts1.length = 0; break; }
        opts1.push(c);
      }
      if (!opts1.length) continue;
      const pick = new Array(opts1.length);
      const walk = i => {
        if (out.length >= (opts.limit || 400)) return;
        if (i === opts1.length) {
          const fretted = pick.filter(f => f > 0);
          if (fretted.length && Math.min(...fretted) !== base && base > 0) return; // anchor at base to avoid duplicates
          if (fretted.length && Math.max(...fretted) - Math.min(...fretted) >= opts.span) return;
          if (opts.noUnison && new Set(pick.map((f, k) => tuning[lo + k] + f)).size < pick.length) return; // same pitch twice
          const pcsHit = new Set(pick.map((f, k) => pc(tuning[lo + k] + f)));
          if (opts.requireAll && [...need].some(p => !pcsHit.has(p))) return;
          if (opts.rootBass && pc(tuning[lo] + pick[0]) !== rootPc) return;
          const frs = Array(n).fill(null); pick.forEach((f, k) => frs[lo + k] = f);
          const keyStr = frs.join(',');
          if (seen.has(keyStr)) return; seen.add(keyStr);
          const used = pick.filter(f => f > 0);
          out.push({ frets: frs, low: used.length ? Math.min(...used) : 0, high: used.length ? Math.max(...used) : 0, strings: hi - lo + 1 });
          return;
        }
        for (const f of opts1[i]) { pick[i] = f; walk(i + 1); }
      };
      walk(0);
    }
  }
  return out.sort((a, b) => a.low - b.low || b.strings - a.strings || a.high - b.high);
}


// ── Common chord forms (CAGED-style), written as fret offsets from the root
// fret on the root string, in standard tuning, low string → high string.
// x = muted. They are re-placed on the real tuning by pitch.
const X = null;
export const FORMS = {
  maj:   [{ name: 'E型', rs: 0, rel: [0,2,2,1,0,0] }, { name: 'A型', rs: 1, rel: [X,0,2,2,2,0] }, { name: 'D型', rs: 2, rel: [X,X,0,2,3,2] }, { name: 'C型', rs: 1, rel: [X,0,-1,-3,-2,-3] }, { name: 'G型', rs: 0, rel: [0,-1,-3,-3,-3,0] }],
  m:     [{ name: 'Em型', rs: 0, rel: [0,2,2,0,0,0] }, { name: 'Am型', rs: 1, rel: [X,0,2,2,1,0] }, { name: 'Dm型', rs: 2, rel: [X,X,0,2,3,1] }, { name: 'Cm型', rs: 1, rel: [X,0,-2,-3,-2,X] }, { name: 'Gm型', rs: 0, rel: [0,-2,-3,-3,X,X] }],
  '7':   [{ name: 'E7型', rs: 0, rel: [0,2,0,1,0,0] }, { name: 'A7型', rs: 1, rel: [X,0,2,0,2,0] }, { name: 'D7型', rs: 2, rel: [X,X,0,2,1,2] }, { name: 'C7型', rs: 1, rel: [X,0,-1,0,-2,X] }, { name: 'G7型', rs: 0, rel: [0,-1,-3,-3,-3,-2] }],
  maj7:  [{ name: 'Emaj7型', rs: 0, rel: [0,X,1,1,0,X] }, { name: 'Amaj7型', rs: 1, rel: [X,0,2,1,2,0] }, { name: 'Dmaj7型', rs: 2, rel: [X,X,0,2,2,2] }, { name: 'Cmaj7型', rs: 1, rel: [X,0,-1,-3,-3,-3] }],
  m7:    [{ name: 'Em7型', rs: 0, rel: [0,2,0,0,0,0] }, { name: 'Am7型', rs: 1, rel: [X,0,2,0,1,0] }, { name: 'Dm7型', rs: 2, rel: [X,X,0,2,1,1] }, { name: 'E型（4弦）', rs: 0, rel: [0,X,0,0,0,X] }],
  m7b5:  [{ name: '6弦ルート', rs: 0, rel: [0,X,0,0,-1,X] }, { name: '5弦ルート', rs: 1, rel: [X,0,1,0,1,X] }, { name: '4弦ルート', rs: 2, rel: [X,X,0,1,1,1] }],
  dim7:  [{ name: '6弦ルート', rs: 0, rel: [0,X,-1,0,-1,X] }, { name: '5弦ルート', rs: 1, rel: [X,0,1,-1,1,X] }, { name: '4弦ルート', rs: 2, rel: [X,X,0,1,0,1] }],
  sus2:  [{ name: 'Asus2型', rs: 1, rel: [X,0,2,2,0,0] }, { name: 'Dsus2型', rs: 2, rel: [X,X,0,2,3,0] }, { name: 'E型', rs: 0, rel: [0,2,4,4,X,X] }],
  sus4:  [{ name: 'Esus4型', rs: 0, rel: [0,2,2,2,0,0] }, { name: 'Asus4型', rs: 1, rel: [X,0,2,2,3,0] }, { name: 'Dsus4型', rs: 2, rel: [X,X,0,2,3,3] }],
  '5':   [{ name: '6弦ルート', rs: 0, rel: [0,2,2,X,X,X] }, { name: '5弦ルート', rs: 1, rel: [X,0,2,2,X,X] }, { name: '4弦ルート', rs: 2, rel: [X,X,0,2,3,X] }],
  add9:  [{ name: 'C型', rs: 1, rel: [X,0,-1,-3,0,-3] }, { name: '6弦ルート', rs: 0, rel: [0,X,1,1,0,2] }, { name: '5弦ルート', rs: 1, rel: [X,0,-1,-3,0,0] }],
  '6':   [{ name: '6弦ルート', rs: 0, rel: [0,X,-1,1,0,X] }, { name: '5弦ルート', rs: 1, rel: [X,0,2,2,2,2] }],
  m6:    [{ name: '6弦ルート', rs: 0, rel: [0,X,-1,0,0,X] }, { name: '5弦ルート', rs: 1, rel: [X,0,2,-1,1,X] }],
  '9':   [{ name: '5弦ルート', rs: 1, rel: [X,0,-1,0,0,X] }, { name: '6弦ルート', rs: 0, rel: [0,X,0,1,0,2] }],
  m9:    [{ name: '5弦ルート', rs: 1, rel: [X,0,-2,0,0,X] }],
  maj9:  [{ name: '5弦ルート', rs: 1, rel: [X,0,-1,1,0,X] }],
  '7sus4': [{ name: '6弦ルート', rs: 0, rel: [0,2,0,2,0,0] }, { name: '5弦ルート', rs: 1, rel: [X,0,2,0,3,0] }],
  '7s9': [{ name: '5弦ルート', rs: 1, rel: [X,0,-1,0,1,X] }],
  dim:   [{ name: '6弦ルート', rs: 0, rel: [0,1,2,0,X,X] }, { name: '5弦ルート', rs: 1, rel: [X,0,1,2,1,X] }, { name: '4弦ルート', rs: 2, rel: [X,X,0,1,3,1] }],
  aug:   [{ name: 'C型', rs: 1, rel: [X,0,-1,-2,-2,X] }, { name: 'G型', rs: 0, rel: [0,-1,-2,-3,-3,0] }, { name: 'D型', rs: 2, rel: [X,X,0,3,3,2] }],
  mMaj7: [{ name: 'Em(maj7)型', rs: 0, rel: [0,2,1,0,0,0] }, { name: 'Am(maj7)型', rs: 1, rel: [X,0,2,1,1,0] }, { name: 'Dm(maj7)型', rs: 2, rel: [X,X,0,2,2,1] }],
  aug7:  [{ name: '6弦ルート', rs: 0, rel: [0,X,0,1,1,0] }, { name: '5弦ルート', rs: 1, rel: [X,0,3,0,2,1] }],
  '7b5': [{ name: '6弦ルート', rs: 0, rel: [0,1,0,1,X,X] }, { name: '5弦ルート', rs: 1, rel: [X,0,1,0,2,X] }],
  '7b9': [{ name: '6弦ルート', rs: 0, rel: [0,X,0,1,0,1] }, { name: '5弦ルート', rs: 1, rel: [X,0,-1,0,-1,X] }],
  '13':  [{ name: '6弦ルート', rs: 0, rel: [0,X,0,1,2,X] }, { name: '5弦ルート', rs: 1, rel: [X,0,X,0,2,2] }],
  '69':  [{ name: '5弦ルート', rs: 1, rel: [X,0,-1,-1,0,0] }],
  m11:   [{ name: '6弦ルート', rs: 0, rel: [0,0,0,0,0,2] }, { name: '5弦ルート', rs: 1, rel: [X,0,0,0,1,0] }],
  madd9: [{ name: 'C型', rs: 1, rel: [X,0,-2,-3,0,X] }, { name: '5弦ルート', rs: 1, rel: [X,0,2,4,1,0] }],
  add11: [{ name: 'C型', rs: 1, rel: [X,0,-1,-3,-2,-2] }, { name: '5弦ルート', rs: 1, rel: [X,0,0,2,2,0] }],
  maj7s11: [{ name: '6弦ルート', rs: 0, rel: [0,X,1,1,-1,-1] }, { name: '5弦ルート', rs: 1, rel: [X,0,-1,1,X,-1] }],
  '7s11': [{ name: '6弦ルート', rs: 0, rel: [0,X,0,1,-1,X] }, { name: '5弦ルート', rs: 1, rel: [X,0,-1,0,X,-1] }],
  susb2: [{ name: '6弦ルート', rs: 0, rel: [0,2,3,X,X,X] }, { name: '5弦ルート', rs: 1, rel: [X,0,2,3,X,X] }, { name: '4弦ルート', rs: 2, rel: [X,X,0,2,4,X] }]
};
const STD = [40,45,50,55,59,64];

// Place every form along the neck on the real tuning (forms use the top six strings).
export function chordForms(tuning, chordId, rootPc, frets, chordPcs) {
  const forms = FORMS[chordId]; if (!forms || tuning.length < 6) return [];
  const n = tuning.length, base = n - 6, out = [], seen = new Set();
  forms.forEach(form => {
    const offs = form.rel.map((r, s) => r === null ? null : STD[s] + r - (STD[form.rs] + 0)); // pitch offset from root
    const rsReal = base + form.rs;
    for (let f = 0; f <= frets; f++) {
      const rootPitch = tuning[rsReal] + f; if (pc(rootPitch) !== pc(rootPc)) continue;
      const fr = Array(n).fill(null); let bad = false;
      offs.forEach((o, s) => {
        if (o === null) return;
        const ff = rootPitch + o - tuning[base + s];
        if (ff >= 0 && ff <= frets) fr[base + s] = ff;
        else if (s === 0 && form.rs !== 0) fr[base + s] = null; // lowest string only: mute (e.g. drop tunings)
        else bad = true;
      });
      if (bad) continue;
      const used = fr.map((ff, s) => ff === null ? null : tuning[s] + ff).filter(m => m !== null);
      if (used.length < 3) continue;
      const have = new Set(used.map(m => pc(m - rootPc)));
      // the 5th may be left out; with five or more tones, the 9th (then 11th) too
      let need = [...new Set(chordPcs.map(p => pc(p - rootPc)))];
      for (const drop of [7, 2, 5]) if (need.length > 4 && need.includes(drop)) need = need.filter(x => x !== drop);
      if (need.length === chordPcs.length) need = need.filter(x => x !== 7 || chordPcs.length < 4);
      if (need.some(x => !have.has(x))) continue;
      const fretted = fr.filter(ff => ff !== null && ff > 0);
      const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
      if (span > 4) continue;
      const k = fr.join(','); if (seen.has(k)) continue; seen.add(k);
      out.push({ name: form.name, frets: fr, low: fretted.length ? Math.min(...fretted) : 0, high: fretted.length ? Math.max(...fretted) : 0 });
    }
  });
  return out.sort((a, b) => a.low - b.low || a.name.localeCompare(b.name));
}

// Sweep-picking arpeggio shapes: consecutive chord tones going up across a
// contiguous string set, one or two notes per string, inside a fret span.
export function sweepShapes(tuning, chordPcs, rootPc, frets, opts) {
  const n = tuning.length, out = [], seen = new Set();
  const span = opts.span || 5, sizes = opts.sizes || [3, 4, 5, 6, 7, 8];
  const tonesAbove = m => { for (let x = m + 1; x < m + 13; x++) if (chordPcs.includes(pc(x))) return x; return null; };
  for (const size of sizes) {
    if (size > n) continue;
    const startLen = out.length; // the cap applies per string count, so "all" contains every count
    for (let lo = 0; lo + size - 1 < n; lo++) {
      const hi = lo + size - 1;
      for (let f0 = 0; f0 <= frets; f0++) {
        if (f0 === 0 && !opts.allowOpen) continue;
        const start = tuning[lo] + f0; if (!chordPcs.includes(pc(start))) continue;
        if (opts.rootStart && pc(start) !== pc(rootPc)) continue;
        // depth-first: each next chord tone goes on the same string (max 2 per string) or the next one
        const walk = (notes, s, perStr) => {
          if (out.length - startLen >= 400) return;
          const last = notes[notes.length - 1];
          const fs = notes.map(x => x.f).filter(f => f > 0);
          if (fs.length && Math.max(...fs) - Math.min(...fs) > span - 1) return;
          if (s === hi && perStr >= 1 && notes.length >= size) {
            // finish once the top string has its notes
            const k = notes.map(x => x.s + ':' + x.f).join(' ');
            if (!seen.has(k) && notes.length >= size) { seen.add(k); out.push({ notes: notes.slice(), lo, hi, low: fs.length ? Math.min(...fs) : 0, high: fs.length ? Math.max(...fs) : 0, size }); }
          }
          const next = tonesAbove(tuning[last.s] + last.f); if (next === null) return;
          if (perStr < 2) { const f = next - tuning[s]; if (f <= frets && (f > 0 || opts.allowOpen)) walk([...notes, { s, f, m: next }], s, perStr + 1); }
          if (s < hi) { const f = next - tuning[s + 1]; if (f >= (opts.allowOpen ? 0 : 1) && f <= frets) walk([...notes, { s: s + 1, f, m: next }], s + 1, 1); }
        };
        walk([{ s: lo, f: f0, m: start }], lo, 1);
      }
    }
  }
  // keep shapes that end on the top string with one or two notes and don't revisit a string
  return out.filter(x => x.notes[x.notes.length - 1].s === x.hi)
    .filter((x, i, arr) => !arr.some((y, j) => j !== i && y.notes.length > x.notes.length && x.notes.every((nn, k) => y.notes[k] && y.notes[k].s === nn.s && y.notes[k].f === nn.f) && y.hi === x.hi && y.lo === x.lo))
    .sort((a, b) => b.size - a.size || a.low - b.low);
}


// ── Forms for any chord: start from the common major / minor / 7th shapes and
// move each note to the nearest chord tone (at most two frets), keeping shapes
// that still contain the chord and stay playable. Used when no form is registered.
const BASES = ['maj', 'm', '7', 'maj7', 'm7', 'sus4', 'sus2'];
export function derivedForms(tuning, chordPcs, rootPc, frets) {
  if (tuning.length < 6) return [];
  const n = tuning.length, base = n - 6, out = [], seen = new Set();
  const rel = [...new Set(chordPcs.map(p => pc(p - rootPc)))];
  // with many tones, the 5th (then 9th, 11th) may be left out
  let need = rel.slice();
  for (const drop of [7, 2, 5]) if (need.length > 4 && need.includes(drop)) need = need.filter(x => x !== drop);
  const nearest = o => {
    let best = null;
    for (const t of rel) for (const k of [-12, 0, 12]) { const cand = t + k + 12 * Math.floor(o / 12), d = cand - o; if (Math.abs(d) <= 2 && (!best || Math.abs(d) < Math.abs(best.d) || (Math.abs(d) === Math.abs(best.d) && d < best.d))) best = { o: cand, d }; }
    return best;
  };
  BASES.forEach(bid => (FORMS[bid] || []).forEach(form => {
    const offs = form.rel.map((r, s) => r === null ? null : STD[s] + r - STD[form.rs]);
    let moves = 0;
    const moved = offs.map(o => { if (o === null) return null; if (rel.includes(pc(o))) return o; const nb = nearest(o); if (nb) moves++; return nb ? nb.o : null; });
    if (moved[form.rs] === null || pc(moved[form.rs]) !== 0) return;
    const rsReal = base + form.rs;
    for (let f = 0; f <= frets; f++) {
      const rootPitch = tuning[rsReal] + f; if (pc(rootPitch) !== pc(rootPc)) continue;
      const fr = Array(n).fill(null); let bad = false;
      moved.forEach((o, s) => {
        if (o === null) return;
        const ff = rootPitch + o - tuning[base + s];
        if (ff >= 0 && ff <= frets) fr[base + s] = ff; else if (s === 0 && form.rs !== 0) fr[base + s] = null; else bad = true;
      });
      if (bad) continue;
      const used = fr.map((ff, s) => ff === null ? null : tuning[s] + ff).filter(m => m !== null);
      if (used.length < 3) continue;
      const have = new Set(used.map(m => pc(m - rootPc)));
      if (need.some(x => !have.has(x))) continue;
      const fretted = fr.filter(ff => ff !== null && ff > 0);
      const ps = playScore(fr); if (!ps.ok) continue;   // drop cramped shapes
      const k = fr.join(','); if (seen.has(k)) continue; seen.add(k);
      out.push({ name: form.name.replace(/^(E|A|D|C|G)(m|7|maj7|m7|sus4|sus2)?型$/, '$1型') + '（変形）', frets: fr, low: fretted.length ? Math.min(...fretted) : 0, high: fretted.length ? Math.max(...fretted) : 0, cost: moves * 3 + ps.score });
    }
  }));
  // in each neck region keep the most natural shapes (fewest changed notes, easiest grip)
  const best = out.slice().sort((a, b) => a.cost - b.cost);
  const kept = best.filter((x, i) => best.slice(0, i).filter(y => Math.abs(y.low - x.low) <= 1).length < 2);
  return kept.sort((a, b) => a.low - b.low || a.cost - b.cost);
}


// ── Playability of a chord shape (frets per string, null = muted) ──
// fingers: one barre/finger for the lowest fret, one finger for each higher note.
export function playScore(fr) {
  const sounding = fr.map((f, s) => f === null ? null : s).filter(x => x !== null);
  const fretted = fr.filter(f => f !== null && f > 0);
  if (!fretted.length) return { ok: true, score: 0 };
  const lo = Math.min(...fretted), hi = Math.max(...fretted), span = hi - lo;
  const fingers = (fretted.includes(lo) ? 1 : 0) + fretted.filter(f => f > lo).length;
  let inner = 0; for (let s = sounding[0]; s <= sounding[sounding.length - 1]; s++) if (fr[s] === null) inner++;
  const ok = fingers <= 4 && span <= 3 + (fretted.length <= 3 ? 1 : 0) && inner <= 1;
  return { ok, score: span * 2 + inner * 3 + Math.max(0, fingers - 3) * 2 };
}

// How "standard" a sweep shape is: fits inside a chord-form box, starts on the
// root (or 3rd/5th), at most two strings carry two notes, compact span.
export function sweepScore(sw, rootPc, formBoxes) {
  const perStr = {}; sw.notes.forEach(x => perStr[x.s] = (perStr[x.s] || 0) + 1);
  const doubles = Object.values(perStr).filter(v => v === 2).length;
  const span = sw.high - sw.low;
  const start = pc(sw.notes[0].m - rootPc);
  let score = 0;
  const inBox = formBoxes.some(b => sw.low >= b.low - 1 && sw.high <= b.high + 1);
  if (inBox) score += 5;
  // stretch on one string (two notes on the same string)
  const byStr = {}; sw.notes.forEach(x => (byStr[x.s] = byStr[x.s] || []).push(x.f));
  const stretch = Math.max(0, ...Object.values(byStr).map(fs => fs.length > 1 ? Math.max(...fs) - Math.min(...fs) : 0));
  score -= stretch >= 5 ? 3 : stretch === 4 ? 1 : 0;
  score += start === 0 ? 3 : 1;
  score += doubles <= 2 ? 2 : -2 * (doubles - 2);
  score += span <= 3 ? 2 : span === 4 ? 1 : -2;
  if (perStr[sw.hi] && perStr[sw.hi] <= 2) score += 1;
  return { score, common: inBox && doubles <= 2 && span <= 4 && stretch <= 4 };
}
