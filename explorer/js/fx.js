// Effects for monitoring the guitar input: noise gate / comp / overdrive / distortion / amp sim / EQ / delay / reverb.
// The pitch detection always listens to the dry input; the effects only feed the monitor output, which is OFF by default.
// A howl guard watches the output while monitoring and stops it when a tone starts to run away.
const KEY = 'gti-explorer:fx';
const ACK = 'gti-explorer:fx-ack';

export const FX_DEFS = {
  // rows = the knob layout of the pedal; a param with gauge:true gets an input-level ring around its knob
  gate: { name: 'ノイズゲート', rows: [['thr']], params: [
    { k: 'thr', label: 'しきい値', min: -80, max: -20, step: 1, def: -55, unit: 'dB', gauge: true }] },
  comp: { name: 'コンプ', rows: [['thr', 'ratio'], ['att', 'rel', 'gain']], params: [
    { k: 'thr', label: 'しきい値', min: -60, max: 0, step: 1, def: -24, unit: 'dB', gauge: true },
    { k: 'ratio', label: 'レシオ', min: 1, max: 20, step: 0.5, def: 4, unit: ':1' },
    { k: 'att', label: 'アタック', min: 1, max: 100, step: 1, def: 10, unit: 'ms' },
    { k: 'rel', label: 'リリース', min: 50, max: 1000, step: 10, def: 250, unit: 'ms' },
    { k: 'gain', label: '出力', min: 0, max: 24, step: 0.5, def: 6, unit: 'dB' }] },
  // Tube Screamer style: DRIVE / TONE / LEVEL in one row
  od: { name: 'オーバードライブ', rows: [['drive', 'tone', 'level']], params: [
    { k: 'drive', label: 'ドライブ', min: 0, max: 100, step: 1, def: 40, unit: '' },
    { k: 'tone', label: 'トーン', min: 1000, max: 8000, step: 100, def: 3500, unit: 'Hz' },
    { k: 'level', label: 'レベル', min: -18, max: 12, step: 0.5, def: 0, unit: 'dB' }] },
  // BOSS DS-1 style circuit; the knob row matches the overdrive: DRIVE / TONE / LEVEL
  dist: { name: 'ディストーション', rows: [['drive', 'tone', 'level']], params: [
    { k: 'drive', label: 'ドライブ', min: 0, max: 100, step: 1, def: 65, unit: '' },
    { k: 'tone', label: 'トーン', min: 0, max: 100, step: 1, def: 50, unit: '' },
    { k: 'level', label: 'レベル', min: -18, max: 12, step: 0.5, def: -6, unit: 'dB' }] },
  amp: { name: 'アンプシミュ', rows: [['bass', 'mid', 'treble'], ['gain', 'level', 'width']], params: [
    { k: 'treble', label: 'トレブル', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' },
    { k: 'mid', label: 'ミドル', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' },
    { k: 'bass', label: 'ベース', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' },
    { k: 'gain', label: 'ゲイン', min: 0, max: 100, step: 1, def: 50, unit: '' },
    { k: 'level', label: 'レベル', min: -18, max: 12, step: 0.5, def: -3, unit: 'dB' },
    { k: 'width', label: 'ワイド', min: 0, max: 100, step: 1, def: 0, unit: '%' },
    { k: 'mode', label: 'モード', toggle: true, def: 1 },
    { k: 'cab', label: 'キャビネット', toggle: true, def: 1 }] },
  // 7-band graphic EQ (faders)
  eq: { name: 'EQ', fader: true, rows: [['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7']], params: ['100', '200', '400', '800', '1.6k', '3.2k', '6.4k'].map((label, i) => ({ k: 'b' + (i + 1), label, min: -12, max: 12, step: 1, def: 0, unit: 'dB' })) },
  delay: { name: 'ディレイ', rows: [['time', 'fb', 'mix']], params: [
    { k: 'time', label: 'タイム', min: 50, max: 1000, step: 10, def: 350, unit: 'ms' },
    { k: 'fb', label: 'リピート', min: 0, max: 85, step: 1, def: 35, unit: '%' },
    { k: 'mix', label: 'ミックス', min: 0, max: 100, step: 1, def: 30, unit: '%' }] },
  reverb: { name: 'リバーブ', rows: [['decay', 'bright', 'mix'], ['width']], params: [
    { k: 'decay', label: '長さ', min: 0.3, max: 6, step: 0.1, def: 2, unit: '秒' },
    { k: 'bright', label: 'ブライト', min: 0, max: 100, step: 1, def: 50, unit: '' },
    { k: 'mix', label: 'ミックス', min: 0, max: 100, step: 1, def: 25, unit: '%' },
    { k: 'width', label: 'ワイド', min: 0, max: 200, step: 1, def: 100, unit: '%' },
    { k: 'type', label: 'タイプ', min: 0, max: 3, step: 1, def: 1, choice: true }] }
};
const REVERB_TYPES = ['ルーム', 'ホール', 'プレート', 'スプリング'];
const ORDER = ['gate', 'comp', 'od', 'dist', 'amp', 'eq', 'delay', 'reverb'];
// the amp keeps separate knob settings for its clean and drive modes (mem[mode]; the active mode's values live in p)
const AMP_KNOBS = ['treble', 'mid', 'bass', 'gain', 'level', 'width'];
const ampMem = () => { const def = Object.fromEntries(FX_DEFS.amp.params.map(p => [p.k, p.def])), pick = o => Object.fromEntries(AMP_KNOBS.map(k => [k, o[k]])); return { 0: { ...pick(def), gain: 30 }, 1: pick(def) }; };
const defState = () => { const s = { order: ORDER.slice(), flip: false, guard: true, master: 0.5, out: '', fx: Object.fromEntries(ORDER.map(id => [id, { on: false, p: Object.fromEntries(FX_DEFS[id].params.map(p => [p.k, p.def])) }])) }; s.fx.amp.mem = ampMem(); return s; };
function load() {
  const s = defState();
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!o) return s;
    if (Array.isArray(o.order)) { const ord = o.order.filter(id => ORDER.includes(id)); ORDER.forEach(id => { if (!ord.includes(id)) { if (id === 'gate') ord.unshift(id); else ord.push(id); } }); s.order = ord; }
    if (typeof o.master === 'number') s.master = Math.max(0, Math.min(1, o.master));
    if (typeof o.out === 'string') s.out = o.out;
    if (typeof o.flip === 'boolean') s.flip = o.flip;
    if (typeof o.guard === 'boolean') s.guard = o.guard;
    ORDER.forEach(id => { const f = o.fx && o.fx[id]; if (!f) return; s.fx[id].on = !!f.on; FX_DEFS[id].params.forEach(p => { const v = f.p && f.p[p.k]; if (typeof v === 'number' && v >= (p.min ?? 0) && v <= (p.max ?? 1)) s.fx[id].p[p.k] = v; });
      if (id === 'amp' && f.mem) [0, 1].forEach(m => AMP_KNOBS.forEach(k => { const pd = FX_DEFS.amp.params.find(x => x.k === k), v = f.mem[m] && f.mem[m][k]; if (typeof v === 'number' && v >= pd.min && v <= pd.max) s.fx.amp.mem[m][k] = v; }));
    });
  } catch (e) {}
  return s;
}

const dbLin = d => Math.pow(10, d / 20);
const tc = (param, v, ctx, t = 0.02) => param.setTargetAtTime(v, ctx.currentTime, t);
const node = (ctx, type, o = {}) => { const f = ctx.createBiquadFilter(); f.type = type; Object.entries(o).forEach(([k, v]) => { f[k].value = v; }); return f; };
const tanhCurve = k => { const n = 2048, c = new Float32Array(n), d = Math.tanh(k); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x) / d; } return c; };
const shaper = (ctx, k) => { const s = ctx.createWaveShaper(); s.curve = tanhCurve(k); s.oversample = '2x'; return s; };

