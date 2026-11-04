import { NOTE_NAMES, MODES, CHORD_TYPES, pc, makeKey, chordFor, chugNotes, accentNotes, padNotes, suggestChords,
         romanFor, roleLabel, stepsPerBar, lcm, patternFromGrouping, euclid,
         LEAD_LENGTHS, leadTotal, suggestLead, leadRange, chordIndexAt } from './theory.js';
import { TUNINGS, findTuning, PRESETS } from './presets.js';
import { PianoEngine } from './audio.js';
import { buildMidi } from './midi.js';
import { encodeSeed, decodeSeed } from './share.js';
import { mountPractice } from './practice.js';

const $ = id => document.getElementById(id);
const STORE = 'gti-composer:song';
const MAX_BARS = 16, MAX_RIFF = 64;
const audio = new PianoEngine();

const DEFAULT = {
  v: 1, strings: 7, tuning: 'b-std', tonic: 11, mode: 'phrygian', bpm: 120, num: 4, den: 4,
  bars: [{ d: 0, t: '5' }, { d: 1, t: '5' }, { d: 6, t: '5' }, { d: 0, t: '5' }],
  riff: patternFromGrouping('3+3+3+3+2+2'), group: '3+3+3+3+2+2',
  lead: [],
  mix: { pad: true, riff: true, lead: true, click: true, lift: false }
};

let song = structuredClone(DEFAULT);
let selected = 0, variation = 0, undo = [], redo = [];
let playing = false, schedTimer = null, rafId = 0, nextTime = 0, playStep = 0, queue = [], shownStep = -1;
let statusTimer = null;
let leadLen = 2, leadSel = -1, leadVar = 0, fbInput = true, leadCache = null, leadMode = 'replace';

// ── state helpers ──
function sanitize(s) {
  const d = structuredClone(DEFAULT);
  if (!s || typeof s !== 'object') return d;
  const int = (v, lo, hi, def) => Number.isInteger(v) && v >= lo && v <= hi ? v : def;
  d.strings = [6, 7, 8].includes(s.strings) ? s.strings : d.strings;
  d.tuning = findTuning(d.strings, s.tuning).id;
  d.tonic = int(s.tonic, 0, 11, d.tonic);
  d.mode = MODES[s.mode] ? s.mode : d.mode;
  d.bpm = int(s.bpm, 30, 300, d.bpm);
  d.num = int(s.num, 1, 32, d.num);
  d.den = [2, 4, 8, 16].includes(s.den) ? s.den : d.den;
  if (Array.isArray(s.bars) && s.bars.length && s.bars.length <= MAX_BARS)
    d.bars = s.bars.map(b => ({ d: int(b && b.d, 0, 6, 0), t: CHORD_TYPES[b && b.t] ? b.t : '5' }));
  if (Array.isArray(s.riff) && s.riff.length && s.riff.length <= MAX_RIFF)
    d.riff = s.riff.map(v => [0, 1, 2].includes(v) ? v : 0);
  d.group = typeof s.group === 'string' ? s.group.slice(0, 64) : '';
  if (Array.isArray(s.lead)) d.lead = s.lead.slice(0, 512).filter(e => e && Number.isInteger(e.len) && e.len >= 1 && e.len <= 16 && (e.n === null || (Number.isInteger(e.n) && e.n >= 0 && e.n <= 127))).map(e => ({ n: e.n, len: e.len }));
  if (s.mix && typeof s.mix === 'object') ['pad', 'riff', 'lead', 'click', 'lift'].forEach(k => { if (k in s.mix) d.mix[k] = !!s.mix[k]; });
  trimLead(d);
  return d;
}
const key = () => makeKey(song.tonic, song.mode);
const tuning = () => findTuning(song.strings, song.tuning).notes;
const chords = () => { const k = key(); return song.bars.map(b => chordFor(k, b.d, b.t)); };
const S = () => stepsPerBar(song.num, song.den);
const beatSteps = () => Math.max(1, 16 / song.den);
const capacity = (s = song) => stepsPerBar(s.num, s.den) * s.bars.length;
// keep the lead inside the progression; a note crossing the end is shortened
function trimLead(s = song) {
  const cap = capacity(s); let t = 0; const out = [];
  for (const e of s.lead) { if (t >= cap) break; const len = Math.min(e.len, cap - t); out.push({ n: e.n, len }); t += len; }
  s.lead = out;
}
function leadMap() {
  if (leadCache) return leadCache;
  const map = {}; let t = 0;
  song.lead.forEach((e, i) => { map[t] = { ...e, i }; t += e.len; });
  return (leadCache = map);
}

