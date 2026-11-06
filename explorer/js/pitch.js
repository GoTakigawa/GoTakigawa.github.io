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

// Streams detections to onFrame({ freq, clarity, level }) about every 20 ms.
export class PitchListener {
  constructor(onFrame) { this.onFrame = onFrame; this.ctx = null; this.stream = null; this.timer = 0; }
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
    src.connect(this.an); this.an.connect(mute); mute.connect(this.ctx.destination);
    this.buf = new Float32Array(this.an.fftSize);
    this.timer = setInterval(() => this.tick(), 20);
  }
  tick() {
    if (!this.an) return;
    this.an.getFloatTimeDomainData(this.buf);
    const level = rms(this.buf);
    if (level < 0.006) { this.onFrame({ freq: null, clarity: 0, level }); return; }
    // fast path: the newest 2048 samples (~43 ms) answer for notes above ~100 Hz; low notes need the full window
    const sr = this.ctx.sampleRate, half = this.buf.length >> 1;
    let r = yin(this.buf.subarray(half), sr, sr / (half - 2));
    if (!r || r.freq < 100) r = yin(this.buf, sr);
    this.onFrame(r && r.clarity > 0.8 ? { freq: r.freq, clarity: r.clarity, level } : { freq: null, clarity: 0, level });
  }
  async stop() {
    clearInterval(this.timer); this.timer = 0;
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx) { try { await this.ctx.close(); } catch (e) {} }
    this.stream = this.ctx = this.an = null;
  }
  get running() { return !!this.stream; }
}
