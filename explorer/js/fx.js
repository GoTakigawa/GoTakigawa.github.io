// Effects for monitoring the guitar input: noise gate / comp / overdrive / distortion / amp sim / EQ / delay / reverb.
// The pitch detection always listens to the dry input; the effects only feed the monitor output, which is OFF by default.
// A howl guard watches the output while monitoring and stops it when a tone starts to run away.
const KEY = 'gti-explorer:fx';
const ACK = 'gti-explorer:fx-ack';

export const FX_DEFS = {
  gate: { name: 'ノイズゲート', params: [
    { k: 'thr', label: 'しきい値', min: -80, max: -20, step: 1, def: -55, unit: 'dB' },
    { k: 'rel', label: 'リリース', min: 10, max: 500, step: 10, def: 120, unit: 'ms' }] },
  comp: { name: 'コンプ', params: [
    { k: 'thr', label: 'しきい値', min: -60, max: 0, step: 1, def: -24, unit: 'dB' },
    { k: 'ratio', label: 'レシオ', min: 1, max: 20, step: 0.5, def: 4, unit: ':1' },
    { k: 'att', label: 'アタック', min: 1, max: 100, step: 1, def: 10, unit: 'ms' },
    { k: 'rel', label: 'リリース', min: 50, max: 1000, step: 10, def: 250, unit: 'ms' },
    { k: 'gain', label: '出力', min: 0, max: 24, step: 0.5, def: 6, unit: 'dB' }] },
  od: { name: 'オーバードライブ', params: [
    { k: 'drive', label: 'ドライブ', min: 0, max: 100, step: 1, def: 40, unit: '' },
    { k: 'tone', label: 'トーン', min: 1000, max: 8000, step: 100, def: 3500, unit: 'Hz' },
    { k: 'level', label: 'レベル', min: -18, max: 12, step: 0.5, def: 0, unit: 'dB' }] },
  dist: { name: 'ディストーション', params: [
    { k: 'drive', label: 'ドライブ', min: 0, max: 100, step: 1, def: 65, unit: '' },
    { k: 'tone', label: 'トーン', min: 1000, max: 8000, step: 100, def: 3000, unit: 'Hz' },
    { k: 'level', label: 'レベル', min: -18, max: 12, step: 0.5, def: -6, unit: 'dB' }] },
  amp: { name: 'アンプシミュ', params: [
    { k: 'gain', label: 'ゲイン', min: 0, max: 100, step: 1, def: 50, unit: '' },
    { k: 'bass', label: 'ベース', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' },
    { k: 'mid', label: 'ミドル', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' },
    { k: 'treble', label: 'トレブル', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' },
    { k: 'cab', label: 'キャビネット', toggle: true, def: 1 },
    { k: 'level', label: 'レベル', min: -18, max: 12, step: 0.5, def: -3, unit: 'dB' },
    { k: 'width', label: 'ワイド', min: 0, max: 100, step: 1, def: 0, unit: '%' }] },
  eq: { name: 'EQ', params: [
    { k: 'low', label: '100Hz', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' },
    { k: 'lmid', label: '400Hz', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' },
    { k: 'hmid', label: '2kHz', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' },
    { k: 'high', label: '6kHz', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' }] },
  delay: { name: 'ディレイ', params: [
    { k: 'time', label: 'タイム', min: 50, max: 1000, step: 10, def: 350, unit: 'ms' },
    { k: 'fb', label: 'リピート', min: 0, max: 85, step: 1, def: 35, unit: '%' },
    { k: 'mix', label: 'ミックス', min: 0, max: 100, step: 1, def: 30, unit: '%' }] },
  reverb: { name: 'リバーブ', params: [
    { k: 'decay', label: '長さ', min: 0.3, max: 6, step: 0.1, def: 2, unit: '秒' },
    { k: 'damp', label: 'ダンピング', min: 0, max: 100, step: 1, def: 50, unit: '' },
    { k: 'mix', label: 'ミックス', min: 0, max: 100, step: 1, def: 25, unit: '%' },
    { k: 'width', label: 'ワイド', min: 0, max: 200, step: 1, def: 100, unit: '%' }] }
};
const ORDER = ['gate', 'comp', 'od', 'dist', 'amp', 'eq', 'delay', 'reverb'];
const defState = () => ({ order: ORDER.slice(), master: 0.5, out: '', fx: Object.fromEntries(ORDER.map(id => [id, { on: false, p: Object.fromEntries(FX_DEFS[id].params.map(p => [p.k, p.def])) }])) });
function load() {
  const s = defState();
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!o) return s;
    if (Array.isArray(o.order)) { const ord = o.order.filter(id => ORDER.includes(id)); ORDER.forEach(id => { if (!ord.includes(id)) { if (id === 'gate') ord.unshift(id); else ord.push(id); } }); s.order = ord; }
    if (typeof o.master === 'number') s.master = Math.max(0, Math.min(1, o.master));
    if (typeof o.out === 'string') s.out = o.out;
    ORDER.forEach(id => { const f = o.fx && o.fx[id]; if (!f) return; s.fx[id].on = !!f.on; FX_DEFS[id].params.forEach(p => { const v = f.p && f.p[p.k]; if (typeof v === 'number' && v >= (p.min ?? 0) && v <= (p.max ?? 1)) s.fx[id].p[p.k] = v; }); });
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
  constructor() { super(); this.env = 0; this.g = 0; this.hold = 0; this.open = false; }
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
    return true;
  }
}
registerProcessor('gti-gate', GtiGate);
// feed-forward compressor without lookahead (the built-in DynamicsCompressor delays the signal by ~6 ms)
class GtiComp extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [['thr', -24], ['ratio', 4], ['att', 10], ['rel', 250]].map(([name, defaultValue]) => ({ name, defaultValue, automationRate: 'k-rate' })); }
  constructor() { super(); this.gr = 0; }
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
    return true;
  }
}
registerProcessor('gti-comp', GtiComp);`;
const gateReady = new WeakMap();
const loadGate = ctx => { if (!gateReady.has(ctx)) gateReady.set(ctx, ctx.audioWorklet ? ctx.audioWorklet.addModule(URL.createObjectURL(new Blob([GATE_SRC], { type: 'application/javascript' }))) : Promise.reject(new Error('no worklet'))); return gateReady.get(ctx); };

// a decaying stereo noise tail for the reverb; damp 0..100 darkens it along the tail
function reverbIr(ctx, sec, damp) {
  const sr = ctx.sampleRate, len = Math.max(1, Math.floor(sr * sec)), buf = ctx.createBuffer(2, len, sr), a = 0.15 + 0.8 * (1 - damp / 100);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let y = 0; for (let i = 0; i < len; i++) { const t = i / len, aa = Math.max(0.04, a * (1 - 0.6 * t)); y += aa * ((Math.random() * 2 - 1) - y); d[i] = y * Math.exp(-6.5 * t) * (i < 200 ? i / 200 : 1); } }
  return buf;
}

// each builder returns the effect core { in, out, set(k, v) }; the wrapper adds an on/off (bypass) around it
const BUILD = {
  gate(ctx) {
    const inn = ctx.createGain(), out = ctx.createGain(), val = { thr: -55, rel: 120 }; let wn = null;
    inn.connect(out);   // open until the worklet has loaded
    loadGate(ctx).then(() => {
      wn = new AudioWorkletNode(ctx, 'gti-gate', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1] });
      wn.parameters.get('thr').value = val.thr; wn.parameters.get('rel').value = val.rel;
      try { inn.disconnect(out); } catch (e) {} inn.connect(wn); wn.connect(out);
    }).catch(() => {});
    return { in: inn, out, set(k, v) { val[k] = v; if (wn) wn.parameters.get(k).value = v; } };
  },
  comp(ctx) {
    const inn = ctx.createGain(), g = ctx.createGain(), val = { thr: -24, ratio: 4, att: 10, rel: 250 }; let wn = null, fb = null;
    // until the worklet has loaded (or if it is unavailable) the built-in compressor is used
    fb = ctx.createDynamicsCompressor(); fb.knee.value = 12; inn.connect(fb); fb.connect(g);
    const apply = () => { fb.threshold.value = val.thr; fb.ratio.value = val.ratio; fb.attack.value = val.att / 1000; fb.release.value = val.rel / 1000; };
    loadGate(ctx).then(() => {
      wn = new AudioWorkletNode(ctx, 'gti-comp', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit', outputChannelCount: [1] });
      ['thr', 'ratio', 'att', 'rel'].forEach(k => { wn.parameters.get(k).value = val[k]; });
      try { inn.disconnect(fb); fb.disconnect(g); } catch (e) {} fb = null; inn.connect(wn); wn.connect(g);
    }).catch(() => {});
    apply();
    return { in: inn, out: g, set(k, v) { if (k === 'gain') tc(g.gain, dbLin(v), ctx); else { val[k] = v; if (wn) wn.parameters.get(k).value = v; else if (fb) apply(); } } };
  },
  od(ctx) {
    const hp = node(ctx, 'highpass', { frequency: 120 }), mid = node(ctx, 'peaking', { frequency: 720, gain: 4 }), pre = ctx.createGain(), sh = shaper(ctx, 2.2), lp = node(ctx, 'lowpass', { frequency: 3500 }), out = ctx.createGain();
    hp.connect(mid); mid.connect(pre); pre.connect(sh); sh.connect(lp); lp.connect(out);
    return { in: hp, out, set(k, v) { if (k === 'drive') tc(pre.gain, 1 + Math.pow(v / 100, 1.5) * 9, ctx); else if (k === 'tone') tc(lp.frequency, v, ctx); else if (k === 'level') tc(out.gain, dbLin(v), ctx); } };
  },
  dist(ctx) {
    const hp = node(ctx, 'highpass', { frequency: 90 }), pre = ctx.createGain(), sh = shaper(ctx, 6), lp = node(ctx, 'lowpass', { frequency: 3000 }), lp2 = node(ctx, 'lowpass', { frequency: 6000, Q: 0.7 }), out = ctx.createGain();
    hp.connect(pre); pre.connect(sh); sh.connect(lp); lp.connect(lp2); lp2.connect(out);
    return { in: hp, out, set(k, v) { if (k === 'drive') tc(pre.gain, 3 + Math.pow(v / 100, 1.6) * 57, ctx); else if (k === 'tone') tc(lp.frequency, v, ctx); else if (k === 'level') tc(out.gain, dbLin(v), ctx); } };
  },
  amp(ctx) {
    const hp = node(ctx, 'highpass', { frequency: 80 }), pre = ctx.createGain(), sh = shaper(ctx, 4), post = node(ctx, 'highpass', { frequency: 60 });
    const bass = node(ctx, 'lowshelf', { frequency: 120 }), mid = node(ctx, 'peaking', { frequency: 700, Q: 0.8 }), tre = node(ctx, 'highshelf', { frequency: 3200 });
    hp.connect(pre); pre.connect(sh); sh.connect(post); post.connect(bass); bass.connect(mid); mid.connect(tre);
    // cabinet: a few filters, or a loaded impulse response (see loadIr)
    const cabIn = ctx.createGain(), cabOff = ctx.createGain(), cabBiq = ctx.createGain(), cabConv = ctx.createGain(), cabOut = ctx.createGain(), level = ctx.createGain();
    const c1 = node(ctx, 'highpass', { frequency: 90 }), c2 = node(ctx, 'peaking', { frequency: 2200, Q: 1, gain: 3 }), c3 = node(ctx, 'lowpass', { frequency: 5200, Q: 0.7 }), c4 = node(ctx, 'lowpass', { frequency: 5200, Q: 0.7 });
    const conv = ctx.createConvolver(); let cab = 1, hasIr = false;
    tre.connect(cabIn); cabIn.connect(cabOff); cabOff.connect(cabOut);
    cabIn.connect(c1); c1.connect(c2); c2.connect(c3); c3.connect(c4); c4.connect(cabBiq); cabBiq.connect(cabOut);
    cabIn.connect(conv); conv.connect(cabConv); cabConv.connect(cabOut); cabOut.connect(level);
    const wid = widener(ctx); level.connect(wid.in);
    const route = () => { tc(cabOff.gain, cab ? 0 : 1, ctx); tc(cabBiq.gain, cab && !hasIr ? 1 : 0, ctx); tc(cabConv.gain, cab && hasIr ? 1 : 0, ctx); };
    route();
    return {
      in: hp, out: wid.out,
      set(k, v) { if (k === 'gain') tc(pre.gain, 2 + Math.pow(v / 100, 1.6) * 38, ctx); else if (k === 'bass') tc(bass.gain, v, ctx); else if (k === 'mid') tc(mid.gain, v, ctx); else if (k === 'treble') tc(tre.gain, v, ctx); else if (k === 'cab') { cab = v ? 1 : 0; route(); } else if (k === 'level') tc(level.gain, dbLin(v), ctx); else if (k === 'width') wid.set(v / 100); },
      setIr(buf) { conv.buffer = buf; hasIr = !!buf; route(); }
    };
  },
  eq(ctx) {
    const f = [['lowshelf', 100], ['peaking', 400], ['peaking', 2000], ['highshelf', 6000]].map(([t, fr]) => node(ctx, t, { frequency: fr, Q: 0.9 }));
    f.forEach((x, i) => { if (i) f[i - 1].connect(x); });
    const key = { low: 0, lmid: 1, hmid: 2, high: 3 };
    return { in: f[0], out: f[3], set(k, v) { if (k in key) tc(f[key[k]].gain, v, ctx); } };
  },
  delay(ctx) {
    const inn = ctx.createGain(), dry = ctx.createGain(), d = ctx.createDelay(1.2), fb = ctx.createGain(), lp = node(ctx, 'lowpass', { frequency: 4200 }), wet = ctx.createGain(), out = ctx.createGain();
    inn.connect(dry); dry.connect(out); inn.connect(d); d.connect(lp); lp.connect(fb); fb.connect(d); lp.connect(wet); wet.connect(out);
    return { in: inn, out, set(k, v) { if (k === 'time') tc(d.delayTime, v / 1000, ctx, 0.05); else if (k === 'fb') tc(fb.gain, Math.min(0.85, v / 100), ctx); else if (k === 'mix') { tc(wet.gain, v / 100, ctx); tc(dry.gain, 1 - 0.5 * v / 100, ctx); } } };
  },
  reverb(ctx) {
    const inn = ctx.createGain(), dry = ctx.createGain(), conv = ctx.createConvolver(), wet = ctx.createGain(), out = ctx.createGain(); let decay = 2, damp = 50, tm = 0;
    // width: M/S on the stereo tail (100% = as generated, 0% = mono)
    const spl = ctx.createChannelSplitter(2), mg = ctx.createChannelMerger(2), sL = ctx.createGain(), sR = ctx.createGain(), LL = ctx.createGain(), RL = ctx.createGain(), LR = ctx.createGain(), RR = ctx.createGain();
    conv.connect(spl); spl.connect(LL, 0); spl.connect(LR, 0); spl.connect(RL, 1); spl.connect(RR, 1); LL.connect(sL); RL.connect(sL); LR.connect(sR); RR.connect(sR); sL.connect(mg, 0, 0); sR.connect(mg, 0, 1); mg.connect(wet);
    inn.connect(dry); dry.connect(out); inn.connect(conv); wet.connect(out);
    const regen = () => { clearTimeout(tm); tm = setTimeout(() => { try { conv.buffer = reverbIr(ctx, decay, damp); } catch (e) {} }, 120); };
    conv.buffer = reverbIr(ctx, decay, damp);
    return { in: inn, out, set(k, v) { if (k === 'decay') { decay = v; regen(); } else if (k === 'damp') { damp = v; regen(); } else if (k === 'mix') { tc(wet.gain, v / 100 * 0.8, ctx); tc(dry.gain, 1 - 0.4 * v / 100, ctx); } else if (k === 'width') { const w = v / 100; tc(LL.gain, (1 + w) / 2, ctx); tc(RR.gain, (1 + w) / 2, ctx); tc(RL.gain, (1 - w) / 2, ctx); tc(LR.gain, (1 - w) / 2, ctx); } } };
  }
};

export function initFx({ ensureInput } = {}) {
  const st = load(), q = id => document.getElementById(id);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const E = { ctx: null, src: null, fx: {}, fxIn: null, master: null, limiter: null, outAn: null, inAn: null, on: false, timer: 0, hist: [], loud: 0, tick: 0 };
  const warn = (t, cls = '') => { const w = q('fx-note'); if (!w) return; w.textContent = t || ''; w.className = 'fx-note hint ' + cls; w.hidden = !t; };

  // ── graph (built per audio context; the monitor connects it to the output) ──
  const build = (ctx, src) => {
    E.ctx = ctx; E.src = src; E.fx = {};
    // the input may be a 2-channel stream with the guitar on one side only: sum it to one channel, then send that to both ears
    E.split = ctx.createChannelSplitter(2); E.fxIn = ctx.createGain(); E.fxIn.channelCount = 1; E.fxIn.channelCountMode = 'explicit';
    E.split.connect(E.fxIn, 0); E.split.connect(E.fxIn, 1);
    E.master = ctx.createGain(); E.master.gain.value = 0; E.master.channelCount = 2; E.master.channelCountMode = 'explicit'; E.master.channelInterpretation = 'speakers';
    E.limiter = ctx.createWaveShaper(); E.limiter.curve = clipCurve();   // safety clipper (a compressor-style limiter would add ~6 ms of lookahead)
    E.outAn = ctx.createAnalyser(); E.outAn.fftSize = 4096; E.outAn.smoothingTimeConstant = 0;
    ORDER.forEach(id => { E.fx[id] = { core: BUILD[id](ctx) }; applyAll(id); });
    wire();
    E.master.connect(E.limiter); E.limiter.connect(E.outAn);   // the output analyser sits after the limiter
    E.inAn = null;
  };
  const applyAll = id => FX_DEFS[id].params.forEach(p => E.fx[id].core.set(p.k, st.fx[id].p[p.k]));
  // bypassed effects are left out of the signal path completely: no processing and no added latency
  const wire = () => {
    if (!E.ctx) return;
    E.fxIn.disconnect(); ORDER.forEach(id => { try { E.fx[id].core.out.disconnect(); } catch (e) {} });
    let prev = E.fxIn; st.order.forEach(id => { if (!st.fx[id].on) return; prev.connect(E.fx[id].core.in); prev = E.fx[id].core.out; }); prev.connect(E.master);
  };
  // time-based effects start from a clean state when they are switched on
  const rebuild = id => { try { E.fx[id].core.out.disconnect(); } catch (e) {} E.fx[id] = { core: BUILD[id](E.ctx) }; applyAll(id); };
  const rewire = () => {   // a very short dip hides the click of re-patching while monitoring
    if (!E.ctx) return;
    if (!E.on) { wire(); return; }
    clearTimeout(E.rw); E.master.gain.cancelScheduledValues(E.ctx.currentTime); E.master.gain.setTargetAtTime(0, E.ctx.currentTime, 0.003);
    E.rw = setTimeout(() => { wire(); setMaster(0.01); }, 15);
  };
  const setMaster = (ramp = 0.03) => { if (E.master && E.on) E.master.gain.setTargetAtTime(Math.pow(st.master, 2) * 1.2, E.ctx.currentTime, ramp); };

  // ── howl guard: a tone that is stable in pitch, much stronger than the rest and still growing -> mute at once ──
  const guard = () => {
    if (!E.on || !E.outAn) return;
    if (++E.tick % 10 === 0) refreshUi();   // the browser reports the output latency a little after starting
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
    const lat = q('fx-lat'); if (lat) if (E.on && E.ctx) {
      let inp = 0; try { inp = E.src.mediaStream.getAudioTracks()[0].getSettings().latency || 0; } catch (e) {}
      const base = (E.ctx.baseLatency || 0) * 1000, out = (E.ctx.outputLatency || 0) * 1000, ms = x => Math.round(x);
      lat.textContent = `遅延 約 ${ms(inp * 1000 + base + out)} ms（入力 ${ms(inp * 1000)}・処理 ${ms(base)}・出力 ${ms(out)}・${Math.round(E.ctx.sampleRate / 100) / 10}kHz）`;
    } else lat.textContent = '';
  };
  const startMonitor = () => {
    if (E.on || !E.ctx) return;
    E.on = true; E.hist = []; E.loud = 0; E.master.gain.value = 0;
    E.limiter.connect(E.ctx.destination); E.src.connect(E.split);
    setMaster(0.15); clearInterval(E.timer); E.timer = setInterval(guard, 100);
    warn('モニター中です。ヘッドホンか、モニタースピーカーでお使いください。ギターに近いスピーカーだと、音が回り込んでハウリングすることがあります。');
    refreshUi();
  };
  const stopMonitor = (quick) => {
    if (!E.ctx) { E.on = false; refreshUi(); return; }
    clearInterval(E.timer); E.timer = 0;
    if (E.on) {
      try { E.master.gain.cancelScheduledValues(E.ctx.currentTime); E.master.gain.setTargetAtTime(0, E.ctx.currentTime, quick ? 0.004 : 0.03); } catch (e) {}
      const c = E.ctx, s = E.src, lim = E.limiter;
      setTimeout(() => { try { s.disconnect(E.split); } catch (e) {} try { lim.disconnect(c.destination); } catch (e) {} }, quick ? 40 : 150);
    }
    E.on = false; if (!quick) warn(''); refreshUi();
  };

  // ── UI ──
  const fmt = (p, v) => (p.step >= 1 ? Math.round(v) : v.toFixed(1)) + (p.unit || '');
  const COLORS = { gate: '#94a3b8', comp: '#5aa9ff', od: '#4ade80', dist: '#f97316', amp: '#c084fc', eq: '#facc15', delay: '#22d3ee', reverb: '#f472b6' };
  const ang = (p, v) => -135 + 270 * (v - p.min) / (p.max - p.min);
  const knobHtml = (id, p, v) => `<div class="fx-kn"><div class="fx-knob" role="slider" tabindex="0" data-fx="${id}" data-k="${p.k}" aria-label="${p.label}" aria-valuemin="${p.min}" aria-valuemax="${p.max}" aria-valuenow="${v}" style="--a:${ang(p, v)}deg"><i></i></div><span class="fx-kl">${p.label}</span><span class="fx-kv">${fmt(p, v)}</span></div>`;
  const renderChain = () => {
    const host = q('fx-chain'); if (!host) return;
    host.innerHTML = st.order.map((id, i) => {
      const d = FX_DEFS[id], s = st.fx[id], ks = d.params.filter(p => !p.toggle).map(p => knobHtml(id, p, s.p[p.k])).join(''), tg = d.params.find(p => p.toggle);
      return `<div class="fx-mod ${s.on ? 'on' : ''}" data-id="${id}" style="--c:${COLORS[id]}"><div class="fx-top"><i class="fx-led"></i><b>${d.name}</b></div><div class="fx-knobs">${ks}</div>${id !== 'amp' ? '<div class="fx-extra"></div>' : `<div class="fx-extra"><button type="button" class="fx-chip ${s.p[tg.k] ? 'on' : ''}" data-fx="amp" data-k="cab">キャビ ${s.p[tg.k] ? 'ON' : 'OFF'}</button><button type="button" class="fx-chip" id="fx-ir">IR</button><input type="file" id="fx-ir-file" accept="audio/*,.wav" hidden></div>`}<button type="button" class="fx-foot-sw" data-fx="${id}" aria-pressed="${s.on}" aria-label="${d.name}のオン・オフ"><span></span></button><span class="fx-mv"><button type="button" class="fx-up" data-fx="${id}" aria-label="前へ" ${i === 0 ? 'disabled' : ''}>◀</button><button type="button" class="fx-dn" data-fx="${id}" aria-label="後ろへ" ${i === st.order.length - 1 ? 'disabled' : ''}>▶</button></span></div>`;
    }).join('');
  };
  const setParam = (id, k, v) => {
    st.fx[id].p[k] = v; if (E.fx[id]) E.fx[id].core.set(k, v); save();
    const p = FX_DEFS[id].params.find(x => x.k === k), kn = q('fx-chain').querySelector(`.fx-knob[data-fx="${id}"][data-k="${k}"]`);
    if (kn && !p.toggle) { kn.style.setProperty('--a', ang(p, v) + 'deg'); kn.setAttribute('aria-valuenow', v); kn.parentElement.querySelector('.fx-kv').textContent = fmt(p, v); }
  };
  const setOn = (id, on) => { st.fx[id].on = on; if (E.fx[id]) { if (on && (id === 'delay' || id === 'reverb')) rebuild(id); rewire(); } const m = q('fx-chain').querySelector(`.fx-mod[data-id="${id}"]`); if (m) { m.classList.toggle('on', on); m.querySelector('.fx-foot-sw').setAttribute('aria-pressed', String(on)); } save(); };
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
      const kn = e.target.closest('.fx-knob'); if (!kn) return; e.preventDefault(); kn.focus();
      const id = kn.dataset.fx, p = FX_DEFS[id].params.find(x => x.k === kn.dataset.k); drag = { kn, id, p, y: e.clientY, v: st.fx[id].p[p.k] }; kn.setPointerCapture(e.pointerId);
    });
    host.addEventListener('pointermove', e => {
      if (!drag) return; const { p } = drag, raw = drag.v + (drag.y - e.clientY) / (e.shiftKey ? 600 : 150) * (p.max - p.min);
      setParam(drag.id, p.k, Math.max(p.min, Math.min(p.max, Math.round(raw / p.step) * p.step)));
    });
    const end = () => { drag = null; }; host.addEventListener('pointerup', end); host.addEventListener('pointercancel', end);
    host.addEventListener('dblclick', e => { const kn = e.target.closest('.fx-knob'); if (!kn) return; const p = FX_DEFS[kn.dataset.fx].params.find(x => x.k === kn.dataset.k); setParam(kn.dataset.fx, p.k, p.def); });
    host.addEventListener('wheel', e => { const kn = e.target.closest('.fx-knob'); if (!kn || document.activeElement !== kn) return; e.preventDefault(); knobStep(kn, e.deltaY < 0 ? 1 : -1, true); }, { passive: false });
    host.addEventListener('keydown', e => { const kn = e.target.closest('.fx-knob'); if (!kn) return; const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key]; if (!dir) return; e.preventDefault(); knobStep(kn, dir, true); });
    host.addEventListener('click', e => {
      const b = e.target.closest('.fx-up, .fx-dn'); if (b) {
        const id = b.dataset.fx, i = st.order.indexOf(id), j = i + (b.classList.contains('fx-up') ? -1 : 1);
        if (j >= 0 && j < st.order.length) { [st.order[i], st.order[j]] = [st.order[j], st.order[i]]; save(); renderChain(); wire(); }
        return;
      }
      const sw = e.target.closest('.fx-foot-sw'); if (sw) { setOn(sw.dataset.fx, !st.fx[sw.dataset.fx].on); return; }
      const cab = e.target.closest('.fx-chip[data-k="cab"]'); if (cab) { const v = st.fx.amp.p.cab ? 0 : 1; setParam('amp', 'cab', v); cab.classList.toggle('on', !!v); cab.textContent = 'キャビ ' + (v ? 'ON' : 'OFF'); return; }
      if (e.target.id === 'fx-ir') q('fx-ir-file').click();
    });
    host.addEventListener('change', async e => {
      if (e.target.id !== 'fx-ir-file' || !e.target.files[0] || !E.ctx) return;
      try { const buf = await E.ctx.decodeAudioData(await e.target.files[0].arrayBuffer()); E.fx.amp.core.setIr(buf); q('fx-ir').textContent = 'IR ✓'; q('fx-ir').title = e.target.files[0].name; }
      catch (err) { warn('IRファイルを読み込めませんでした。', 'err'); }
    });
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
    detach() { if (E.on) stopMonitor(true); E.ctx = null; E.src = null; E.fx = {}; q('fx-confirm') && (q('fx-confirm').hidden = true); refreshUi(); },
    get monitoring() { return E.on; }
  };
}
export { BUILD as FX_BUILD, widener as fxWidener };