// zero-latency safety clipper for the output: linear up to 0.5, then a soft knee towards 0.9
const clipCurve = () => { const n = 4096, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1, a = Math.abs(x); c[i] = Math.sign(x) * (a <= 0.5 ? a : 0.5 + 0.4 * Math.tanh((a - 0.5) / 0.4)); } return c; };

// stereo widener that stays mono-compatible: L = M + S, R = M - S, with S a delayed, high-passed copy of the signal
function widener(ctx) {
  const inn = ctx.createGain(), m = ctx.createGain(), d = ctx.createDelay(0.05), hp = node(ctx, 'highpass', { frequency: 250 }), sp = ctx.createGain(), sn = ctx.createGain(), L = ctx.createGain(), R = ctx.createGain(), mg = ctx.createChannelMerger(2);
  inn.channelCount = 1; inn.channelCountMode = 'explicit'; d.delayTime.value = 0.017;
  inn.connect(m); m.connect(L); m.connect(R); inn.connect(d); d.connect(hp); hp.connect(sp); hp.connect(sn); sp.connect(L); sn.connect(R); L.connect(mg, 0, 0); R.connect(mg, 0, 1);
  return { in: inn, out: mg, set(w) { const s = w * 0.9, n = 1 / Math.sqrt(1 + s * s); tc(m.gain, n, ctx); tc(sp.gain, s * n, ctx); tc(sn.gain, -s * n, ctx); } };
}

// noise gate: an AudioWorklet (sample-accurate, no lookahead) with hysteresis and a short hold
const GATE_SRC = `class GtiGate extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'thr', defaultValue: -55, minValue: -90, maxValue: 0, automationRate: 'k-rate' }, { name: 'rel', defaultValue: 120, minValue: 5, maxValue: 1000, automationRate: 'k-rate' }]; }
  constructor() { super(); this.env = 0; this.g = 0; this.hold = 0; this.open = false; this.last = false; }
  process(inputs, outputs, p) {
    const x = inputs[0], y = outputs[0]; if (!x || !x.length || !y || !y.length) return true;
    const thr = Math.pow(10, p.thr[0] / 20), clo = thr * 0.63, sr = sampleRate;
    const er = Math.exp(-1 / (0.01 * sr)), ga = 1 - Math.exp(-1 / (0.0015 * sr)), gr = 1 - Math.exp(-1 / (Math.max(0.005, p.rel[0] / 1000) * sr)), hold = 0.04 * sr, n = x[0].length;
    for (let s = 0; s < n; s++) {
      let a = 0; for (let c = 0; c < x.length; c++) { const v = Math.abs(x[c][s]); if (v > a) a = v; }
      this.env = a > this.env ? a : this.env * er;
      if (this.env > thr) { this.open = true; this.hold = hold; } else if (this.open && this.env < clo) { if (this.hold > 0) this.hold--; else this.open = false; }
      this.g += ((this.open ? 1 : 0) - this.g) * (this.open ? ga : gr);
      for (let c = 0; c < y.length; c++) y[c][s] = (x[Math.min(c, x.length - 1)][s]) * this.g;
    }
    if (this.open !== this.last) { this.last = this.open; this.port.postMessage(this.open ? 1 : 0); }
    return true;
  }
}
registerProcessor('gti-gate', GtiGate);
// feed-forward compressor without lookahead (the built-in DynamicsCompressor delays the signal by ~6 ms)
class GtiComp extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [['thr', -24], ['ratio', 4], ['att', 10], ['rel', 250]].map(([name, defaultValue]) => ({ name, defaultValue, automationRate: 'k-rate' })); }
  constructor() { super(); this.gr = 0; this.n = 0; }
  process(inputs, outputs, p) {
    const x = inputs[0], y = outputs[0]; if (!x || !x.length || !y || !y.length) return true;
    const thr = p.thr[0], r = Math.max(1, p.ratio[0]), k = 8, sl = 1 - 1 / r, sr = sampleRate, n = x[0].length;
    const ca = 1 - Math.exp(-1 / (Math.max(0.0005, p.att[0] / 1000) * sr)), cr = 1 - Math.exp(-1 / (Math.max(0.01, p.rel[0] / 1000) * sr));
    for (let s = 0; s < n; s++) {
      let a = 0; for (let c = 0; c < x.length; c++) { const v = Math.abs(x[c][s]); if (v > a) a = v; }
      const over = 20 * Math.log10(Math.max(a, 1e-6)) - thr;
      const tg = over <= -k / 2 ? 0 : over >= k / 2 ? over * sl : sl * (over + k / 2) * (over + k / 2) / (2 * k);
      this.gr += (tg - this.gr) * (tg > this.gr ? ca : cr);
      const g = Math.pow(10, -this.gr / 20);
      for (let c = 0; c < y.length; c++) y[c][s] = x[Math.min(c, x.length - 1)][s] * g;
    }
    this.n += n; if (this.n >= 2048) { this.n = 0; this.port.postMessage(this.gr); }
    return true;
  }
}
registerProcessor('gti-comp', GtiComp);`;
const gateReady = new WeakMap();
const loadGate = ctx => { if (!gateReady.has(ctx)) gateReady.set(ctx, ctx.audioWorklet ? ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([GATE_SRC], { type: 'application/javascript' }))) : Promise.reject(new Error('no worklet'))); return gateReady.get(ctx); };

// built-in cabinet impulse responses, synthesised at start-up (no sample data is stored). The magnitude curve below is a smoothed
// tonal envelope (low-mid weighted, dark top end) read from a reference cab response; the impulse is built from it as a minimum-phase
// filter, with a faint mic-distance comb added. 'drive' = that curve (closed-back 4x12 feel); 'clean' = the same curve shifted up a
// quarter and with more presence (open-back 1x12 combo feel).
const CAB_PTS = [[40, -24], [63, -15.5], [80, -10.5], [100, -5.5], [125, -2], [160, 0], [200, -0.5], [250, -1.5], [315, -2.5], [400, -4.5], [500, -5.5], [630, -5.5], [800, -6.5], [1000, -7.5], [1250, -8], [1600, -8], [2000, -7.5], [2500, -7.5], [3150, -8], [4000, -9], [5000, -11.5], [6300, -19], [8000, -29.5], [10000, -38], [12500, -44.5], [16000, -51.5], [20000, -56]];
function cabDb(f, mode) {
  const g = mode ? f : f / 1.25, P = CAB_PTS, l = Math.log2(Math.max(g, 1));
  let d;
  if (g <= P[0][0]) d = P[0][1] + 13 * (l - Math.log2(P[0][0]));
  else if (g >= P[P.length - 1][0]) d = P[P.length - 1][1] - 4 * (l - Math.log2(P[P.length - 1][0]));
  else { let k = 1; while (P[k][0] < g) k++; const a = Math.log2(P[k - 1][0]), b = Math.log2(P[k][0]); d = P[k - 1][1] + (P[k][1] - P[k - 1][1]) * (l - a) / (b - a); }
  if (!mode) d += 4 * Math.exp(-0.5 * Math.pow((Math.log2(Math.max(f, 1) / 3000)) / 0.6, 2));
  return Math.max(-60, d);
}
function fftInPlace(re, im, inv) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < h; j++) {
        const a = i + j, b = a + h, vr = re[b] * cr - im[b] * ci, vi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - vr; im[b] = im[a] - vi; re[a] += vr; im[a] += vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}