function save() { try { localStorage.setItem(STORE, JSON.stringify(song)); } catch (e) {} }
function commit(fn, keepVariation) {
  undo.push(JSON.stringify(song)); if (undo.length > 80) undo.shift(); redo = [];
  fn(); if (!keepVariation) variation = 0;
  trimLead(); leadCache = null;
  selected = Math.min(selected, song.bars.length - 1);
  if (leadSel >= song.lead.length) leadSel = -1;
  save(); render();
}
function notify(msg) {
  const el = $('status'); el.textContent = msg; el.classList.add('visible');
  clearTimeout(statusTimer); statusTimer = setTimeout(() => el.classList.remove('visible'), 2800);
}
const lift = notes => song.mix.lift ? notes.map(n => n + 12) : notes;

// ── preview single chord ──
async function preview(chord) {
  await audio.ready();
  const t = audio.now + 0.03, tun = tuning();
  audio.play(lift(accentNotes(chord, tun)), t, 0.5, 0.9);
  audio.play(padNotes(chord), t + 0.02, 1.1, 0.5);
}

// ── playback scheduler (look-ahead) ──
function scheduleStep(g, t) {
  const spb = S(), bar = Math.floor(g / spb) % song.bars.length, inBar = g % spb;
  const chord = chords()[bar], tun = tuning(), sps = 60 / song.bpm / 4;
  if (inBar === 0 && song.mix.pad) audio.play(padNotes(chord), t, spb * sps * 0.97, 0.42);
  if (song.mix.click && inBar % beatSteps() === 0) audio.click(t, inBar === 0);
  const ev = leadMap()[g];
  if (song.mix.lead && ev && ev.n !== null) audio.play([ev.n], t, ev.len * sps * 0.92, 0.95);
  const L = song.riff.length, state = song.riff[g % L];
  if (song.mix.riff && state) {
    if (state === 1) audio.play(lift(chugNotes(chord, tun)), t, sps * 0.55, 0.8);
    else {
      let len = 1; while (len < 4 && !song.riff[(g + len) % L]) len++;
      audio.play(lift(accentNotes(chord, tun)), t, sps * len * 0.9, 1);
    }
  }
}
function scheduler() {
  const total = S() * song.bars.length, sps = 60 / song.bpm / 4;
  playStep %= total;
  while (nextTime < audio.now + 0.12) {
    scheduleStep(playStep, nextTime);
    queue.push({ step: playStep, time: nextTime });
    nextTime += sps; playStep = (playStep + 1) % total;
  }
}
function drawPlayhead() {
  const now = audio.now;
  while (queue.length && queue[0].time <= now) { shownStep = queue.shift().step; }
  highlight(shownStep);
  rafId = requestAnimationFrame(drawPlayhead);
}
async function togglePlay() {
  if (playing) return stop();
  await audio.ready();
  playing = true; playStep = 0; queue = []; nextTime = audio.now + 0.08;
  scheduler(); schedTimer = setInterval(scheduler, 25); rafId = requestAnimationFrame(drawPlayhead);
  $('play').textContent = '■ 停止'; $('play').classList.add('on');
}
function stop() {
  playing = false; clearInterval(schedTimer); cancelAnimationFrame(rafId); audio.stopAll();
  queue = []; shownStep = -1; highlight(-1);
  $('play').textContent = '▶ 再生'; $('play').classList.remove('on');
}
let lastBar = -2;
function highlight(g) {
  const spb = S(), bar = g < 0 ? -1 : Math.floor(g / spb) % song.bars.length;
  document.querySelectorAll('.tl-cell.now').forEach(el => el.classList.remove('now'));
  document.querySelectorAll('.pat-cell.now').forEach(el => el.classList.remove('now'));
  if (g >= 0) {
    const c = document.querySelector(`.tl-cell[data-g="${g}"]`); if (c) c.classList.add('now');
    const p = document.querySelector(`.pat-cell[data-i="${g % song.riff.length}"]`); if (p) p.classList.add('now');
    const ev = leadMap()[g];
    if (ev) {
      document.querySelectorAll('.lead-chip.now,.ld-note.now').forEach(el => el.classList.remove('now'));
      document.querySelectorAll(`.lead-chip[data-i="${ev.i}"],.ld-note[data-i="${ev.i}"]`).forEach(el => el.classList.add('now'));
    }
  } else document.querySelectorAll('.lead-chip.now,.ld-note.now').forEach(el => el.classList.remove('now'));
  if (bar !== lastBar) {
    document.querySelectorAll('.bar-card').forEach((el, i) => el.classList.toggle('playing', i === bar));
    lastBar = bar;
    renderFretboard(bar >= 0 ? bar : null);
  }
}

