// Drum / click pattern. drum = { res: steps per beat, bars: pattern length in bars, swing: { mode: 'off'|'8'|'16', amt: 50..80 },
// rows: { instrumentId: 'string of 0..2 per step' } } where 0 = off, 1 = soft, 2 = strong
export const DRUM_INSTR = [
  { id: 'crash', label: 'クラッシュ' }, { id: 'ride', label: 'ライド' }, { id: 'hatO', label: 'ハット（オープン）' }, { id: 'hat', label: 'ハット' },
  { id: 'tomH', label: 'ハイタム' }, { id: 'tomL', label: 'ロータム' }, { id: 'tomF', label: 'フロアタム' },
  { id: 'snare', label: 'スネア' }, { id: 'kick', label: 'キック' }, { id: 'click', label: 'クリック' }
];
export const DRUM_VEL = [0, 0.5, 1];
export function swingShift(pos, sw) {
  if (!sw || sw.mode === 'off') return 0;
  const frac = pos - Math.floor(pos), near = x => Math.abs(frac - x) < 1e-6, d = (sw.amt / 100 - 0.5);
  if (sw.mode === '8') return near(0.5) ? d : 0;
  return near(0.25) || near(0.75) ? d * 0.5 : 0;
}
export function drumBar(a, t, beatDur, beats, drum, barIdx = 0) {
  const res = drum.res || 4, bars = drum.bars || 1, per = beats * res, off = (barIdx % bars) * per;
  for (const id of Object.keys(drum.rows || {})) {
    const row = drum.rows[id];
    for (let i = 0; i < per; i++) {
      const c = +(row[off + i] || 0); if (!c) continue;
      const pos = i / res + swingShift(i / res, drum.swing);
      a.click(t + pos * beatDur, c === 2, id, DRUM_VEL[c]);
    }
  }
}

export class Player {
  // hooks: bars() → number of bars, opts() → { bpm, beats, clickOn, countIn, loop }, sched(bar, t, beatDur, beats) schedules the sound
  // of one bar and may call player.at(time, fn) for screen updates; onBar(bar, countIn), onEnd()
  constructor(audio, hooks) { this.audio = audio; this.h = hooks; this.running = false; this.timer = 0; this.raf = 0; this.queue = []; }
  at(t, fn) { this.queue.push({ t, fn }); }
  async start(fromBar = 0) {
    await this.audio.ready();
    this.stop(true);
    const o = this.h.opts();
    this.running = true; this.bar = fromBar; this.countLeft = o.countIn ? 1 : 0; this.next = this.audio.now + 0.12; this.queue = [];
    this.timer = setInterval(() => this.pump(), 25);
    const loop = () => { this.raf = requestAnimationFrame(loop); const now = this.audio.now; while (this.queue.length && this.queue[0].t <= now + 0.005) this.queue.shift().fn(); };
    this.raf = requestAnimationFrame(loop);
    this.pump();
  }
  pump() {
    if (!this.running) return;
    const a = this.audio, n = this.h.bars();
    while (this.next < a.now + 0.2) {
      const o = this.h.opts(), beatDur = 60 / o.bpm, t = this.next;
      if (this.countLeft > 0) {
        for (let b = 0; b < o.beats; b++) a.click(t + b * beatDur, b === 0, 'click');
        this.at(t, () => this.h.onBar(-1, true));
        this.countLeft--; this.next = t + o.beats * beatDur; continue;
      }
      if (this.bar >= n) {
        if (o.loop) this.bar = 0;
        else { this.at(t, () => { this.stop(); this.h.onEnd(); }); this.next = Infinity; break; }
      }
      const bar = this.bar;
      if (o.clickOn && o.drum) drumBar(a, t, beatDur, o.beats, o.drum, bar);
      this.at(t, () => this.h.onBar(bar, false));
      this.h.sched(bar, t, beatDur, o.beats);
      this.bar++; this.next = t + o.beats * beatDur;
    }
  }
  jump(bar) { if (this.running) { this.bar = bar; this.queue = this.queue.filter(e => e.t <= this.audio.now); this.audio.stopAll(); this.next = this.audio.now + 0.06; } }
  stop(silent) {
    clearInterval(this.timer); cancelAnimationFrame(this.raf); this.timer = this.raf = 0; this.queue = [];
    if (this.running) this.audio.stopAll();
    this.running = false;
  }
}