async function makeCabIr(ctx, mode) {
  const sr = ctx.sampleRate, N = 8192, re = new Float64Array(N), im = new Float64Array(N), L = 4096;
  for (let k = 0; k <= N / 2; k++) { const lm = cabDb(k * sr / N, mode) * Math.LN10 / 20; re[k] = lm; if (k > 0 && k < N / 2) re[N - k] = lm; }
  fftInPlace(re, im, true);                                            // real cepstrum
  for (let n = 1; n < N / 2; n++) re[n] *= 2; for (let n = N / 2 + 1; n < N; n++) re[n] = 0; im.fill(0);   // fold to minimum phase
  fftInPlace(re, im, false);
  for (let k = 0; k < N; k++) { const m = Math.exp(re[k]), a = im[k]; re[k] = m * Math.cos(a); im[k] = m * Math.sin(a); }
  fftInPlace(re, im, true);
  const buf = ctx.createBuffer(1, L, sr), y = buf.getChannelData(0), d = Math.max(1, Math.round((mode ? 0.0007 : 0.0005) * sr)), cb = mode ? 0.12 : 0.1;
  for (let i = 0; i < L; i++) y[i] = re[i];
  for (let i = L - 1; i >= d; i--) y[i] += cb * y[i - d];
  for (let i = Math.floor(L * 0.6); i < L; i++) y[i] *= 0.5 * (1 + Math.cos(Math.PI * (i - L * 0.6) / (L * 0.4)));   // fade the tail
  return buf;
}

// the reverb tail per type: room (early reflections, short), hall (pre-delay, slow build, dark), plate (dense, bright), spring (echoing 'drip')
function reverbIr(ctx, sec, type) {
  const sr = ctx.sampleRate, T = Math.max(0.2, sec * [0.5, 1.25, 1, 0.8][type]), len = Math.floor(sr * T), buf = ctx.createBuffer(2, len, sr);
  const a0 = [0.6, 0.3, 0.9, 0.45][type], pre = [0, Math.floor(0.03 * sr), 0, 0][type];
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c); let y = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre), a = Math.max(0.04, a0 * (1 - 0.5 * t)); let env = Math.exp(-6.5 * t);
      y += a * ((Math.random() * 2 - 1) - y);
      if (i - pre < 200) env *= (i - pre) / 200;
      if (type === 1) env *= Math.min(1, (i - pre) / (0.06 * sr));
      d[i] = y * env;
    }
    if (type === 0) for (let n = 0; n < 9; n++) { const at = Math.floor((0.004 + Math.random() * 0.04) * sr); if (at < len) d[at] += (Math.random() < 0.5 ? -1 : 1) * 0.6 * (1 - n / 12); }
    if (type === 3) { const sp = Math.floor(0.033 * sr); for (let i = sp; i < len; i++) d[i] += 0.55 * d[i - sp]; let lp = 0; for (let i = 0; i < len; i++) { lp += 0.02 * (d[i] - lp); d[i] -= lp; } }
  }
  return buf;
}

