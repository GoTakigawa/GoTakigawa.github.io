// ── Audio: locally synthesised piano-like voice + metronome click ──
// Instrument interface: play(notes, when, dur, vel). Swap this class later for guitar/drum engines.

export class PianoEngine {
  constructor() { this.ctx = null; this.master = null; this.voices = new Set(); this.vol = 0.8; this.muted = false; }

  // volume 0..1 (squared for a natural feel) and mute, applied smoothly to the master gain
  setLevel(vol, muted) {
    this.vol = vol; this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : vol * vol, this.ctx.currentTime, 0.02);
  }

  async ready() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.vol * this.vol;
      this.master.connect(comp); comp.connect(this.ctx.destination);
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this.ctx;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  play(notes, when, dur, vel = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const level = 0.22 * vel / Math.sqrt(Math.max(1, notes.length));
    notes.forEach((n, idx) => {
      const f = 440 * Math.pow(2, (n - 69) / 12);
      const t0 = when + idx * 0.004;
      const tail = Math.min(1.2, 0.25 + dur * 0.6);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(level, t0 + 0.006);
      env.gain.exponentialRampToValueAtTime(level * 0.35, t0 + Math.min(0.5, dur * 0.5 + 0.05));
      env.gain.setValueAtTime(level * 0.35, t0 + dur);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + tail * 0.4);
      // brightness falls with time and with pitch, like a struck string
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      const bright = Math.min(9000, f * 9 + 600);
      lp.frequency.setValueAtTime(bright, t0);
      lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 2.2), t0 + Math.min(1.2, dur + 0.3));
      lp.Q.value = 0.4;
      env.connect(lp); lp.connect(this.master);
      const partials = [[1, 1], [2, 0.42], [3, 0.16], [4.01, 0.07], [5.02, 0.03]];
      partials.forEach(([mult, amp], i) => {
        if (f * mult > 12000) return;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = i === 0 ? 'triangle' : 'sine';
        o.frequency.value = f * mult;
        o.detune.value = i ? (i % 2 ? 2.5 : -2.5) : 0;
        g.gain.value = amp;
        o.connect(g); g.connect(env);
        o.start(t0); o.stop(t0 + dur + tail * 0.4 + 0.05);
        this.voices.add(o);
        o.onended = () => { this.voices.delete(o); o.disconnect(); g.disconnect(); if (i === 0) { env.disconnect(); lp.disconnect(); } };
      });
    });
  }

  click(when, accent) {
    const ctx = this.ctx; if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1760 : 1180;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(accent ? 0.09 : 0.05, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
    o.connect(g); g.connect(this.master);
    o.start(when); o.stop(when + 0.05);
    this.voices.add(o); o.onended = () => { this.voices.delete(o); o.disconnect(); g.disconnect(); };
  }

  stopAll() { for (const o of this.voices) { try { o.stop(); } catch (e) {} } this.voices.clear(); }
}
