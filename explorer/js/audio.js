// ── Audio: locally synthesised piano-like voice + metronome click ──
// Voices: a few simple synthesised timbres. a = attack, s = level after the first decay, r = release share, br = brightness
const VOICES = {
  piano:  { partials: [[1, 1], [2, 0.42], [3, 0.16], [4.01, 0.07], [5.02, 0.03]], first: 'triangle', a: 0.006, s: 0.35, br: 9, lp: 600 },
  guitar: { partials: [[1, 1], [2, 0.62], [3, 0.42], [4, 0.3], [5, 0.2], [6, 0.12], [7, 0.07]], first: 'triangle', a: 0.003, s: 0.14, br: 5, lp: 500 },
  organ:  { partials: [[1, 1], [2, 0.7], [3, 0.45], [4, 0.3], [6, 0.2], [8, 0.1]], first: 'sine', a: 0.02, s: 1, br: 14, lp: 2500, flat: true },
  bass:   { partials: [[1, 1], [2, 0.38], [3, 0.12]], first: 'triangle', a: 0.006, s: 0.45, br: 3, lp: 200 }
};
export const VOICE_NAMES = { piano: 'ピアノ', guitar: 'ギター', organ: 'オルガン', bass: 'ベース' };
export const CLICK_NAMES = { click: 'クリック', wood: 'ウッドブロック', hat: 'ハイハット', rim: 'リムショット', snare: 'スネア', kick: 'キック' };
// Instrument interface: play(notes, when, dur, vel). Swap this class later for guitar/drum engines.

