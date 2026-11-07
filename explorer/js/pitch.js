// Pitch detection from the microphone / audio interface (YIN), no dependencies.

// YIN: returns { freq, clarity } or null. buf = Float32 time-domain samples.
export function yin(buf, sr, minF = 30, maxF = 1400, thr = 0.15) {
  const W = buf.length >> 1, tauMax = Math.min(W - 1, Math.floor(sr / minF)), tauMin = Math.max(2, Math.floor(sr / maxF));
  const cm = new Float32Array(tauMax + 1);
  cm[0] = 1; let run = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    let d = 0;
    for (let j = 0; j < W; j++) { const x = buf[j] - buf[j + tau]; d += x * x; }
    run += d; cm[tau] = run > 0 ? d * tau / run : 1;
  }
  let tau = -1;
  for (let t = tauMin; t < tauMax; t++) {
    if (cm[t] < thr) { while (t + 1 < tauMax && cm[t + 1] < cm[t]) t++; tau = t; break; }
  }
  if (tau < 0) return null;
  // parabolic interpolation around the minimum
  const a = cm[tau - 1], b = cm[tau], c = cm[tau + 1], den = a - 2 * b + c;
  const better = den !== 0 ? tau + (a - c) / (2 * den) : tau;
  return { freq: sr / better, clarity: 1 - b };
}

export const rms = buf => { let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); };

// ── Several notes at once (a chord): harmonic-sum salience + greedy cancellation on a magnitude spectrum ──
// mag: linear magnitudes of an FFT of size fftSize. Returns MIDI numbers (low → high).
const HW = [0, 1, .8, .62, .5, .4, .32];
export function detectNotes(mag, sr, fftSize, o = {}) {
  const lo = o.lo || 38, hi = o.hi || 88, maxN = o.maxNotes || 6; o = { rel: 0.3, ...o };
  const binHz = sr / fftSize, sp = Float32Array.from(mag), top = Math.min(sp.length - 1, Math.floor(4200 / binHz));
  const peak = (f) => {
    const c = f / binHz, w = Math.max(1, Math.round(f * 0.02 / binHz)); let v = 0, k = -1;
    for (let i = Math.max(1, Math.round(c) - w); i <= Math.min(top, Math.round(c) + w); i++) if (sp[i] > v) { v = sp[i]; k = i; }
    return { v, k, w };
  };
  // noise floor: median level in the playing range
  const seg = Array.from(sp.subarray(Math.floor(70 / binHz), Math.floor(2500 / binHz))).sort((x, y) => x - y);
  const floor = (seg[seg.length >> 1] || 0) * 4;
  const out = []; let first = 0;
  for (let it = 0; it < maxN; it++) {
    let best = null;
    for (let m = lo; m <= hi; m++) {
      if (out.includes(m)) continue;
      const f0 = 440 * Math.pow(2, (m - 69) / 12); let sSum = 0, wSum = 0;
      for (let h = 1; h <= 6; h++) { if (f0 * h > 4000) break; sSum += HW[h] * peak(f0 * h).v; wSum += HW[h]; }
      const sal = sSum / (wSum ? 1 : 1);
      if (!best || sal > best.sal) best = { m, sal, f0, wSum };
    }
    if (!best) break;
    if (it === 0) first = best.sal;
    const amp = best.sal / best.wSum, fund = peak(best.f0).v;
    if (best.sal < first * o.rel || best.sal < floor * 3 || fund < amp * 0.25) { if (it === 0 && best.sal < floor * 3) break; if (it > 0) break; }
    out.push(best.m);
    // take this note's harmonics out of the spectrum so they are not read as other notes
    for (let h = 1; h <= 6; h++) { if (best.f0 * h > 4000) break; const pk = peak(best.f0 * h); if (pk.k > 0) { const sub = amp * HW[h]; for (let i = pk.k - 1; i <= pk.k + 1; i++) if (i > 0 && i <= top) sp[i] = Math.max(0, sp[i] - sub * (i === pk.k ? 1 : 0.5)); } }
  }
  return out.sort((x, y) => x - y);
}