// each builder returns the effect core { in, out, set(k, v) }; the wrapper adds an on/off (bypass) around it
const BUILD = {
  gate(ctx) {
    const inn = ctx.createGain(), out = ctx.createGain(), core = {}; let wn = null, thr = -55;
    inn.connect(out);   // open until the worklet has loaded
    loadGate(ctx).then(() => {
      wn = new AudioWorkletNode(ctx, 'gti-gate', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1] });
      wn.parameters.get('thr').value = thr; wn.parameters.get('rel').value = 120;
      wn.port.onmessage = e => { if (core.onOpen) core.onOpen(!!e.data); };
      try { inn.disconnect(out); } catch (e) {} inn.connect(wn); wn.connect(out);
    }).catch(() => {});
    return Object.assign(core, { in: inn, out, set(k, v) { if (k === 'thr') { thr = v; if (wn) wn.parameters.get('thr').value = v; } } });
  },
  comp(ctx) {
    const inn = ctx.createGain(), g = ctx.createGain(), val = { thr: -24, ratio: 4, att: 10, rel: 250 }, core = {}; let wn = null, fb = ctx.createDynamicsCompressor();
    // until the worklet has loaded (or if it is unavailable) the built-in compressor is used
    fb.knee.value = 12; inn.connect(fb); fb.connect(g);
    const apply = () => { fb.threshold.value = val.thr; fb.ratio.value = val.ratio; fb.attack.value = val.att / 1000; fb.release.value = val.rel / 1000; };
    loadGate(ctx).then(() => {
      wn = new AudioWorkletNode(ctx, 'gti-comp', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1] });
      ['thr', 'ratio', 'att', 'rel'].forEach(k => { wn.parameters.get(k).value = val[k]; });
      wn.port.onmessage = e => { if (core.onGr) core.onGr(e.data); };
      try { inn.disconnect(fb); fb.disconnect(g); } catch (e) {} fb = null; inn.connect(wn); wn.connect(g);
    }).catch(() => {});
    apply();
    return Object.assign(core, { in: inn, out: g, set(k, v) { if (k === 'gain') tc(g.gain, dbLin(v), ctx); else { val[k] = v; if (wn) wn.parameters.get(k).value = v; else if (fb) apply(); } } });
  },
  od(ctx) {
    const hp = node(ctx, 'highpass', { frequency: 120 }), mid = node(ctx, 'peaking', { frequency: 720, gain: 4 }), pre = ctx.createGain(), sh = shaper(ctx, 2.2), lp = node(ctx, 'lowpass', { frequency: 3500 }), out = ctx.createGain();
    hp.connect(mid); mid.connect(pre); pre.connect(sh); sh.connect(lp); lp.connect(out);
    return { in: hp, out, set(k, v) { if (k === 'drive') tc(pre.gain, 1 + Math.pow(v / 100, 1.5) * 9, ctx); else if (k === 'tone') tc(lp.frequency, v, ctx); else if (k === 'level') tc(out.gain, dbLin(v) * 0.45, ctx); } };
  },
  // DS-1 style: bass-tight pre-filter, two clipping stages (gain -> soft clip -> gain -> harder clip) for deep sustain without a
  // square-wave buzz, then low-pass filters and a passive tilt tone control. Symmetric curves keep the lows from turning woolly.
  dist(ctx) {
    const clip = (k, os) => { const w = ctx.createWaveShaper(); w.oversample = os; const n = 2048, c = new Float32Array(n), d = Math.tanh(k); for (let i = 0; i < n; i++) c[i] = Math.tanh(k * (i / (n - 1) * 2 - 1)) / d; w.curve = c; return w; };
    const hp = node(ctx, 'highpass', { frequency: 170, Q: 0.7 }), boost = node(ctx, 'peaking', { frequency: 1200, gain: 1.5, Q: 0.7 }), g1 = ctx.createGain(), c1 = clip(1.6, '4x'), mid = node(ctx, 'lowpass', { frequency: 3600, Q: 0.5 });
    const hp2 = node(ctx, 'highpass', { frequency: 100, Q: 0.7 }), g2 = ctx.createGain(), c2 = clip(3, '2x'), lp = node(ctx, 'lowpass', { frequency: 4600, Q: 0.6 }), lp2 = node(ctx, 'lowpass', { frequency: 7000, Q: 0.5 });
    const post = node(ctx, 'highpass', { frequency: 55, Q: 0.7 }), mud = node(ctx, 'peaking', { frequency: 300, gain: -3, Q: 0.9 }), lo = node(ctx, 'lowshelf', { frequency: 450 }), hi = node(ctx, 'highshelf', { frequency: 2200 }), body = node(ctx, 'lowshelf', { frequency: 150, gain: 3 }), out = ctx.createGain();
    hp.connect(boost); boost.connect(g1); g1.connect(c1); c1.connect(mid); mid.connect(hp2); hp2.connect(g2); g2.connect(c2); c2.connect(lp); lp.connect(lp2); lp2.connect(post); post.connect(mud); mud.connect(body); body.connect(lo); lo.connect(hi); hi.connect(out);
    return { in: hp, out, set(k, v) {
      if (k === 'drive') { const d = v / 100; tc(g1.gain, 2 + Math.pow(d, 1.2) * 14, ctx); tc(g2.gain, 2.5 + d * 5, ctx); }
      else if (k === 'tone') { const t = (v - 50) / 50; tc(lo.gain, -t * 8, ctx); tc(hi.gain, t * 8, ctx); }
      else if (k === 'level') tc(out.gain, dbLin(v) * 0.4, ctx);
    } };
  },
  amp(ctx) {
    const hp = node(ctx, 'highpass', { frequency: 80 }), pre = ctx.createGain(), sh = ctx.createWaveShaper(), post = node(ctx, 'highpass', { frequency: 60 });
    sh.oversample = '2x';
    const bass = node(ctx, 'lowshelf', { frequency: 120 }), mid = node(ctx, 'peaking', { frequency: 700, Q: 0.8 }), tre = node(ctx, 'highshelf', { frequency: 3200 });
    hp.connect(pre); pre.connect(sh); sh.connect(post); post.connect(bass); bass.connect(mid); mid.connect(tre);
    // clean / drive: the preamp curve and gain range change with the mode
    let mode = 1, gainV = 50, lvDb = -3; const curves = [tanhCurve(0.8), tanhCurve(4)];
    const preamp = () => { sh.curve = curves[mode]; tc(pre.gain, mode ? 2 + Math.pow(gainV / 100, 1.6) * 38 : 0.7 + gainV / 100 * 3.5, ctx); };
    // cabinet: a few filters, or a loaded impulse response (see loadIr)
    const cabIn = ctx.createGain(), cabOff = ctx.createGain(), cabBiq = ctx.createGain(), cabConv = ctx.createGain(), cabOut = ctx.createGain(), level = ctx.createGain();
    const c1 = node(ctx, 'highpass', { frequency: 90 }), c2 = node(ctx, 'peaking', { frequency: 2200, Q: 1, gain: 3 }), c3 = node(ctx, 'lowpass', { frequency: 5200, Q: 0.7 }), c4 = node(ctx, 'lowpass', { frequency: 5200, Q: 0.7 });
    const conv = ctx.createConvolver(); let cab = 1, hasIr = false, userIr = null; const gens = {};
    tre.connect(cabIn); cabIn.connect(cabOff); cabOff.connect(cabOut);
    cabIn.connect(c1); c1.connect(c2); c2.connect(c3); c3.connect(c4); c4.connect(cabBiq); cabBiq.connect(cabOut);
    cabIn.connect(conv); conv.connect(cabConv); cabConv.connect(cabOut); cabOut.connect(level);
    const wid = widener(ctx); level.connect(wid.in);
    const route = () => { tc(cabOff.gain, cab ? 0 : 1, ctx); tc(cabBiq.gain, cab && !hasIr ? 1 : 0, ctx); tc(cabConv.gain, cab && hasIr ? 1 : 0, ctx); };
    // the built-in cabinet IR follows the mode; a loaded IR file overrides it. The filter version is used until the IRs are ready.
    const pickIr = () => { const b = userIr || gens[mode]; if (b) { try { conv.buffer = b; hasIr = true; } catch (e) { hasIr = false; } } else hasIr = false; route(); };
    [0, 1].forEach(m => makeCabIr(ctx, m).then(b => { gens[m] = b; pickIr(); }).catch(() => {}));
    // fixed make-up gain per mode (the cabinet and the preamp curve leave the amp quieter than the other pedals)
    const applyLevel = () => tc(level.gain, dbLin(lvDb) * (mode ? 1.3 : 3.6), ctx);
    route(); preamp(); applyLevel();
    return {
      in: hp, out: wid.out,
      set(k, v) { if (k === 'gain') { gainV = v; preamp(); } else if (k === 'mode') { mode = v ? 1 : 0; preamp(); applyLevel(); pickIr(); } else if (k === 'bass') tc(bass.gain, v, ctx); else if (k === 'mid') tc(mid.gain, v, ctx); else if (k === 'treble') tc(tre.gain, v, ctx); else if (k === 'cab') { cab = v ? 1 : 0; route(); } else if (k === 'level') { lvDb = v; applyLevel(); } else if (k === 'width') wid.set(v / 100); },
      setIr(buf) { userIr = buf; pickIr(); }
    };
  },
  eq(ctx) {
    const f = [100, 200, 400, 800, 1600, 3200, 6400].map(fr => node(ctx, 'peaking', { frequency: fr, Q: 1.4 }));
    f.forEach((x, i) => { if (i) f[i - 1].connect(x); });
    return { in: f[0], out: f[6], set(k, v) { const i = +k.slice(1) - 1; if (f[i]) tc(f[i].gain, v, ctx); } };
  },
  delay(ctx) {
    const inn = ctx.createGain(), dry = ctx.createGain(), d = ctx.createDelay(1.2), fb = ctx.createGain(), lp = node(ctx, 'lowpass', { frequency: 4200 }), wet = ctx.createGain(), out = ctx.createGain();
    inn.connect(dry); dry.connect(out); inn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(out);
    return { in: inn, out, set(k, v) { if (k === 'time') tc(d.delayTime, v / 1000, ctx, 0.05); else if (k === 'fb') tc(fb.gain, Math.min(0.85, v / 100), ctx); else if (k === 'mix') { tc(wet.gain, v / 100, ctx); tc(dry.gain, 1 - 0.5 * v / 100, ctx); } } };
  },
  reverb(ctx) {
    const inn = ctx.createGain(), dry = ctx.createGain(), conv = ctx.createConvolver(), bri = node(ctx, 'highshelf', { frequency: 3500 }), wet = ctx.createGain(), out = ctx.createGain(); let decay = 2, type = 1, tm = 0;
    // width: M/S on the stereo tail (100% = as generated, 0% = mono)
    const spl = ctx.createChannelSplitter(2), mg = ctx.createChannelMerger(2), sL = ctx.createGain(), sR = ctx.createGain(), LL = ctx.createGain(), RL = ctx.createGain(), LR = ctx.createGain(), RR = ctx.createGain();
    conv.connect(bri); bri.connect(spl); spl.connect(LL, 0); spl.connect(LR, 0); spl.connect(RL, 1); spl.connect(RR, 1); LL.connect(sL); RL.connect(sL); LR.connect(sR); RR.connect(sR); sL.connect(mg, 0, 0); sR.connect(mg, 0, 1); mg.connect(wet);
    inn.connect(dry); dry.connect(out); inn.connect(conv); wet.connect(out);
    const gen = () => { try { conv.buffer = reverbIr(ctx, decay, type); } catch (e) {} };
    const regen = now => { clearTimeout(tm); if (now) gen(); else tm = setTimeout(gen, 120); };
    gen();
    return { in: inn, out, set(k, v) {
      if (k === 'decay') { decay = v; regen(); } else if (k === 'type') { type = Math.round(v); regen(true); }
      else if (k === 'bright') tc(bri.gain, (v - 50) / 50 * 10, ctx);
      else if (k === 'mix') { tc(wet.gain, v / 100 * 0.8, ctx); tc(dry.gain, 1 - 0.4 * v / 100, ctx); }
      else if (k === 'width') { const w = v / 100; tc(LL.gain, (1 + w) / 2, ctx); tc(RR.gain, (1 + w) / 2, ctx); tc(RL.gain, (1 - w) / 2, ctx); tc(LR.gain, (1 - w) / 2, ctx); }
    } };
  }
};

