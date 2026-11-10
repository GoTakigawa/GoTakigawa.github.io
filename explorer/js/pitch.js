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
  // high-cut: a guitar's upper harmonics (strong on bright pickups / distortion) look like other notes, so the spectrum is
  // rolled off above ~2 kHz (2nd order) before looking for notes
  const hc = o.legacy ? 0 : (o.hc ?? 2000); if (hc > 0) for (let i = 0; i < sp.length; i++) { const r = (i * binHz) / hc; sp[i] /= Math.sqrt(1 + r * r * r * r); }
  const peak = (f) => {
    const c = f / binHz, w = Math.max(1, Math.round(f * 0.02 / binHz)); let v = 0, k = -1;
    for (let i = Math.max(1, Math.round(c) - w); i <= Math.min(top, Math.round(c) + w); i++) if (sp[i] > v) { v = sp[i]; k = i; }
    return { v, k, w };
  };
  // noise floor: median level in the playing range
  const seg = Array.from(sp.subarray(Math.floor(70 / binHz), Math.floor(2500 / binHz))).sort((x, y) => x - y);
  const floor = (seg[seg.length >> 1] || 0) * 4;
  const out = [], sals = []; let first = 0;
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
    out.push(best.m); sals.push(best.sal);
    // take this note's harmonics out of the spectrum so they are not read as other notes: as measured, up to the 10th
    // (legacy: a modelled amount, up to the 6th - kept for the single / chord decision, whose thresholds were tuned on it)
    const CH = o.legacy ? 6 : 10;
    for (let h = 1; h <= CH; h++) { if (best.f0 * h > 4000) break; const pk = peak(best.f0 * h); if (pk.k > 0) { const sub = o.legacy ? amp * HW[h] : pk.v; for (let i = pk.k - 1; i <= pk.k + 1; i++) if (i > 0 && i <= top) sp[i] = Math.max(0, sp[i] - sub * (i === pk.k ? 1 : 0.5)); } }
  }
  // keep the relative strength of each note (1 = the strongest) alongside the sorted list
  const order = out.map((m, i) => ({ m, w: first ? sals[i] / first : 1 })).sort((x, y) => x.m - y.m);
  const res = order.map(o => o.m); res.weights = order.map(o => o.w);
  return res;
}