// ── rendering ──
function renderSidebar() {
  $('strings').value = song.strings;
  $('tuning').innerHTML = TUNINGS[song.strings].map(t => `<option value="${t.id}" ${t.id === song.tuning ? 'selected' : ''}>${t.name}</option>`).join('');
  $('tuning-notes').textContent = tuning().slice().reverse().map(n => key().spell.name(n)).join(' ');
  $('tonic').value = song.tonic;
  $('mode').value = song.mode;
  $('mode-hint').textContent = MODES[song.mode].hint;
  $('bpm').value = song.bpm;
  $('num').value = song.num; $('den').value = song.den;
  $('steps-hint').innerHTML = `1小節 = 16分音符 <span>${S()}</span> 個`;
  $('group').value = song.group || '';
  $('riff-len').value = song.riff.length;
  ['pad', 'riff', 'lead', 'click', 'lift'].forEach(k => { $('mix-' + k).checked = song.mix[k]; });
}
function renderMetrics() {
  const k = key(), spb = S(), L = song.riff.length, cyc = lcm(L, spb) / spb;
  $('m-key').innerHTML = `${k.spell.name(k.tonic)} <span class="metric-unit">${MODES[song.mode].name.split(' (')[0]}</span>`;
  $('m-bpm').innerHTML = `${song.bpm}<span class="metric-unit">BPM</span>`;
  $('m-meter').innerHTML = `${song.num}/${song.den}<span class="metric-unit">${spb} steps</span>`;
  $('m-riff').innerHTML = `${L}<span class="metric-unit">steps</span>`;
  $('m-cycle').innerHTML = cyc === 1 ? `1<span class="metric-unit">小節で一致</span>` : `${cyc}<span class="metric-unit">小節で一周</span>`;
}
function renderBars() {
  const cs = chords();
  $('bars').innerHTML = cs.map((c, i) => `
    <div class="bar-card ${i === selected ? 'sel' : ''}" data-i="${i}" tabindex="0" role="button" aria-label="${i + 1}小節目 ${c.name}">
      <div class="bar-no">${String(i + 1).padStart(2, '0')}</div>
      <div class="bar-roman">${c.roman}</div>
      <div class="bar-name">${c.name}</div>
      <div class="bar-role">${roleLabel(c.d)}</div>
    </div>`).join('');
  const c = cs[selected];
  $('sel-label').textContent = `${selected + 1}小節目`;
  $('sel-type').innerHTML = Object.entries(CHORD_TYPES).map(([id, t]) => `<option value="${id}" ${id === c.type ? 'selected' : ''}>${t.label}</option>`).join('');
  const k = key();
  $('degree-row').innerHTML = [0, 1, 2, 3, 4, 5, 6].map(d => `<button class="deg-btn ${d === c.d ? 'on' : ''}" data-d="${d}">${romanFor(k, d)}</button>`).join('');
}
function renderSuggest() {
  const k = key(), list = suggestChords(k, song.bars, selected, variation), type = song.bars[selected].t;
  $('suggest').innerHTML = list.map(s => {
    const c = chordFor(k, s.d, type);
    return `<div class="sg-card" data-d="${s.d}">
      <div class="sg-top"><span class="sg-roman">${s.roman}</span><span class="sg-name">${c.name}</span><button class="sg-play" data-d="${s.d}" aria-label="${c.name} を試聴">▶</button></div>
      <div class="sg-role">${s.role}</div>
      <div class="sg-why">${s.reason}</div>
    </div>`;
  }).join('');
}
function renderRiff() {
  const L = song.riff.length, spb = S(), bars = song.bars.length, beat = beatSteps();
  $('pattern').innerHTML = song.riff.map((v, i) => `<button class="pat-cell s${v}" data-i="${i}" aria-label="ステップ${i + 1}">${v === 2 ? '>' : v === 1 ? '·' : ''}</button>`).join('');
  // lead spans per bar (a note crossing a bar line is drawn in both bars)
  const spans = []; let t = 0;
  song.lead.forEach((e, i) => { spans.push({ ...e, i, start: t }); t += e.len; });
  let html = '';
  for (let b = 0; b < bars; b++) {
    const cols = `grid-template-columns:repeat(${spb},minmax(0,1fr))`;
    html += `<div class="tl-row"><span class="tl-lbl">${String(b + 1).padStart(2, '0')}</span><div class="tl-stack"><div class="tl-cells" style="${cols}">`;
    for (let s = 0; s < spb; s++) {
      const g = b * spb + s, v = song.riff[g % L], head = g % L === 0;
      html += `<span class="tl-cell s${v} ${s % beat === 0 ? 'beat' : ''} ${head ? 'head' : ''}" data-g="${g}"></span>`;
    }
    html += `</div><div class="ld-lane" style="${cols}">`;
    const b0 = b * spb, b1 = b0 + spb;
    spans.filter(e => e.start < b1 && e.start + e.len > b0).forEach(e => {
      const from = Math.max(e.start, b0) - b0 + 1, to = Math.min(e.start + e.len, b1) - b0 + 1;
      html += `<span class="ld-note ${e.n === null ? 'rest' : ''} ${e.i === leadSel ? 'sel' : ''}" data-i="${e.i}" style="grid-column:${from}/${to}">${e.n === null ? '' : key().spell.note(e.n)}</span>`;
    });
    html += '</div></div></div>';
  }
  $('timeline').innerHTML = html;
}