// Streams detections to onFrame({ freq, clarity, level }) about every 20 ms.
export class PitchListener {
  constructor(onFrame, onChord) { this.onFrame = onFrame; this.onChord = onChord; this.mode = 'auto'; this.kind = 'single'; this.cnt = 0; this.n = 0; this.ctx = null; this.stream = null; this.timer = 0; }
  async start(deviceId) {
    await this.stop();
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    if (deviceId) audio.deviceId = { exact: deviceId };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.an = this.ctx.createAnalyser(); this.an.fftSize = 4096; this.an.smoothingTimeConstant = 0;
    const mute = this.ctx.createGain(); mute.gain.value = 0;      // keep the graph pulled without any playback
    this.sp = this.ctx.createAnalyser(); this.sp.fftSize = 16384; this.sp.smoothingTimeConstant = 0.3; src.connect(this.sp);   // spectrum for chords
    this.db = new Float32Array(this.sp.frequencyBinCount); this.mag = new Float32Array(this.sp.frequencyBinCount);
    src.connect(this.an); this.an.connect(mute); mute.connect(this.ctx.destination);
    this.buf = new Float32Array(this.an.fftSize); this.kind = 'single'; this.cnt = 0; this.lastNotes = null;
    this.timer = setInterval(() => this.tick(), 20);
  }
  spectrumNotes() {
    this.sp.getFloatFrequencyData(this.db);
    for (let i = 0; i < this.db.length; i++) this.mag[i] = Math.pow(10, this.db[i] / 20);
    return detectNotes(this.mag, this.ctx.sampleRate, this.sp.fftSize);
  }
  singleReading() {
    // three window lengths: notes from B3 up are answered from the newest 1024 samples (~21 ms), notes down to ~100 Hz
    // from 2048 (~43 ms), and only the low strings wait for the full 4096 (~85 ms)
    const sr = this.ctx.sampleRate, n = this.buf.length;
    let r = yin(this.buf.subarray(n - 1024), sr, sr / 510);
    if (!r || r.freq < 250) {
      r = yin(this.buf.subarray(n - 2048), sr, sr / 1022);
      if (!r || r.freq < 100) r = yin(this.buf, sr);
    }
    return r && r.clarity > 0.8 ? r : null;
  }
  // mode: 'single' | 'chord' | 'auto'. In auto the kind follows what is heard: two or more pitch classes in the
  // spectrum = chord, one clear pitch = single note. It changes at the start of a new sound (quickly) or after
  // ~300 ms of steady evidence, so a ringing chord is not flipped to a single note as it decays.
  tick() {
    if (!this.an) return;
    this.an.getFloatTimeDomainData(this.buf);
    const level = rms(this.buf), now = performance.now(), tickNo = ++this.n;
    if (level < 0.006) {
      if (!this.wasSilent) { this.wasSilent = true; this.silentSince = now; }
      this.env = (this.env || 0) * 0.9;
      if (this.mode !== 'chord' && !(this.mode === 'auto' && this.kind === 'chord')) this.onFrame({ freq: null, clarity: 0, level });
      if (this.mode !== 'single' && tickNo % 5 === 0 && this.onChord) this.onChord({ notes: [], level });
      return;
    }
    const attack = (this.wasSilent && now - this.silentSince > 250) || (level > (this.env || 0) * 1.8 && level > 0.02 && now - (this.lastAttack || 0) > 150);
    this.wasSilent = false; this.env = (this.env || 0) * 0.9 + level * 0.1;
    if (attack) { this.lastAttack = now; this.attackUntil = now + 300; this.cnt = 0; }
    const needSpec = this.mode === 'chord' || (this.mode === 'auto' && tickNo % 2 === 0);
    if (needSpec) this.lastNotes = this.spectrumNotes();
    const r = this.mode === 'chord' ? null : this.singleReading();
    let kind = this.mode;
    if (this.mode === 'auto') {
      const poly = this.lastNotes && new Set(this.lastNotes.map(m => m % 12)).size >= 2;
      const vote = poly ? 'chord' : (r ? 'single' : null);
      if (vote && vote !== this.kind) {
        if (++this.cnt >= (now < this.attackUntil ? 4 : 15)) { this.kind = vote; this.cnt = 0; this.lastNotes = vote === 'single' ? null : this.lastNotes; this.onKind && this.onKind(vote); }
      } else this.cnt = 0;
      kind = this.kind;
    }
    if (kind === 'chord') { if (tickNo % 5 === 0 && this.onChord) this.onChord({ notes: this.lastNotes || [], level }); }
    else this.onFrame(r ? { freq: r.freq, clarity: r.clarity, level } : { freq: null, clarity: 0, level });
  }
  async stop() {
    clearInterval(this.timer); this.timer = 0;
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx) { try { await this.ctx.close(); } catch (e) {} }
    this.stream = this.ctx = this.an = null;
  }
  get running() { return !!this.stream; }
}