// Streams detections to onFrame({ freq, clarity, level }) about every 20 ms.
export class PitchListener {
  constructor(onFrame, onChord) { this.onFrame = onFrame; this.onChord = onChord; this.mode = 'auto'; this.kind = 'single'; this.cnt = 0; this.n = 0; this.ctx = null; this.stream = null; this.timer = 0; this.minHz = 40; this.loMidi = 38; }
  // lowest pitch to look for: Hz for the single-note search, MIDI number for the chord spectrum
  setLow(hz, midi) { this.minHz = Math.max(24, Math.min(40, hz)); this.loMidi = Math.max(20, Math.min(38, Math.round(midi))); }
  async start(deviceId) {
    await this.stop();
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, latency: { ideal: 0 } };
    if (deviceId) audio.deviceId = { exact: deviceId };
    this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    // same sample rate as the input device (no resampling on the way in) and the smallest buffer the browser offers
    let sr = 0; try { sr = this.stream.getAudioTracks()[0].getSettings().sampleRate || 0; } catch (e) {}
    try { this.ctx = new Ctx(sr >= 8000 && sr <= 192000 ? { latencyHint: 'interactive', sampleRate: sr } : { latencyHint: 'interactive' }); }
    catch (e) { this.ctx = new Ctx({ latencyHint: 'interactive' }); }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const src = this.src = this.ctx.createMediaStreamSource(this.stream);
    // input sensitivity: a gain in front of the analysers only (the effects take the source before it, so they are not affected)
    const gn = this.gain = this.ctx.createGain(); src.connect(gn); this.pk = 0; this.applySens(true);
    this.an = this.ctx.createAnalyser(); this.an.fftSize = 4096; this.an.smoothingTimeConstant = 0;
    this.raw = this.ctx.createAnalyser(); this.raw.fftSize = 4096; this.raw.smoothingTimeConstant = 0; gn.connect(this.raw);   // unfiltered, for the level
    // high-cut for the pitch search (two 2nd-order low-pass stages): follows the note, ~3.5x its pitch (700 Hz - 3 kHz), so the
    // overtones that pull the period estimate are cut while the fundamental passes
    this.lp = [0, 1].map(() => { const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7071; f.frequency.value = 2000; return f; });
    this.lpHz = 2000; gn.connect(this.lp[0]); this.lp[0].connect(this.lp[1]);
    const mute = this.ctx.createGain(); mute.gain.value = 0;      // keep the graph pulled without any playback
    this.sp = this.ctx.createAnalyser(); this.sp.fftSize = 16384; this.sp.smoothingTimeConstant = 0.3; gn.connect(this.sp);   // spectrum for chords
    this.db = new Float32Array(this.sp.frequencyBinCount); this.mag = new Float32Array(this.sp.frequencyBinCount);
    this.lp[1].connect(this.an); this.an.connect(mute); mute.connect(this.ctx.destination);
    this.buf = new Float32Array(this.an.fftSize); this.rbuf = new Float32Array(this.raw.fftSize); this.kind = 'single'; this.cnt = 0; this.lastNotes = null;
    this.timer = setInterval(() => this.tick(), 10);
  }
  // sensitivity: { auto, db }. Manual: db (-6..+30) of gain. Auto: the gain follows the loudest recent playing so that it
  // reaches a steady working level (only ever raised, never above +32 dB; quiet noise below the floor does not move it).
  setSens(o) { this.sens = { auto: !!o.auto, db: Math.max(-6, Math.min(30, +o.db || 0)) }; this.applySens(true); }
  applySens(now) {
    if (!this.gain) return; const sn = this.sens || { auto: true, db: 0 };
    if (!sn.auto) { this.autoDb = 0; this.gain.gain.setTargetAtTime(Math.pow(10, sn.db / 20), this.ctx.currentTime, now ? 0.01 : 0.1); }
    else if (now) this.gain.gain.setTargetAtTime(Math.pow(10, (this.autoDb || 0) / 20), this.ctx.currentTime, 0.01);
  }
  autoTick(level) {   // level = the level after the gain; called every tick
    const g = Math.max(this.gain.gain.value, 1e-3), pre = level / g;
    this.pk = Math.max(pre, (this.pk || 0) * 0.997);   // slow fall: ~3 s memory of the loudest playing
    if (pre < 0.0008) return;                            // below the noise floor: leave the gain alone
    const want = Math.max(0, Math.min(32, 20 * Math.log10(0.1 / this.pk)));
    this.autoDb = want; this.gain.gain.setTargetAtTime(Math.pow(10, want / 20), this.ctx.currentTime, 0.25);
  }
  spectrumNotes() {
    this.sp.getFloatFrequencyData(this.db);
    for (let i = 0; i < this.db.length; i++) this.mag[i] = Math.pow(10, this.db[i] / 20);
    // the notes shown: high-cut spectrum + measured harmonic removal; and, only in auto mode, a second reading in the earlier
    // style that decides single note vs chord (its weights are what the thresholds below were tuned on)
    if (this.mode === 'auto') this.kindNotes = detectNotes(this.mag, this.ctx.sampleRate, this.sp.fftSize, { lo: this.loMidi, legacy: true });
    return detectNotes(this.mag, this.ctx.sampleRate, this.sp.fftSize, { lo: this.loMidi });
  }
  singleReading() {
    // four window lengths: notes from C5 up are answered from the newest 512 samples (~11 ms), notes down to ~150 Hz
    // from 1024 (~21 ms), down to ~75 Hz from 2048 (~43 ms), and only the lowest notes wait for the full 4096 (~85 ms)
    const sr = this.ctx.sampleRate, n = this.buf.length;
    let r = yin(this.buf.subarray(n - 512), sr, sr / 254);
    if (!r || r.freq < 500) {
      r = yin(this.buf.subarray(n - 1024), sr, sr / 510);
      if (!r || r.freq < 150) {
        r = yin(this.buf.subarray(n - 2048), sr, sr / 1022);
        if (!r || r.freq < 75) r = yin(this.buf, sr, this.minHz);
      }
    }
    return r && r.clarity > 0.8 && r.freq >= this.minHz ? r : null;
  }
  // mode: 'single' | 'chord' | 'auto'. In auto the kind follows what is heard: two or more pitch classes in the
  // spectrum = chord, one clear pitch = single note. It changes at the start of a new sound (quickly) or after
  // ~300 ms of steady evidence, so a ringing chord is not flipped to a single note as it decays.
  tick() {
    if (!this.an) return;
    this.an.getFloatTimeDomainData(this.buf); this.raw.getFloatTimeDomainData(this.rbuf);
    const level = rms(this.rbuf), now = performance.now(), tickNo = ++this.n;
    if (this.sens && this.sens.auto && tickNo % 2 === 0) this.autoTick(level);
    if (level < 0.006) {
      if (!this.wasSilent) { this.wasSilent = true; this.silentSince = now; }
      this.env = (this.env || 0) * 0.9;
      this.onFrame({ freq: null, clarity: 0, level });
      if (this.mode !== 'single' && tickNo % 10 === 0 && this.onChord) this.onChord({ notes: [], level });
      return;
    }
    const attack = (this.wasSilent && now - this.silentSince > 250) || (level > (this.env || 0) * 1.8 && level > 0.02 && now - (this.lastAttack || 0) > 150);
    this.wasSilent = false; this.env = (this.env || 0) * 0.9 + level * 0.1;
    if (attack) { this.lastAttack = now; this.attackUntil = now + 300; this.cnt = 0; }
    if (this.mode !== 'single' && tickNo % 4 === 0) this.lastNotes = this.spectrumNotes();
    const r = this.singleReading();
    let kind = this.mode;
    if (this.mode === 'auto') {
      // chord = a third pitch class that is clearly present, or a strong second one when the sound is not a clean
      // single pitch. Weak extras (overtone ghosts, pick noise, hum) stay below these lines (single notes: second <= 0.40, third <= 0.35).
      const ln = this.kindNotes, wt = ln && ln.weights || [], best = {};
      if (ln) ln.forEach((m, i) => { best[m % 12] = Math.max(best[m % 12] || 0, wt[i] ?? 1); });
      const w = Object.values(best).sort((x, y) => y - x);
      const poly = (w[2] || 0) >= 0.38 || ((w[1] || 0) >= 0.5 && !(r && r.clarity > 0.9));
      const vote = poly ? 'chord' : (r ? 'single' : null);
      if (vote && vote !== this.kind) {
        if (++this.cnt >= (now < this.attackUntil ? 12 : 40)) { this.kind = vote; this.cnt = 0; this.lastNotes = vote === 'single' ? null : this.lastNotes; if (vote === 'single') this.kindNotes = null; this.onKind && this.onKind(vote); }
      } else this.cnt = 0;
      kind = this.kind;
    }
    if (kind === 'chord' && tickNo % 10 === 0 && this.onChord) this.onChord({ notes: this.lastNotes || [], level });
    // while a chord is ringing, YIN reports the "virtual pitch" of the whole chord (often far below the bass note): show it only when it is clean
    const rr = kind === 'chord' && r && r.clarity < 0.97 ? null : r;
    if (rr && tickNo % 5 === 0) { const hz = Math.max(700, Math.min(3000, rr.freq * 3.5)); if (Math.abs(hz - this.lpHz) > this.lpHz * 0.08) { this.lpHz = hz; this.lp.forEach(f => f.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.03)); } }
    this.onFrame(rr ? { freq: rr.freq, clarity: rr.clarity, level } : { freq: null, clarity: 0, level });   // the tuner reading stays on in every mode
  }
  async stop() {
    clearInterval(this.timer); this.timer = 0;
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx) { try { await this.ctx.close(); } catch (e) {} }
    this.stream = this.ctx = this.an = this.raw = this.lp = this.src = this.gain = null;
  }
  get running() { return !!this.stream; }
}