// chord under the lead cursor (selected note, or the next free position)
function leadCursor() {
  const spb = S();
  let pos = leadTotal(song.lead);
  if (leadSel >= 0) pos = leadTotal(song.lead.slice(0, leadSel));
  const idx = chordIndexAt(Math.min(pos, capacity() - 1), spb, song.bars.length);
  return { pos, idx, full: leadSel < 0 && pos >= capacity() };
}
function renderLead() {
  const k = key(), cs = chords(), spb = S(), cur = leadCursor();
  $('lead-len').innerHTML = LEAD_LENGTHS.map(l => `<button class="len-btn ${l.len === leadLen ? 'on' : ''}" data-len="${l.len}" title="${l.label}">${l.sym}<small>${l.label}</small></button>`).join('');
  $('fb-input').checked = fbInput;
  const remain = capacity() - leadTotal(song.lead);
  const barNo = cur.idx + 1, beatNo = Math.floor((cur.pos % spb) / beatSteps()) + 1;
  $('lead-mode').hidden = leadSel < 0;
  document.querySelectorAll('#lead-mode .mode-btn').forEach(b => b.classList.toggle('on', b.dataset.mode === leadMode));
  $('lead-pos').innerHTML = leadSel >= 0
    ? (leadMode === 'insert'
        ? `<span>${leadSel + 1}音目の前</span>に挿入します（${barNo}小節目・${beatNo}拍目）。後ろの音は右にずれます。`
        : `<span>${leadSel + 1}音目</span>を編集中（${barNo}小節目・${beatNo}拍目）。音価ボタンで長さ、指板か候補で高さを変えられます。`)
    : cur.full ? '最後の小節まで埋まりました。音を選んで差し替えるか、小節を増やしてください。'
    : `次は <span>${barNo}小節目・${beatNo}拍目</span>（${cs[cur.idx].name}）。残り ${remain} ステップ`;
  const list = cur.full ? [] : suggestLead(k, cs, leadSel >= 0 ? song.lead.slice(0, leadSel) : song.lead, spb, beatSteps(), tuning(), leadLen, leadVar);
  $('lead-suggest').innerHTML = list.map(c => `
    <div class="sg-card ld-cand" data-n="${c.n}">
      <div class="sg-top"><span class="sg-roman">${c.name}</span><span class="sg-name">${c.ct ? 'コードトーン' : 'スケール音'}</span><button class="sg-play" data-n="${c.n}" aria-label="${c.name} を試聴">▶</button></div>
      <div class="sg-role">${c.tag}</div>
      <div class="sg-why">${c.why}</div>
    </div>`).join('') || '<p class="hint">候補はありません。</p>';
  $('lead-chips').innerHTML = song.lead.map((e, i) => `<button class="lead-chip ${e.n === null ? 'rest' : ''} ${i === leadSel ? 'sel' : ''}" data-i="${i}">${e.n === null ? '休' : key().spell.note(e.n)}<small>${(LEAD_LENGTHS.find(l => l.len === e.len) || { label: e.len + '/16' }).label}</small></button>`).join('') || '<span class="hint">まだ音がありません。候補か指板から最初の一音を選んでください。</span>';
  $('lead-del').disabled = leadSel < 0; $('lead-append').hidden = leadSel < 0;
  $('lead-back').disabled = !song.lead.length; $('lead-clear').disabled = !song.lead.length;
}

