// ── Position logic: N-notes-per-string patterns and chord voicing search ──
import { pc } from './theory.js';

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
  const need = new Set(chordPcs.map(pc));
  if (opts.omit5) { const fifth = pc(rootPc + 7); if (need.size > 3) need.delete(fifth); }
  for (let lo = 0; lo < n; lo++) for (let hi = lo + opts.minStrings - 1; hi < n; hi++) {
    for (let base = 0; base <= frets; base++) {
      // candidate frets per string inside [base, base+span-1], plus open strings
      const opts1 = [];
      for (let s = lo; s <= hi; s++) {
        const c = [];
        if (opts.allowOpen && need.has(pc(tuning[s]))) c.push(0);
        for (let f = Math.max(1, base); f < base + opts.span && f <= frets; f++) if (chordPcs.includes(pc(tuning[s] + f))) c.push(f);
        if (!c.length) { opts1.length = 0; break; }
        opts1.push(c);
      }
      if (!opts1.length) continue;
      const pick = new Array(opts1.length);
      const walk = i => {
        if (out.length >= 400) return;
        if (i === opts1.length) {
          const fretted = pick.filter(f => f > 0);
          if (fretted.length && Math.min(...fretted) !== base && base > 0) return; // anchor at base to avoid duplicates
          if (fretted.length && Math.max(...fretted) - Math.min(...fretted) >= opts.span) return;
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