export class PianoEngine {
  constructor() { this.ctx = null; this.master = null; this.voices = new Set(); this.vol = 0.8; this.muted = false; this.voice = 'piano'; this.clickKind = 'click'; this.noise = null; }
  setVoice(v) { if (VOICES[v]) this.voice = v; }

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
      const nb = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = nb;
    }
    if (this.ctx.state !== 'running') await this.ctx.resume();
    return this.ctx;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  play(notes, when, dur, vel = 1) {
    const ctx = this.ctx; if (!ctx) return;
    const V = VOICES[this.voice] || VOICES.piano;
    const level = 0.22 * vel / Math.sqrt(Math.max(1, notes.length));
    notes.forEach((n, idx) => {
      const f = 440 * Math.pow(2, (n - 69) / 12);
      const t0 = when + idx * 0.004;
      const tail = V.slow ? 0.6 : Math.min(1.2, 0.25 + dur * 0.6);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.exponentialRampToValueAtTime(level, t0 + V.a);
      if (!V.flat) env.gain.exponentialRampToValueAtTime(level * V.s, t0 + Math.max(V.a + 0.01, Math.min(0.5, dur * 0.5 + 0.05)));
      else env.gain.setValueAtTime(level * V.s, t0 + dur);
      env.gain.setValueAtTime(level * V.s, t0 + dur);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + tail * 0.4);
      // brightness falls with time and with pitch, like a struck string
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      const bright = Math.min(9000, f * V.br + V.lp);
      lp.frequency.setValueAtTime(bright, t0);
      lp.frequency.exponentialRampToValueAtTime(Math.max(300, f * 2.2), t0 + Math.min(1.2, dur + 0.3));
      lp.Q.value = 0.4;
      env.connect(lp); lp.connect(this.master);
      V.partials.forEach(([mult, amp], i) => {
        if (f * mult > 12000) return;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = i === 0 ? V.first : 'sine';
        o.frequency.value = f * mult;
        o.detune.value = i ? (i % 2 ? 2.5 : -2.5) : 0;
        g.gain.value = amp * (V.first === 'sawtooth' && i === 0 ? 0.5 : 1);
        o.connect(g); g.connect(env);
        o.start(t0); o.stop(t0 + dur + tail * 0.4 + 0.05);
        this.voices.add(o);
        o.onended = () => { this.voices.delete(o); o.disconnect(); g.disconnect(); if (i === 0) { env.disconnect(); lp.disconnect(); } };
      });
    });
  }

  // metronome / count-in / drum sounds, all synthesised. accent = the strong version (higher click, harder hit); vel = 0..1 loudness
  click(when, accent, kind, vel) {
    const ctx = this.ctx; if (!ctx) return;
    kind = kind || this.clickKind; const V = vel == null ? 1 : vel;
    const out = (node, stopAt) => { this.voices.add(node); node.onended = () => { this.voices.delete(node); node.disconnect(); }; node.start(when); node.stop(when + stopAt); };
    const gainEnv = (peak, dec) => { const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * V), when + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, when + dec); g.connect(this.master); return g; };
    const noiseSrc = (filterType, freq, q) => { const n = ctx.createBufferSource(); n.buffer = this.noise; const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = freq; fl.Q.value = q || 0.7; n.connect(fl); return { n, fl }; };
    const tom = (f1, f2, dec, peak) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(f1, when); o.frequency.exponentialRampToValueAtTime(f2, when + dec * 0.45);
      o.connect(gainEnv(peak, dec)); out(o, dec + 0.05);
      const { n, fl } = noiseSrc('bandpass', 1800, 0.9); fl.connect(gainEnv(0.12, 0.03)); out(n, 0.05);
    };
    if (kind === 'hat') {
      const { n, fl } = noiseSrc('highpass', 7500); fl.connect(gainEnv(accent ? 0.2 : 0.13, accent ? 0.09 : 0.05)); out(n, 0.12);
    } else if (kind === 'hatO') {
      const { n, fl } = noiseSrc('highpass', 6800); fl.connect(gainEnv(accent ? 0.2 : 0.14, 0.38)); out(n, 0.42);
      const b = noiseSrc('bandpass', 9500, 1.4); b.fl.connect(gainEnv(0.07, 0.3)); out(b.n, 0.34);
    } else if (kind === 'tomH') tom(accent ? 300 : 270, 175, 0.26, accent ? 0.5 : 0.42);
    else if (kind === 'tomL') tom(accent ? 220 : 195, 125, 0.32, accent ? 0.52 : 0.44);
    else if (kind === 'tomF') tom(accent ? 160 : 145, 88, 0.42, accent ? 0.56 : 0.48);
    else if (kind === 'crash') {
      const { n, fl } = noiseSrc('highpass', 4800); fl.connect(gainEnv(accent ? 0.3 : 0.22, 1.5)); out(n, 1.55);
      const b = noiseSrc('bandpass', 8200, 0.9); b.fl.connect(gainEnv(0.13, 1.1)); out(b.n, 1.15);
    } else if (kind === 'ride') {
      // bow: a small cluster of inharmonic partials, a bright tick and a short shimmer
      [3100, 4350, 5420, 6870].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500; o.connect(hp); hp.connect(gainEnv((accent ? 0.05 : 0.036) / (1 + i * 0.25), 0.55 - i * 0.04)); out(o, 0.6); });
      const { n, fl } = noiseSrc('highpass', 9000); fl.connect(gainEnv(accent ? 0.09 : 0.06, 0.2)); out(n, 0.24);
    } else if (kind === 'rim') {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = accent ? 1900 : 1500; o.connect(gainEnv(accent ? 0.22 : 0.15, 0.04)); out(o, 0.06);
      const { n, fl } = noiseSrc('bandpass', 3200, 1.2); fl.connect(gainEnv(0.1, 0.02)); out(n, 0.04);
    } else if (kind === 'kick') {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(accent ? 140 : 110, when); o.frequency.exponentialRampToValueAtTime(42, when + 0.1);
      o.connect(gainEnv(accent ? 0.5 : 0.36, 0.16)); out(o, 0.2);
    } else if (kind === 'snare') {
      const { n, fl } = noiseSrc('bandpass', 1900, 0.8); fl.connect(gainEnv(accent ? 0.26 : 0.17, 0.12)); out(n, 0.16);
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 190; o.connect(gainEnv(0.14, 0.09)); out(o, 0.12);
    } else if (kind === 'wood') {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = accent ? 1320 : 880; o.connect(gainEnv(accent ? 0.28 : 0.2, 0.07)); out(o, 0.09);
    } else {
      // click: high (accent) / middle / low (soft)
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = accent ? 1760 : (V < 0.6 ? 880 : 1180); o.connect(gainEnv(accent ? 0.09 : 0.05, 0.035)); out(o, 0.05);
    }
  }

  stopAll() { for (const o of this.voices) { try { o.stop(); } catch (e) {} } this.voices.clear(); }
}