function renderFretboard(barIndex) {
  const k = key(), tun = tuning(), cs = chords();
  const cur = leadCursor();
  const useLead = barIndex == null && fbInput;
  const idx = barIndex != null ? barIndex : useLead ? cur.idx : selected;
  const chord = cs[Math.max(0, Math.min(idx, cs.length - 1))];
  // reference note: the note being edited, or the last played lead note
  const before = leadSel >= 0 ? song.lead.slice(0, leadSel + 1) : song.lead;
  const ref = useLead ? (before.filter(e => e.n !== null).pop() || {}).n : undefined;
  const n = tun.length, frets = 24, W = 1000, padL = 34, padR = 10, top = 16, gap = 22, H = top * 2 + gap * (n - 1);
  const scaleLen = (W - padL - padR) / (1 - Math.pow(2, -frets / 12));
  const fx = f => padL + scaleLen * (1 - Math.pow(2, -f / 12));
  const cx = f => f === 0 ? padL - 1 : (fx(f) + fx(f - 1)) / 2;
  let svg = `<svg viewBox="0 0 ${W} ${H + 14}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="指板：${chord.name}" class="${useLead ? 'input' : ''}">`;
  svg += `<rect x="${padL}" y="${top - 8}" width="${W - padL - padR}" height="${gap * (n - 1) + 16}" fill="#0f0f0f" rx="2"/>`;
  [3, 5, 7, 9, 15, 17, 19, 21].forEach(f => svg += `<circle cx="${cx(f)}" cy="${top + gap * (n - 1) / 2}" r="3.5" fill="#222"/>`);
  [12, 24].forEach(f => { svg += `<circle cx="${cx(f)}" cy="${top + gap * (n - 1) / 2 - gap}" r="3.5" fill="#222"/><circle cx="${cx(f)}" cy="${top + gap * (n - 1) / 2 + gap}" r="3.5" fill="#222"/>`; });
  for (let f = 0; f <= frets; f++) svg += `<line x1="${fx(f)}" y1="${top - 8}" x2="${fx(f)}" y2="${top + gap * (n - 1) + 8}" stroke="${f === 0 ? '#888' : '#2a2a2a'}" stroke-width="${f === 0 ? 3 : 1}"/>`;
  for (let f = 1; f <= frets; f++) if ([3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(f)) svg += `<text x="${cx(f)}" y="${H + 10}" fill="#555" font-size="9" text-anchor="middle" font-family="Barlow">${f}</text>`;
  let hits = '';
  for (let i = 0; i < n; i++) {
    const s = n - 1 - i, y = top + gap * i, open = tun[s];
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#555" stroke-width="${0.6 + s * 0.22}"/>`;
    svg += `<text x="${padL - 12}" y="${y + 3.5}" fill="#888" font-size="10" text-anchor="middle" font-family="Barlow">${k.spell.name(open)}</text>`;
    for (let f = 0; f <= frets; f++) {
      const m = open + f, p = pc(m), x = cx(f);
      const inChord = chord.pcs.includes(p), inScale = k.scale.includes(p), isRoot = p === chord.root;
      if (inChord) svg += `<circle cx="${x}" cy="${y}" r="8" fill="${isRoot ? '#86efac' : '#8c4dff'}"/><text x="${x}" y="${y + 3}" fill="#0a0a0a" font-size="8" font-weight="700" text-anchor="middle" font-family="Barlow">${k.spell.name(p)}</text>`;
      else if (inScale) svg += `<circle cx="${x}" cy="${y}" r="5.5" fill="#000" stroke="#38bdf8" stroke-width="1.2"/>${p === k.tonic ? `<circle cx="${x}" cy="${y}" r="2" fill="#38bdf8"/>` : ''}`;
      if (ref !== undefined && m === ref) svg += `<circle cx="${x}" cy="${y}" r="10.5" fill="none" stroke="#fff" stroke-width="1.6"/>`;
      if (useLead) { const x0 = f === 0 ? padL - 14 : fx(f - 1), x1 = f === 0 ? padL + 2 : fx(f); hits += `<rect class="fb-hit" data-m="${m}" x="${x0}" y="${y - gap / 2}" width="${x1 - x0}" height="${gap}"><title>${k.spell.note(m)}</title></rect>`; }
    }
  }
  svg += hits + '</svg>';
  $('fretboard').innerHTML = svg;
  $('fb-chord').textContent = `${idx + 1}小節目 · ${chord.roman} · ${chord.name}`;
  $('fb-mode').textContent = useLead ? '指板をクリックしてリードに入力（白い輪＝直前の音）' : '';
}
async function renderSeed() {
  try { const seed = await encodeSeed(song); $('seed-display').textContent = seed; $('seed-display').title = seed; } catch (e) {}
}
function render() {
  leadCache = null; renderSidebar(); renderMetrics(); renderBars(); renderSuggest(); renderRiff(); renderLead(); renderFretboard(null); renderSeed();
  $('undo').disabled = !undo.length; $('redo').disabled = !redo.length;
  $('preset-desc').textContent = $('preset-desc').dataset.text || 'テクニック別の進行例です。読み込むとキー・テンポ・リフも置き換わります。';
}

// ── lead editing ──
async function auditionLead(n, withChord = true) {
  await audio.ready();
  const t = audio.now + 0.03, sps = 60 / song.bpm / 4, cur = leadCursor();
  if (withChord) audio.play(padNotes(chords()[cur.idx]), t, 1.0, 0.35);
  audio.play([n], t, Math.min(1.6, Math.max(0.25, leadLen * sps)), 0.95);
}
// apply a lead change, then report notes pushed past the last bar
function fitCommit(fn) {
  const before = song.lead.length;
  commit(() => { fn(); }, true);
  const lost = before - song.lead.length + (fitCommit.added || 0);
  fitCommit.added = 0;
  if (lost > 0) notify(`最後の小節からはみ出した ${lost} 音を削除しました（↶ で戻せます）`);
}
function putLead(n) {
  if (leadSel >= 0 && leadMode === 'replace') {
    commit(() => { song.lead[leadSel].n = n; }, true);
    if (n !== null) auditionLead(n);
    return;
  }
  if (song.lead.length >= 512) return notify('音符と休符は最大512個です');
  if (leadSel >= 0) {
    // insert before the selected note; later notes shift right
    if (n !== null) auditionLead(n);
    const at = leadSel;
    fitCommit.added = 1;
    fitCommit(() => { song.lead.splice(at, 0, { n, len: leadLen }); });
    if (song.lead.length > at + 1) leadSel = at + 1; else leadSel = -1;
    leadVar = 0; render();
    return;
  }
  const remain = capacity() - leadTotal(song.lead);
  if (remain <= 0) return notify('最後の小節まで埋まっています。小節を増やすか、音を選んで差し替え・挿入してください');
  const len = Math.min(leadLen, remain);
  if (n !== null) auditionLead(n);
  commit(() => { song.lead.push({ n, len }); }, true);
  leadVar = 0; renderLead();
  if (len < leadLen) notify(`小節の終わりに合わせて ${len} ステップに縮めました`);
}

// ── export ──
function exportMidi() {
  const spb = S(), progSteps = spb * song.bars.length, L = song.riff.length;
  const reps = Math.min(16, lcm(L, progSteps) / progSteps), total = progSteps * reps, cs = chords(), tun = tuning();
  const pad = [], riff = [];
  for (let r = 0; r < reps; r++) song.bars.forEach((b, i) => pad.push({ step: r * progSteps + i * spb, len: spb, notes: padNotes(cs[i]) }));
  for (let g = 0; g < total; g++) {
    const v = song.riff[g % L]; if (!v) continue;
    const c = cs[Math.floor(g / spb) % song.bars.length];
    if (v === 1) riff.push({ step: g, len: 0.6, notes: chugNotes(c, tun), vel: 92 });
    else { let len = 1; while (len < 4 && !song.riff[(g + len) % L] && g + len < total) len++; riff.push({ step: g, len: len * 0.9, notes: accentNotes(c, tun), vel: 116 }); }
  }
  const lead = []; let lt = 0;
  song.lead.forEach(e => { if (e.n !== null) lead.push({ step: lt, len: e.len * 0.95, notes: [e.n], vel: 100 }); lt += e.len; });
  const leadAll = []; for (let r = 0; r < reps; r++) lead.forEach(e => leadAll.push({ ...e, step: e.step + r * progSteps }));
  const bytes = buildMidi({ bpm: song.bpm, num: song.num, den: song.den, totalSteps: total, pad, riff, lead: leadAll });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes], { type: 'audio/midi' }));
  a.download = `riff_${NOTE_NAMES[song.tonic].replace('#', 's')}_${song.mode}_${song.bpm}bpm.mid`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  notify(reps > 1 ? `リフが一周する ${reps} 回分で書き出しました` : 'MIDI を書き出しました');
}
async function copy(text, msg) {
  try { await navigator.clipboard.writeText(text); notify(msg); }
  catch (e) { prompt('コピーしてください', text); }
}

