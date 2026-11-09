// ── Bar-by-bar playback clock: schedules sound a little ahead on the audio clock and fires the screen updates on time ──
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
        for (let b = 0; b < o.beats; b++) a.click(t + b * beatDur, b === 0);
        this.at(t, () => this.h.onBar(-1, true));
        this.countLeft--; this.next = t + o.beats * beatDur; continue;
      }
      if (this.bar >= n) {
        if (o.loop) this.bar = 0;
        else { this.at(t, () => { this.stop(); this.h.onEnd(); }); this.next = Infinity; break; }
      }
      if (o.clickOn) for (let b = 0; b < o.beats; b++) a.click(t + b * beatDur, b === 0);
      const bar = this.bar;
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