export function initFx({ ensureInput } = {}) {
  const st = load(), q = id => document.getElementById(id);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const E = { ctx: null, src: null, fx: {}, fxIn: null, master: null, limiter: null, outAn: null, inAn: null, on: false, timer: 0, hist: [], loud: 0 };
  const warn = (t, cls = '') => { const w = q('fx-note'); if (!w) return; w.textContent = t || ''; w.className = 'fx-note hint ' + cls; w.hidden = !t; };

  // ── graph (built per audio context; the monitor connects it to the output) ──
  const build = (ctx, src) => {
    E.ctx = ctx; E.src = src; E.fx = {}; E.irName = null; E.mcn = 0; E.mc = null;
    // the input may be a 2-channel stream with the guitar on one side only: sum it to one channel, then send that to both ears
    E.split = ctx.createChannelSplitter(2); E.fxIn = ctx.createGain(); E.fxIn.channelCount = 1; E.fxIn.channelCountMode = 'explicit';
    E.split.connect(E.fxIn, 0); E.split.connect(E.fxIn, 1);
    E.master = ctx.createGain(); E.master.gain.value = 0; E.master.channelCount = 2; E.master.channelCountMode = 'explicit'; E.master.channelInterpretation = 'speakers';
    E.limiter = ctx.createWaveShaper(); E.limiter.curve = clipCurve();   // safety clipper (a compressor-style limiter would add ~6 ms of lookahead)
    E.outAn = ctx.createAnalyser(); E.outAn.fftSize = 4096; E.outAn.smoothingTimeConstant = 0;
    E.mute = ctx.createGain(); E.mute.gain.value = 0; E.mute.connect(ctx.destination);   // keeps the level taps pulled without any playback
    // meters at the end of the chain: a spectrum analyser, and left / right taps for the goniometer (mono is spread to both sides first)
    E.spec = ctx.createAnalyser(); E.spec.fftSize = 4096; E.spec.smoothingTimeConstant = 0.75; E.spec.minDecibels = -100; E.spec.maxDecibels = -10; E.spec.connect(E.mute);
    E.tapUp = ctx.createGain(); E.tapUp.channelCount = 2; E.tapUp.channelCountMode = 'explicit'; E.tapUp.channelInterpretation = 'speakers';
    E.tapSp = ctx.createChannelSplitter(2); E.anL = ctx.createAnalyser(); E.anR = ctx.createAnalyser();
    [E.anL, E.anR].forEach(a => { a.fftSize = 1024; a.smoothingTimeConstant = 0; a.connect(E.mute); }); E.tapUp.connect(E.tapSp); E.tapSp.connect(E.anL, 0); E.tapSp.connect(E.anR, 1);
    ORDER.forEach(id => {
      E.fx[id] = { core: BUILD[id](ctx) }; applyAll(id);
      // input-level tap in front of the effect (works whether the effect is on or bypassed)
      if (FX_DEFS[id].params.some(p => p.gauge)) { const an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0; an.connect(E.mute); E.fx[id].an = an; }
    });
    E.gateOpen = false; E.fx.gate.core.onOpen = open => { E.gateOpen = open; setLed(); };
    E.fx.comp.core.onGr = gr => { E.gr = gr; setGr(); };
    src.connect(E.split);   // the input always flows through the chain; it is only audible once the monitor is on
    wire();
    E.master.connect(E.limiter); E.limiter.connect(E.outAn);   // the output analyser sits after the limiter
    clearInterval(E.mt); E.mt = setInterval(meter, 40);
  };
  const applyAll = id => FX_DEFS[id].params.forEach(p => E.fx[id].core.set(p.k, st.fx[id].p[p.k]));
  // bypassed effects are left out of the signal path completely: no processing and no added latency
  const wire = () => {
    if (!E.ctx) return;
    E.fxIn.disconnect(); ORDER.forEach(id => { try { E.fx[id].core.out.disconnect(); } catch (e) {} });
    let prev = E.fxIn;
    st.order.forEach(id => { const e = E.fx[id]; if (e.an) prev.connect(e.an); if (!st.fx[id].on) return; prev.connect(e.core.in); prev = e.core.out; });
    prev.connect(E.master); prev.connect(E.spec); prev.connect(E.tapUp);
  };
  // time-based effects start from a clean state when they are switched on
  const rebuild = id => { try { E.fx[id].core.out.disconnect(); } catch (e) {} E.fx[id].core = BUILD[id](E.ctx); applyAll(id); };
  const rewire = () => {   // a very short dip hides the click of re-patching while monitoring
    if (!E.ctx) return;
    if (!E.on) { wire(); return; }
    clearTimeout(E.rw); E.master.gain.cancelScheduledValues(E.ctx.currentTime); E.master.gain.setTargetAtTime(0, E.ctx.currentTime, 0.003);
    E.rw = setTimeout(() => { wire(); setMaster(0.01); }, 15);
  };
  const setMaster = (ramp = 0.03) => { if (E.master && E.on) E.master.gain.setTargetAtTime(Math.pow(st.master, 2) * 1.2, E.ctx.currentTime, ramp); };

  // ── level rings around the gate / comp threshold knobs, gate indicator, comp gain-reduction meter ──
  const setLed = () => { const el = q('fx-chain') && q('fx-chain').querySelector('.fx-gate-ind'); if (!el) return; const open = E.gateOpen && st.fx.gate.on; el.classList.toggle('open', open); el.lastElementChild.textContent = st.fx.gate.on ? (open ? '開' : '閉') : '—'; };
  const setGr = () => { const el = q('fx-chain') && q('fx-chain').querySelector('.fx-gr i'); if (el) el.style.width = (st.fx.comp.on ? Math.min(100, (E.gr || 0) / 18 * 100) : 0) + '%'; };
  const prep = c => { const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight; if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); } const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); return [g, w, h]; };
  const drawMeters = () => {
    const cs = q('fx-spec'), cg = q('fx-gonio'); if (!cs || !cg || !E.spec || !E.mvis) return;   // only while the meters are on screen
    const now = performance.now(); if (now - (E.mt0 || 0) < 55) return; E.mt0 = now;   // about 18 fps
    if (!E.mc || ++E.mcn % 25 === 0) { const cst = getComputedStyle(document.documentElement); E.mc = { a: cst.getPropertyValue('--accent1').trim() || '#8c4dff', t: cst.getPropertyValue('--text3').trim() || '#888', l: cst.getPropertyValue('--border2').trim() || '#333' }; E.mcn = 0; }
    // spectrum: 30 Hz - 16 kHz on a log axis, -90 .. -10 dB
    { const [g, W, H] = prep(cs), sr = E.ctx.sampleRate, db = E.sdb || (E.sdb = new Float32Array(E.spec.frequencyBinCount)), nb = Math.floor(W / 4), hz = i => 30 * Math.pow(16000 / 30, i / nb);
      E.spec.getFloatFrequencyData(db);
      g.strokeStyle = E.mc.l; g.fillStyle = E.mc.t; g.font = '9px sans-serif'; g.lineWidth = 1;
      [100, 1000, 10000].forEach(f => { const x = Math.round(W * Math.log(f / 30) / Math.log(16000 / 30)) + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H - 12); g.stroke(); g.fillText(f >= 1000 ? f / 1000 + 'k' : String(f), x + 2, H - 2); });
      g.fillStyle = E.mc.a; g.globalAlpha = 0.85;
      for (let i = 0; i < nb; i++) {
        const p0 = hz(i) * E.spec.fftSize / sr, p1 = hz(i + 1) * E.spec.fftSize / sr; let m = -120;
        if (p1 - p0 < 1) { const k = Math.floor(p0), f = p0 - k; m = db[k] * (1 - f) + db[k + 1] * f; } else for (let b = Math.floor(p0); b <= Math.ceil(p1) && b < db.length; b++) if (db[b] > m) m = db[b];   // bands narrower than a bin are interpolated
        const h = Math.max(0, Math.min(1, (m + 90) / 80)) * (H - 12); g.fillRect(i * 4, H - 12 - h, 3, h);
      }
      g.globalAlpha = 1; }
    // goniometer: L/R rotated 45 degrees (vertical = mono, horizontal = side), with a gentle auto-scale and the L/R correlation
    { const [g, W, H] = prep(cg), L = E.gl || (E.gl = new Float32Array(1024)), R = E.gr || (E.gr = new Float32Array(1024)); E.anL.getFloatTimeDomainData(L); E.anR.getFloatTimeDomainData(R);
      let pk = 0, ll = 0, rr = 0, lr = 0; for (let i = 0; i < 1024; i++) { pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); ll += L[i] * L[i]; rr += R[i] * R[i]; lr += L[i] * R[i]; }
      E.gs = (E.gs || 4) * 0.9 + Math.min(20, 0.6 / Math.max(pk, 0.02)) * 0.1;
      const cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 10;
      g.strokeStyle = E.mc.l; g.fillStyle = E.mc.t; g.lineWidth = 1; g.font = '9px sans-serif';
      g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.stroke(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
      g.fillText('M', cx + 3, cy - r + 8); g.fillText('S', cx + r - 8, cy - 3); g.fillText('L', cx - r + 2, cy - r + 8); g.fillText('R', cx + r - 8, cy - r + 8);
      g.fillStyle = E.mc.a; g.globalAlpha = 0.5; g.beginPath();   // one path for all points
      for (let i = 0; i < 1024; i += 2) { const x = (L[i] - R[i]) * 0.7071 * E.gs, y = (L[i] + R[i]) * 0.7071 * E.gs, px = cx + Math.max(-1, Math.min(1, x)) * r, py = cy - Math.max(-1, Math.min(1, y)) * r; g.rect(px - 0.75, py - 0.75, 1.5, 1.5); }
      g.fill(); g.globalAlpha = 1;
      const cr = q('fx-corr'); if (cr) cr.textContent = pk > 0.003 ? '相関 ' + (lr / Math.sqrt(ll * rr + 1e-12) >= 0 ? '+' : '') + (lr / Math.sqrt(ll * rr + 1e-12)).toFixed(2) : '相関 —'; }
  };
  const meter = () => {
    if (!E.ctx || document.hidden) return;
    const pn = q('fx-panel'); if (pn && pn.classList.contains('collapsed')) return;
    const buf = E.mb || (E.mb = new Float32Array(2048)), host = q('fx-chain');
    ['gate', 'comp'].forEach(id => {
      const e = E.fx[id], ring = host.querySelector(`.fx-ring[data-fx="${id}"]`); if (!e || !e.an || !ring) return;
      e.an.getFloatTimeDomainData(buf); let pk = 0; for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > pk) pk = a; }
      const db = pk > 1e-5 ? 20 * Math.log10(pk) : -100, p = FX_DEFS[id].params[0], f = Math.max(0, Math.min(1, (db - p.min) / (p.max - p.min)));
      ring.querySelector('.lv').setAttribute('stroke-dasharray', `${(f * 100).toFixed(1)} 100`); ring.classList.toggle('hot', db > st.fx[id].p.thr);
    });
    if (!st.fx.comp.on) setGr();
    drawMeters();
  };

  // ── howl guard: a tone that is stable in pitch, much stronger than the rest and still growing -> mute at once ──
  const guard = () => {
    if (!E.on || !E.outAn) return;
    const an = E.outAn, db = E.guardDb || (E.guardDb = new Float32Array(an.frequencyBinCount)), td = E.guardTd || (E.guardTd = new Float32Array(an.fftSize));
    an.getFloatFrequencyData(db); an.getFloatTimeDomainData(td);
    let pk = 0, pi = 0, sum = 0, n = 0, rmsv = 0; for (let i = 0; i < td.length; i++) rmsv += td[i] * td[i]; rmsv = Math.sqrt(rmsv / td.length);
    const lo = Math.floor(80 / (E.ctx.sampleRate / an.fftSize)), hi = Math.floor(6000 / (E.ctx.sampleRate / an.fftSize));
    pk = -200; for (let i = lo; i < hi; i++) { sum += db[i]; n++; if (db[i] > pk) { pk = db[i]; pi = i; } }
    const dom = pk - sum / Math.max(1, n);
    E.hist.push({ pk, pi, dom, rms: rmsv }); if (E.hist.length > 15) E.hist.shift();
    let bad = false;
    if (E.hist.length >= 15) {   // ~1.5 s of one steady, dominant tone that keeps growing a lot
      const a = E.hist[0], b = E.hist[E.hist.length - 1], stable = E.hist.every(h => Math.abs(h.pi - b.pi) <= 2), tonal = E.hist.every(h => h.dom > 35), grow = b.pk - a.pk > 15 && b.rms > a.rms * 3 && b.rms > 0.05;
      if (stable && tonal && grow) bad = true;
    }
    E.loud = rmsv > 0.45 && dom > 35 ? E.loud + 1 : 0;       // very loud and tonal for ~1.5 s
    if (bad || E.loud >= 15) howl();
  };
  const howl = () => { stopMonitor(true); warn('ハウリングの可能性があったため、モニターを止めました。ヘッドホンやモニタースピーカーの位置・音量を見直してから、もう一度お試しください。', 'err'); };

  const refreshUi = () => {
    const b = q('fx-monitor'); if (!b) return;
    b.classList.toggle('on', E.on); b.setAttribute('aria-pressed', String(E.on)); q('fx-monitor-label').textContent = E.on ? 'モニターを止める' : 'モニターを始める';
    q('fx-state').textContent = E.on ? 'モニター中（ヘッドホン／モニタースピーカー推奨）' : '出力しない（入力のみ）'; q('fx-state').classList.toggle('on', E.on);
  };
  const noteOn = () => warn(st.guard ? 'モニター中です。ヘッドホンか、モニタースピーカーでお使いください。ギターに近いスピーカーだと、音が回り込んでハウリングすることがあります。' : 'ハウリング検知をオフにしています。音量と、スピーカーの位置にご注意ください。');
  const startMonitor = () => {
    if (E.on || !E.ctx) return;
    E.on = true; E.hist = []; E.loud = 0; E.master.gain.value = 0;
    E.limiter.connect(E.ctx.destination);
    setMaster(0.15); clearInterval(E.timer); E.timer = st.guard ? setInterval(guard, 100) : 0;
    noteOn();
    refreshUi();
  };
  const stopMonitor = (quick) => {
    if (!E.ctx) { E.on = false; refreshUi(); return; }
    clearInterval(E.timer); E.timer = 0;
    if (E.on) {
      try { E.master.gain.cancelScheduledValues(E.ctx.currentTime); E.master.gain.setTargetAtTime(0, E.ctx.currentTime, quick ? 0.004 : 0.03); } catch (e) {}
      const c = E.ctx, lim = E.limiter;
      setTimeout(() => { try { lim.disconnect(c.destination); } catch (e) {} }, quick ? 40 : 150);
    }
    E.on = false; if (!quick) warn(''); refreshUi();
  };

  // ── UI ──
  const fmt = (p, v) => (p.step >= 1 ? Math.round(v) : v.toFixed(1)) + (p.unit || '');
  const fmtF = v => (v > 0 ? '+' : '') + Math.round(v);
  const COLORS = { gate: '#94a3b8', comp: '#5aa9ff', od: '#4ade80', dist: '#f97316', amp: '#c084fc', eq: '#facc15', delay: '#22d3ee', reverb: '#f472b6' };
  const ang = (p, v) => -135 + 270 * (v - p.min) / (p.max - p.min);
  const ARC = 'M 8.15 37.85 A 21 21 0 1 1 37.85 37.85';   // 8 o'clock to 4 o'clock, the same sweep as the knob
  const ringHtml = id => `<svg class="fx-ring" data-fx="${id}" viewBox="0 0 46 46" aria-hidden="true"><path class="trk" d="${ARC}" pathLength="100"/><path class="lv" d="${ARC}" pathLength="100" stroke-dasharray="0 100"/></svg>`;
  const knobHtml = (id, p, v) => `<div class="fx-kn"><div class="fx-kw">${p.gauge ? ringHtml(id) : ''}<div class="fx-knob" role="slider" tabindex="0" data-fx="${id}" data-k="${p.k}" aria-label="${p.label}" aria-valuemin="${p.min}" aria-valuemax="${p.max}" aria-valuenow="${v}" style="--a:${ang(p, v)}deg"><i></i></div></div><span class="fx-kl">${p.label}</span><span class="fx-kv">${fmt(p, v)}</span></div>`;
  const faderHtml = (id, p, v) => `<div class="fx-fd"><div class="fx-fader" role="slider" tabindex="0" data-fx="${id}" data-k="${p.k}" aria-label="${p.label}Hz" aria-valuemin="${p.min}" aria-valuemax="${p.max}" aria-valuenow="${v}" style="--f:${(v - p.min) / (p.max - p.min)}"><i></i></div><span class="fx-fl">${p.label}</span><span class="fx-kv">${fmtF(v)}</span></div>`;
  const extraHtml = (id, s) => {
    if (id === 'gate') return '<div class="fx-extra"><span class="fx-gate-ind"><i></i><em>—</em></span></div>';
    if (id === 'comp') return '<div class="fx-extra"><span class="fx-gr-l">GR</span><span class="fx-gr"><i></i></span></div>';
    if (id === 'amp') return `<div class="fx-extra"><span class="fx-seg"><button type="button" class="${s.p.mode ? '' : 'on'}" data-fx="amp" data-k="mode" data-v="0">クリーン</button><button type="button" class="${s.p.mode ? 'on' : ''}" data-fx="amp" data-k="mode" data-v="1">歪み</button></span><button type="button" class="fx-chip ${s.p.cab ? 'on' : ''}" data-fx="amp" data-k="cab">キャビ ${s.p.cab ? 'ON' : 'OFF'}</button><button type="button" class="fx-chip ${E.irName ? 'on' : ''}" id="fx-ir" title="${E.irName ? E.irName.replace(/"/g, '') + '（クリックで標準に戻す）' : '標準のIRを使用中（クリックでIRファイルを読み込み）'}">${E.irName ? 'IR ✓' : 'IR'}</button><input type="file" id="fx-ir-file" accept="audio/*,.wav" hidden></div>`;
    if (id === 'reverb') return `<div class="fx-extra"><select class="fx-sel" data-fx="reverb" data-k="type" aria-label="リバーブの種類">${REVERB_TYPES.map((t, i) => `<option value="${i}" ${Math.round(s.p.type) === i ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
    return '<div class="fx-extra"></div>';
  };
  const renderChain = () => {
    const host = q('fx-chain'); if (!host) return;
    host.classList.toggle('flip', st.flip);
    const n = st.order.length;
    host.innerHTML = `<div class="fx-io in">${st.flip ? '◀ IN' : 'IN ▶'}</div>` + st.order.map((id, i) => {
      const d = FX_DEFS[id], s = st.fx[id], by = k => d.params.find(p => p.k === k);
      const rows = d.rows.map(r => `<div class="fx-row">${r.map(k => (d.fader ? faderHtml : knobHtml)(id, by(k), s.p[k])).join('')}</div>`).join('');
      const lt = st.flip ? i + 1 : i - 1, rt = st.flip ? i - 1 : i + 1;   // the arrows move the pedal to the left / right on screen
      return `<div class="fx-mod ${s.on ? 'on' : ''}" data-id="${id}" style="--c:${COLORS[id]}"><div class="fx-top"><i class="fx-led"></i><b>${d.name}</b></div><div class="fx-knobs">${rows}</div>${extraHtml(id, s)}<button type="button" class="fx-foot-sw" data-fx="${id}" aria-pressed="${s.on}" aria-label="${d.name}のオン・オフ"><span></span></button><span class="fx-mv"><button type="button" class="fx-up" data-fx="${id}" aria-label="左へ" ${lt < 0 || lt >= n ? 'disabled' : ''}>◀</button><button type="button" class="fx-dn" data-fx="${id}" aria-label="右へ" ${rt < 0 || rt >= n ? 'disabled' : ''}>▶</button></span></div>`;
    }).join('') + `<div class="fx-io out">${st.flip ? '◀ OUT' : '▶ OUT'}</div>`;
    setLed(); setGr();
    const fl = q('fx-flip'); if (fl) fl.textContent = st.flip ? '並び：実機式（右→左）' : '並び：プラグイン式（左→右）';
  };
  const setParam = (id, k, v) => {
    st.fx[id].p[k] = v; if (E.fx[id]) E.fx[id].core.set(k, v); save();
    const p = FX_DEFS[id].params.find(x => x.k === k), el = q('fx-chain').querySelector(`.fx-knob[data-fx="${id}"][data-k="${k}"], .fx-fader[data-fx="${id}"][data-k="${k}"]`);
    if (el) {
      const fader = el.classList.contains('fx-fader');
      if (fader) el.style.setProperty('--f', (v - p.min) / (p.max - p.min)); else el.style.setProperty('--a', ang(p, v) + 'deg');
      el.setAttribute('aria-valuenow', v); el.closest('.fx-kn, .fx-fd').querySelector('.fx-kv').textContent = fader ? fmtF(v) : fmt(p, v);
    }
  };
  const switchAmpMode = v => {
    const a = st.fx.amp, old = a.p.mode ? 1 : 0; if (old === v) return;
    a.mem[old] = Object.fromEntries(AMP_KNOBS.map(k => [k, a.p[k]])); a.p.mode = v; Object.assign(a.p, a.mem[v]);
    if (E.fx.amp) applyAll('amp'); save(); renderChain();
  };
  const setOn = (id, on) => { st.fx[id].on = on; if (E.fx[id]) { if (on && (id === 'delay' || id === 'reverb')) rebuild(id); rewire(); } const m = q('fx-chain').querySelector(`.fx-mod[data-id="${id}"]`); if (m) { m.classList.toggle('on', on); m.querySelector('.fx-foot-sw').setAttribute('aria-pressed', String(on)); } setLed(); setGr(); save(); };
  const fillOut = async () => {
    const sel = q('fx-out'); if (!sel) return;
    if (!E.ctx || typeof E.ctx.setSinkId !== 'function') { q('fx-out-w').hidden = true; return; }
    q('fx-out-w').hidden = false;
    try {
      const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput');
      sel.innerHTML = '<option value="">既定の出力</option>' + devs.filter(d => d.deviceId && d.deviceId !== 'default').map(d => `<option value="${d.deviceId}">${(d.label || '出力デバイス').replace(/</g, '&lt;')}</option>`).join('');
      sel.value = devs.some(d => d.deviceId === st.out) ? st.out : '';
    } catch (e) {}
  };
  const applySink = () => { if (E.ctx && typeof E.ctx.setSinkId === 'function') E.ctx.setSinkId(st.out || '').catch(() => {}); };

  const bind = () => {
    renderChain(); refreshUi();
    q('fx-master').value = Math.round(st.master * 100); q('fx-master-v').textContent = Math.round(st.master * 100);
    q('fx-master').addEventListener('input', e => { st.master = e.target.value / 100; q('fx-master-v').textContent = e.target.value; setMaster(); save(); });
    const host = q('fx-chain');
    // knobs: drag up/down (or wheel / arrow keys); double-click = default
    let drag = null;
    const knobStep = (kn, dir, fine) => { const id = kn.dataset.fx, p = FX_DEFS[id].params.find(x => x.k === kn.dataset.k), cur = st.fx[id].p[p.k]; setParam(id, p.k, Math.max(p.min, Math.min(p.max, Math.round((cur + dir * p.step * (fine ? 1 : Math.max(1, Math.round((p.max - p.min) / p.step / 40)))) / p.step) * p.step))); };
    host.addEventListener('pointerdown', e => {
      const kn = e.target.closest('.fx-knob, .fx-fader'); if (!kn) return; e.preventDefault(); kn.focus();
      const id = kn.dataset.fx, p = FX_DEFS[id].params.find(x => x.k === kn.dataset.k); drag = { kn, id, p, y: e.clientY, v: st.fx[id].p[p.k] }; kn.setPointerCapture(e.pointerId);
    });
    host.addEventListener('pointermove', e => {
      if (!drag) return; const { p } = drag, span = drag.kn.classList.contains('fx-fader') ? 90 : 150, raw = drag.v + (drag.y - e.clientY) / (e.shiftKey ? span * 4 : span) * (p.max - p.min);
      setParam(drag.id, p.k, Math.max(p.min, Math.min(p.max, Math.round(raw / p.step) * p.step)));
    });
    const end = () => { drag = null; }; host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end);
    host.addEventListener('dblclick', e => { const kn = e.target.closest('.fx-knob, .fx-fader'); if (!kn) return; const p = FX_DEFS[kn.dataset.fx].params.find(x => x.k === kn.dataset.k); setParam(kn.dataset.fx, p.k, p.def); });
    host.addEventListener('wheel', e => { const kn = e.target.closest('.fx-knob, .fx-fader'); if (!kn || document.activeElement !== kn) return; e.preventDefault(); knobStep(kn, e.deltaY < 0 ? 1 : -1, true); }, { passive: false });
    host.addEventListener('keydown', e => { const kn = e.target.closest('.fx-knob, .fx-fader'); if (!kn) return; const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]; if (!dir) return; e.preventDefault(); knobStep(kn, dir, true); });
    host.addEventListener('click', e => {
      const b = e.target.closest('.fx-up, .fx-dn'); if (b) {
        const id = b.dataset.fx, i = st.order.indexOf(id), j = i + (b.classList.contains('fx-up') === !st.flip ? -1 : 1);
        if (j >= 0 && j < st.order.length) { [st.order[i], st.order[j]] = [st.order[j], st.order[i]]; save(); renderChain(); wire(); }
        return;
      }
      const sg = e.target.closest('.fx-seg button'); if (sg) { switchAmpMode(+sg.dataset.v); return; }
      const sw = e.target.closest('.fx-foot-sw'); if (sw) { setOn(sw.dataset.fx, !st.fx[sw.dataset.fx].on); return; }
      const cab = e.target.closest('.fx-chip[data-k="cab"]'); if (cab) { const v = st.fx.amp.p.cab ? 0 : 1; setParam('amp', 'cab', v); cab.classList.toggle('on', !!v); cab.textContent = 'キャビ ' + (v ? 'ON' : 'OFF'); return; }
      if (e.target.id === 'fx-ir') {
        if (E.irName) { E.fx.amp.core.setIr(null); E.irName = null; const c = q('fx-ir'); c.textContent = 'IR'; c.classList.remove('on'); c.title = '標準のIRを使用中（クリックでIRファイルを読み込み）'; }
        else q('fx-ir-file').click();
      }
    });
    host.addEventListener('change', async e => {
      if (e.target.classList && e.target.classList.contains('fx-sel')) { setParam(e.target.dataset.fx, e.target.dataset.k, +e.target.value); return; }
      if (e.target.id !== 'fx-ir-file' || !e.target.files[0] || !E.ctx) return;
      try { const buf = await E.ctx.decodeAudioData(await e.target.files[0].arrayBuffer()); E.fx.amp.core.setIr(buf); E.irName = e.target.files[0].name; q('fx-ir').textContent = 'IR ✓'; q('fx-ir').classList.add('on'); q('fx-ir').title = E.irName + '（クリックで標準に戻す）'; }
      catch (err) { warn('IRファイルを読み込めませんでした。', 'err'); }
    });
    if ('IntersectionObserver' in window && q('fx-spec')) new IntersectionObserver(es => { E.mvis = es.some(x => x.isIntersecting); }, { threshold: 0 }).observe(q('fx-spec').closest('.fx-meters')); else E.mvis = true;
    q('fx-guard').checked = st.guard;
    q('fx-guard').addEventListener('change', e => {
      st.guard = e.target.checked; save();
      if (E.on) { clearInterval(E.timer); E.hist = []; E.loud = 0; E.timer = st.guard ? setInterval(guard, 100) : 0; noteOn(); }
    });
    q('fx-flip').addEventListener('click', () => { st.flip = !st.flip; save(); renderChain(); });
    q('fx-out').addEventListener('change', e => { st.out = e.target.value; save(); applySink(); });
    q('fx-reset').addEventListener('click', () => { const d = defState(); st.order = d.order; st.fx = d.fx; save(); renderChain(); if (E.ctx) { ORDER.forEach(applyAll); rewire(); } });
    const go = () => { sessionStorage.setItem(ACK, '1'); q('fx-confirm').hidden = true; startMonitor(); };
    q('fx-go').addEventListener('click', go);
    q('fx-cancel').addEventListener('click', () => { q('fx-confirm').hidden = true; });
    q('fx-monitor').addEventListener('click', async () => {
      if (E.on) return stopMonitor();
      if (!E.ctx && ensureInput) await ensureInput();
      if (!E.ctx) { warn('先に「ギター入力をオンにする」でギター入力を開始してください。', 'err'); return; }
      let ack = false; try { ack = sessionStorage.getItem(ACK) === '1'; } catch (e) {}
      if (ack) startMonitor(); else q('fx-confirm').hidden = false;
    });
  };
  bind();
  return {
    attach(ctx, src) { build(ctx, src); applySink(); fillOut(); refreshUi(); },
    detach() { if (E.on) stopMonitor(true); clearInterval(E.mt); E.ctx = null; E.src = null; E.fx = {}; q('fx-confirm') && (q('fx-confirm').hidden = true); refreshUi(); },
    get monitoring() { return E.on; }
  };
}
export { BUILD as FX_BUILD, widener as fxWidener, makeCabIr as fxCabIr };