// ── events ──
function bind() {
  $('strings').addEventListener('change', e => commit(() => { song.strings = +e.target.value; song.tuning = TUNINGS[song.strings][0].id; }));
  $('tuning').addEventListener('change', e => commit(() => { song.tuning = e.target.value; }));
  $('key-to-low').addEventListener('click', () => commit(() => { song.tonic = pc(Math.min(...tuning())); }));
  $('tonic').addEventListener('change', e => commit(() => { song.tonic = +e.target.value; }));
  $('mode').addEventListener('change', e => commit(() => { song.mode = e.target.value; }));
  $('bpm').addEventListener('change', e => commit(() => { song.bpm = Math.max(30, Math.min(300, parseInt(e.target.value) || 120)); }));
  $('num').addEventListener('change', e => commit(() => { song.num = Math.max(1, Math.min(32, parseInt(e.target.value) || 4)); }));
  $('den').addEventListener('change', e => commit(() => { song.den = +e.target.value; }));
  ['pad', 'riff', 'lead', 'click', 'lift'].forEach(k => $('mix-' + k).addEventListener('change', e => { song.mix[k] = e.target.checked; save(); renderSeed(); }));

  $('presets').innerHTML = PRESETS.map(p => `<button class="preset-btn" data-id="${p.id}" title="${p.desc}"><span class="preset-icon">${p.icon}</span>${p.name}</button>`).join('');
  $('presets').addEventListener('click', e => {
    const b = e.target.closest('.preset-btn'); if (!b) return;
    const p = PRESETS.find(x => x.id === b.dataset.id);
    commit(() => {
      song.mode = p.mode; song.bpm = p.bpm; song.num = p.meter[0]; song.den = p.meter[1];
      song.bars = p.bars.map(([d, t]) => ({ d, t })); song.group = p.grouping; song.riff = patternFromGrouping(p.grouping);
      song.tonic = pc(Math.min(...tuning()));
      selected = 0;
    });
    $('preset-desc').dataset.text = p.desc; $('preset-desc').textContent = p.desc;
    notify(`「${p.name}」を読み込みました`);
  });

  $('bars').addEventListener('click', e => { const c = e.target.closest('.bar-card'); if (!c) return; selected = +c.dataset.i; variation = 0; renderBars(); renderSuggest(); renderFretboard(selected); preview(chords()[selected]); });
  $('bars').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.click(); } });
  $('add-bar').addEventListener('click', () => { if (song.bars.length >= MAX_BARS) return notify(`小節は最大 ${MAX_BARS} までです`); commit(() => { const s = suggestChords(key(), song.bars, song.bars.length)[0]; song.bars.push({ d: s.d, t: song.bars[song.bars.length - 1].t }); }); selected = song.bars.length - 1; render(); });
  $('dup-bars').addEventListener('click', () => { if (song.bars.length * 2 > MAX_BARS) return notify(`小節は最大 ${MAX_BARS} までです`); commit(() => { song.bars = song.bars.concat(structuredClone(song.bars)); }); });
  $('del-bar').addEventListener('click', () => { if (song.bars.length <= 1) return; commit(() => { song.bars.splice(selected, 1); }); });
  $('sel-type').addEventListener('change', e => commit(() => { song.bars[selected].t = e.target.value; }));
  $('type-all').addEventListener('click', () => commit(() => { const t = song.bars[selected].t; song.bars.forEach(b => b.t = t); }));
  $('degree-row').addEventListener('click', e => { const b = e.target.closest('.deg-btn'); if (!b) return; commit(() => { song.bars[selected].d = +b.dataset.d; }); preview(chords()[selected]); });
  $('suggest').addEventListener('click', e => {
    const k = key(), type = song.bars[selected].t;
    const play = e.target.closest('.sg-play');
    if (play) { e.stopPropagation(); preview(chordFor(k, +play.dataset.d, type)); return; }
    const card = e.target.closest('.sg-card'); if (!card) return;
    commit(() => { song.bars[selected].d = +card.dataset.d; });
    preview(chords()[selected]);
  });
  $('reroll').addEventListener('click', () => { variation++; renderSuggest(); });

  $('pattern').addEventListener('click', e => { const c = e.target.closest('.pat-cell'); if (!c) return; commit(() => { const i = +c.dataset.i; song.riff[i] = (song.riff[i] + 1) % 3; song.group = ''; }, true); });
  $('group-apply').addEventListener('click', () => { const p = patternFromGrouping($('group').value, $('group-fill').checked); if (!p) return notify('例：3+3+2 のように数字を + でつないでください'); commit(() => { song.riff = p; song.group = $('group').value; }); });
  $('euclid-apply').addEventListener('click', () => { const p = euclid(+$('eu-k').value, +$('eu-n').value, +$('eu-r').value); if (!p) return notify('ステップ数は 1〜64 です'); commit(() => { song.riff = p; song.group = ''; }); });
  $('riff-len').addEventListener('change', e => { const n = Math.max(1, Math.min(MAX_RIFF, parseInt(e.target.value) || 16)); commit(() => { const r = song.riff; song.riff = Array.from({ length: n }, (_, i) => r[i] || 0); song.group = ''; }); });
  $('riff-clear').addEventListener('click', () => commit(() => { song.riff = song.riff.map(() => 0); song.group = ''; }));
  $('riff-fill').addEventListener('click', () => commit(() => { song.riff = song.riff.map((v, i) => i === 0 ? 2 : 1); song.group = ''; }));

  // ── lead ──
  $('lead-len').addEventListener('click', e => {
    const b = e.target.closest('.len-btn'); if (!b) return; leadLen = +b.dataset.len;
    if (leadSel >= 0 && leadMode === 'replace' && song.lead[leadSel] && song.lead[leadSel].len !== leadLen) {
      const len = leadLen; fitCommit(() => { song.lead[leadSel].len = len; });
    } else renderLead();
  });
  $('lead-mode').addEventListener('click', e => { const b = e.target.closest('.mode-btn'); if (!b) return; leadMode = b.dataset.mode; leadVar = 0; renderLead(); });
  $('fb-input').addEventListener('change', e => { fbInput = e.target.checked; renderFretboard(null); });
  $('lead-reroll').addEventListener('click', () => { leadVar++; renderLead(); });
  $('lead-suggest').addEventListener('click', e => {
    const play = e.target.closest('.sg-play');
    if (play) { e.stopPropagation(); auditionLead(+play.dataset.n); return; }
    const c = e.target.closest('.ld-cand'); if (c) putLead(+c.dataset.n);
  });
  $('fretboard').addEventListener('click', e => { const h = e.target.closest('.fb-hit'); if (h) putLead(+h.dataset.m); });
  $('lead-rest').addEventListener('click', () => putLead(null));
  $('lead-back').addEventListener('click', () => { if (!song.lead.length) return; commit(() => { song.lead.pop(); }, true); leadSel = -1; render(); });
  $('lead-clear').addEventListener('click', () => { commit(() => { song.lead = []; }); leadSel = -1; render(); });
  $('lead-del').addEventListener('click', () => { if (leadSel < 0) return; commit(() => { song.lead.splice(leadSel, 1); }, true); leadSel = -1; render(); });
  $('lead-append').addEventListener('click', () => { leadSel = -1; renderLead(); renderRiff(); renderFretboard(null); });
  const pickChip = i => { leadSel = leadSel === i ? -1 : i; leadVar = 0; if (leadSel >= 0 && leadMode === 'replace') leadLen = song.lead[i].len; renderLead(); renderRiff(); renderFretboard(null); const e = song.lead[i]; if (leadSel >= 0 && e && e.n !== null) auditionLead(e.n, false); };
  $('lead-chips').addEventListener('click', e => { const c = e.target.closest('.lead-chip'); if (c) pickChip(+c.dataset.i); });
  $('timeline').addEventListener('click', e => { const c = e.target.closest('.ld-note'); if (c) pickChip(+c.dataset.i); });

  $('play').addEventListener('click', togglePlay);
  $('undo').addEventListener('click', () => { if (!undo.length) return; redo.push(JSON.stringify(song)); song = JSON.parse(undo.pop()); save(); render(); });
  $('redo').addEventListener('click', () => { if (!redo.length) return; undo.push(JSON.stringify(song)); song = JSON.parse(redo.pop()); save(); render(); });
  document.addEventListener('keydown', e => {
    if (e.target.closest('input,select,textarea')) return;
    if (e.code === 'Space' && !$('tab-practice').classList.contains('on')) { e.preventDefault(); togglePlay(); }
    if ((e.key === 'Delete' || e.key === 'Backspace') && leadSel >= 0) { e.preventDefault(); $('lead-del').click(); }
    if (e.key === 'Escape' && leadSel >= 0) { $('lead-append').click(); }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? $('redo') : $('undo')).click(); }
  });

  $('export-midi').addEventListener('click', exportMidi);
  $('seed-copy').addEventListener('click', async () => copy(await encodeSeed(song), 'シードをコピーしました'));
  $('seed-share').addEventListener('click', async () => copy(location.origin + location.pathname + '#s=' + await encodeSeed(song), '共有 URL をコピーしました'));
  $('seed-apply').addEventListener('click', async () => {
    try { const s = sanitize(await decodeSeed($('seed-input').value)); commit(() => { song = s; }); $('seed-err').textContent = ''; notify('シードを読み込みました'); }
    catch (e) { $('seed-err').textContent = e.message || 'シードを読み込めませんでした。'; }
  });
  $('reset').addEventListener('click', () => commit(() => { song = structuredClone(DEFAULT); }));

  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
    $('view-compose').hidden = t.id !== 'tab-compose'; $('view-practice').hidden = t.id !== 'tab-practice';
    if (t.id === 'tab-practice' && playing) stop();
  }));

  // ▲▼ number buttons (generator style)
  document.querySelectorAll('.num-wrap').forEach(w => {
    const inp = w.querySelector('input');
    w.querySelectorAll('.num-btn').forEach(btn => btn.addEventListener('click', () => {
      const st = parseFloat(inp.step) || 1, v = (parseFloat(inp.value) || 0) + (btn.dataset.dir === 'up' ? st : -st);
      const lo = inp.min !== '' ? +inp.min : -Infinity, hi = inp.max !== '' ? +inp.max : Infinity;
      inp.value = Math.max(lo, Math.min(hi, v)); inp.dispatchEvent(new Event('change', { bubbles: true }));
    }));
  });
}

// ── boot ──
async function boot() {
  const ENH = ['C','C♯ / D♭','D','D♯ / E♭','E','F','F♯ / G♭','G','G♯ / A♭','A','A♯ / B♭','B'];
  $('tonic').innerHTML = ENH.map((n, i) => `<option value="${i}">${n}</option>`).join('');
  $('mode').innerHTML = Object.entries(MODES).map(([id, m]) => `<option value="${id}">${m.name}</option>`).join('');
  let loaded = false;
  const m = location.hash.match(/^#s=([zj][A-Za-z0-9_-]+)/);
  if (m) {
    try { song = sanitize(await decodeSeed(m[1])); loaded = true; notify('共有された曲を読み込みました'); }
    catch (e) { notify('共有リンクを読み込めませんでした'); }
    history.replaceState(null, '', location.pathname);
  }
  if (!loaded) { try { const s = localStorage.getItem(STORE); if (s) song = sanitize(JSON.parse(s)); } catch (e) {} }
  bind(); render();
  mountPractice($('view-practice'), notify);
  window.addEventListener('pagehide', () => { if (playing) stop(); });
}
boot();
