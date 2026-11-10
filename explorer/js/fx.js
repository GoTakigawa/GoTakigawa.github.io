// Effects for monitoring the guitar input: comp / overdrive / distortion / amp sim / EQ / delay / reverb.
// The pitch detection always listens to the dry input; the effects only feed the monitor output, which is OFF by default.
// A howl guard watches the output while monitoring and stops it when a tone starts to run away.
const KEY = 'gti-explorer:fx';
const ACK = 'gti-explorer:fx-ack';

export const FX_DEFS = {
  comp: { name: 'コンプ', params: [
    { k: 'thr', label: 'スレッショルド', min: -60, max: 0, step: 1, def: -24, unit: 'dB' },
    { k: 'ratio', label: 'レシオ', min: 1, max: 20, step: 0.5, def: 4, unit: ':1' },
    { k: 'att', label: 'アタック', min: 1, max: 100, step: 1, def: 10, unit: 'ms' },
    { k: 'rel', label: 'リリース', min: 50, max: 1000, step: 10, def: 250, unit: 'ms' },
    { k: 'gain', label: 'メイクアップ', min: 0, max: 24, step: 0.5, def: 6, unit: 'dB' }] },
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
    { k: 'level', label: 'レベル', min: -18, max: 12, step: 0.5, def: -3, unit: 'dB' }] },
  eq: { name: 'EQ', params: [
    { k: 'low', label: '低域 100Hz', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' },
    { k: 'lmid', label: '中低域 400Hz', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' },
    { k: 'hmid', label: '中高域 2kHz', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' },
    { k: 'high', label: '高域 6kHz', min: -12, max: 12, step: 0.5, def: 0, unit: 'dB' }] },
  delay: { name: 'ディレイ', params: [
    { k: 'time', label: 'タイム', min: 50, max: 1000, step: 10, def: 350, unit: 'ms' },
    { k: 'fb', label: 'フィードバック', min: 0, max: 85, step: 1, def: 35, unit: '%' },
    { k: 'mix', label: 'ミックス', min: 0, max: 100, step: 1, def: 30, unit: '%' }] },
  reverb: { name: 'リバーブ', params: [
    { k: 'decay', label: '長さ', min: 0.3, max: 6, step: 0.1, def: 2, unit: '秒' },
    { k: 'damp', label: 'ダンピング', min: 0, max: 100, step: 1, def: 50, unit: '' },
    { k: 'mix', label: 'ミックス', min: 0, max: 100, step: 1, def: 25, unit: '%' }] }
};
const ORDER = ['comp', 'od', 'dist', 'amp', 'eq', 'delay', 'reverb'];
const defState = () => ({ order: ORDER.slice(), master: 0.5, out: '', fx: Object.fromEntries(ORDER.map(id => [id, { on: false, p: Object.fromEntries(FX_DEFS[id].params.map(p => [p.k, p.def])) }])) });
function load() {
  const s = defState();
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!o) return s;
    if (Array.isArray(o.order)) { const ord = o.order.filter(id => ORDER.includes(id)); ORDER.forEach(id => { if (!ord.includes(id)) ord.push(id); }); s.order = ord; }
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
const shaper = (ctx, k) => { const s = ctx.createWaveShaper(); s.curve = tanhCurve(k); s.oversample = '4x'; return s; };

// a decaying stereo noise tail for the reverb; damp 0..100 darkens it along the tail
function reverbIr(ctx, sec, damp) {
  const sr = ctx.sampleRate, len = Math.max(1, Math.floor(sr * sec)), buf = ctx.createBuffer(2, len, sr), a = 0.15 + 0.8 * (1 - damp / 100);
  for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let y = 0; for (let i = 0; i < len; i++) { const t = i / len, aa = Math.max(0.04, a * (1 - 0.6 * t)); y += aa * ((Math.random() * 2 - 1) - y); d[i] = y * Math.exp(-6.5 * t) * (i < 200 ? i / 200 : 1); } }
  return buf;
}

// each builder returns the effect core { in, out, set(k, v) }; the wrapper adds an on/off (bypass) around it
const BUILD = {
  comp(ctx) {
    const c = ctx.createDynamicsCompressor(), g = ctx.createGain(); c.knee.value = 12; c.connect(g);
    return { in: c, out: g, set(k, v) { if (k === 'thr') tc(c.threshold, v, ctx); else if (k === 'ratio') tc(c.ratio, v, ctx); else if (k === 'att') tc(c.attack, v / 1000, ctx); else if (k === 'rel') tc(c.release, v / 1000, ctx); else if (k === 'gain') tc(g.gain, dbLin(v), ctx); } };
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
    const route = () => { tc(cabOff.gain, cab ? 0 : 1, ctx); tc(cabBiq.gain, cab && !hasIr ? 1 : 0, ctx); tc(cabConv.gain, cab && hasIr ? 1 : 0, ctx); };
    route();
    return {
      in: hp, out: level,
      set(k, v) { if (k === 'gain') tc(pre.gain, 2 + Math.pow(v / 100, 1.6) * 38, ctx); else if (k === 'bass') tc(bass.gain, v, ctx); else if (k === 'mid') tc(mid.gain, v, ctx); else if (k === 'treble') tc(tre.gain, v, ctx); else if (k === 'cab') { cab = v ? 1 : 0; route(); } else if (k === 'level') tc(level.gain, dbLin(v), ctx); },
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
    inn.connect(dry); dry.connect(out); inn.connect(conv); conv.connect(wet); wet.connect(out);
    const regen = () => { clearTimeout(tm); tm = setTimeout(() => { try { conv.buffer = reverbIr(ctx, decay, damp); } catch (e) {} }, 120); };
    conv.buffer = reverbIr(ctx, decay, damp);
    return { in: inn, out, set(k, v) { if (k === 'decay') { decay = v; regen(); } else if (k === 'damp') { damp = v; regen(); } else if (k === 'mix') { tc(wet.gain, v / 100 * 0.8, ctx); tc(dry.gain, 1 - 0.4 * v / 100, ctx); } } };
  }
};

export function initFx({ ensureInput } = {}) {
  const st = load(), q = id => document.getElementById(id);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };
  const E = { ctx: null, src: null, fx: {}, fxIn: null, master: null, limiter: null, outAn: null, inAn: null, on: false, timer: 0, hist: [], loud: 0 };
  const warn = (t, cls = '') => { const w = q('fx-note'); if (!w) return; w.textContent = t || ''; w.className = 'fx-note hint ' + cls; w.hidden = !t; };

  // ── graph (built per audio context; the monitor connects it to the output) ──
  const build = (ctx, src) => {
    E.ctx = ctx; E.src = src; E.fx = {};
    E.fxIn = ctx.createGain(); E.master = ctx.createGain(); E.master.gain.value = 0;
    E.limiter = ctx.createDynamicsCompressor(); E.limiter.threshold.value = -8; E.limiter.knee.value = 0; E.limiter.ratio.value = 20; E.limiter.attack.value = 0.003; E.limiter.release.value = 0.1;
    E.outAn = ctx.createAnalyser(); E.outAn.fftSize = 4096; E.outAn.smoothingTimeConstant = 0;
    ORDER.forEach(id => {
      const core = BUILD[id](ctx), inn = ctx.createGain(), out = ctx.createGain(), dry = ctx.createGain(), wet = ctx.createGain();
      inn.connect(dry); dry.connect(out); inn.connect(core.in); core.out.connect(wet); wet.connect(out);
      const e = { core, inn, out, dry, wet, setOn(on) { dry.gain.setTargetAtTime(on ? 0 : 1, ctx.currentTime, 0.02); wet.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.02); } };
      E.fx[id] = e; FX_DEFS[id].params.forEach(p => core.set(p.k, st.fx[id].p[p.k])); e.setOn(st.fx[id].on);
    });
    wire();
    E.master.connect(E.limiter); E.limiter.connect(E.outAn);   // the output analyser sits after the limiter
    E.inAn = null;
  };
  const wire = () => {
    if (!E.ctx) return;
    E.fxIn.disconnect(); ORDER.forEach(id => E.fx[id].out.disconnect());
    let prev = E.fxIn; st.order.forEach(id => { prev.connect(E.fx[id].inn); prev = E.fx[id].out; }); prev.connect(E.master);
  };
  const setMaster = (ramp = 0.03) => { if (E.master && E.on) E.master.gain.setTargetAtTime(Math.pow(st.master, 2) * 1.2, E.ctx.currentTime, ramp); };

  // ── howl guard: a tone that is stable in pitch, much stronger than the rest and still growing -> mute at once ──
  const guard = () => {
    if (!E.on || !E.outAn) return;
    const an = E.outAn, db = E.guardDb || (E.guardDb = new Float32Array(an.frequencyBinCount)), td = E.guardTd || (E.guardTd = new Float32Array(an.fftSize));
    an.getFloatFrequencyData(db); an.getFloatTimeDomainData(td);
    let pk = 0, pi = 0, sum = 0, n = 0, rmsv = 0; for (let i = 0; i < td.length; i++) rmsv += td[i] * td[i]; rmsv = Math.sqrt(rmsv / td.length);
    const lo = Math.floor(80 / (E.ctx.sampleRate / an.fftSize)), hi = Math.floor(6000 / (E.ctx.sampleRate / an.fftSize));
    pk = -200; for (let i = lo; i < hi; i++) { sum += db[i]; n++; if (db[i] > pk) { pk = db[i]; pi = i; } }
    const dom = pk - sum / Math.max(1, n);
    E.hist.push({ pk, pi, dom, rms: rmsv }); if (E.hist.length > 8) E.hist.shift();
    let bad = false;
    if (E.hist.length >= 8) {
      const a = E.hist[0], b = E.hist[E.hist.length - 1], stable = E.hist.every(h => Math.abs(h.pi - b.pi) <= 2), tonal = E.hist.every(h => h.dom > 30), grow = b.pk - a.pk > 8 && b.rms > a.rms * 1.8 && b.rms > 0.02;
      if (stable && tonal && grow) bad = true;
    }
    E.loud = rmsv > 0.3 && dom > 28 ? E.loud + 1 : 0;       // loud and tonal for ~0.7 s
    if (bad || E.loud >= 7) howl();
  };
  const howl = () => { stopMonitor(true); warn('ハウリングの可能性があったため、モニターを止めました。ヘッドホンを使うか、音量を下げてからもう一度お試しください。', 'err'); };

  const refreshUi = () => {
    const b = q('fx-monitor'); if (!b) return;
    b.classList.toggle('on', E.on); b.setAttribute('aria-pressed', String(E.on)); q('fx-monitor-label').textContent = E.on ? 'モニターを止める' : 'モニターを始める';
    q('fx-state').textContent = E.on ? 'モニター中（ヘッドホン推奨）' : '出力しない（入力のみ）'; q('fx-state').classList.toggle('on', E.on);
    const lat = q('fx-lat'); if (lat) lat.textContent = E.on && E.ctx ? `遅延 約 ${Math.round(((E.ctx.baseLatency || 0) + (E.ctx.outputLatency || 0)) * 1000)} ms` : '';
  };
  const startMonitor = () => {
    if (E.on || !E.ctx) return;
    E.on = true; E.hist = []; E.loud = 0; E.master.gain.value = 0;
    E.limiter.connect(E.ctx.destination); E.src.connect(E.fxIn);
    setMaster(0.15); clearInterval(E.timer); E.timer = setInterval(guard, 100);
    warn('モニター中です。スピーカーから出すと音が回り込んでハウリングすることがあります。ヘッドホンをお使いください。');
    refreshUi();
  };
  const stopMonitor = (quick) => {
    if (!E.ctx) { E.on = false; refreshUi(); return; }
    clearInterval(E.timer); E.timer = 0;
    if (E.on) {
      try { E.master.gain.cancelScheduledValues(E.ctx.currentTime); E.master.gain.setTargetAtTime(0, E.ctx.currentTime, quick ? 0.004 : 0.03); } catch (e) {}
      const c = E.ctx, s = E.src, lim = E.limiter;
      setTimeout(() => { try { s.disconnect(E.fxIn); } catch (e) {} try { lim.disconnect(c.destination); } catch (e) {} }, quick ? 40 : 150);
    }
    E.on = false; if (!quick) warn(''); refreshUi();
  };

  // ── UI ──
  const fmt = (p, v) => (Number.isInteger(p.step) || p.step >= 1 ? Math.round(v) : v.toFixed(1)) + (p.unit || '');
  const renderChain = () => {
    const host = q('fx-chain'); if (!host) return;
    host.innerHTML = st.order.map((id, i) => {
      const d = FX_DEFS[id], s = st.fx[id];
      const ps = d.params.map(p => p.toggle
        ? `<label class="fx-p fx-tg"><span>${p.label}</span><input type="checkbox" data-fx="${id}" data-k="${p.k}" ${s.p[p.k] ? 'checked' : ''}></label>`
        : `<label class="fx-p"><span>${p.label}</span><input type="range" data-fx="${id}" data-k="${p.k}" min="${p.min}" max="${p.max}" step="${p.step}" value="${s.p[p.k]}"><output>${fmt(p, s.p[p.k])}</output></label>`).join('');
      return `<div class="fx-mod ${s.on ? 'on' : ''}" data-id="${id}"><div class="fx-hd"><label class="toggle-switch"><input type="checkbox" class="fx-on" data-fx="${id}" ${s.on ? 'checked' : ''} aria-label="${d.name}のオン・オフ"><span class="toggle-slider"></span></label><b>${d.name}</b><span class="fx-mv"><button type="button" class="fx-up" data-fx="${id}" aria-label="前へ" ${i === 0 ? 'disabled' : ''}>◀</button><button type="button" class="fx-dn" data-fx="${id}" aria-label="後ろへ" ${i === st.order.length - 1 ? 'disabled' : ''}>▶</button></span>${id === 'amp' ? '<button type="button" class="th-link" id="fx-ir">IR</button><input type="file" id="fx-ir-file" accept="audio/*,.wav" hidden>' : ''}</div><div class="fx-ps">${ps}</div></div>`;
    }).join('');
  };
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
    host.addEventListener('input', e => {
      const t = e.target, id = t.dataset.fx, k = t.dataset.k; if (!id || !k) return;
      const p = FX_DEFS[id].params.find(x => x.k === k), v = t.type === 'checkbox' ? (t.checked ? 1 : 0) : +t.value;
      st.fx[id].p[k] = v; if (E.fx[id]) E.fx[id].core.set(k, v);
      if (t.type === 'range') t.nextElementSibling.textContent = fmt(p, v);
      save();
    });
    host.addEventListener('change', e => {
      const t = e.target; if (!t.classList.contains('fx-on')) return; const id = t.dataset.fx;
      st.fx[id].on = t.checked; if (E.fx[id]) E.fx[id].setOn(t.checked); t.closest('.fx-mod').classList.toggle('on', t.checked); save();
    });
    host.addEventListener('click', e => {
      const b = e.target.closest('.fx-up, .fx-dn'); if (b) {
        const id = b.dataset.fx, i = st.order.indexOf(id), j = i + (b.classList.contains('fx-up') ? -1 : 1);
        if (j >= 0 && j < st.order.length) { [st.order[i], st.order[j]] = [st.order[j], st.order[i]]; save(); renderChain(); wire(); }
        return;
      }
      if (e.target.id === 'fx-ir') q('fx-ir-file').click();
    });
    host.addEventListener('change', async e => {
      if (e.target.id !== 'fx-ir-file' || !e.target.files[0] || !E.ctx) return;
      try { const buf = await E.ctx.decodeAudioData(await e.target.files[0].arrayBuffer()); E.fx.amp.core.setIr(buf); q('fx-ir').textContent = 'IR：' + e.target.files[0].name.slice(0, 18); }
      catch (err) { warn('IRファイルを読み込めませんでした。', 'err'); }
    });
    q('fx-out').addEventListener('change', e => { st.out = e.target.value; save(); applySink(); });
    q('fx-reset').addEventListener('click', () => { const d = defState(); st.order = d.order; st.fx = d.fx; save(); renderChain(); if (E.ctx) { ORDER.forEach(id => { FX_DEFS[id].params.forEach(p => E.fx[id].core.set(p.k, st.fx[id].p[p.k])); E.fx[id].setOn(false); }); wire(); } });
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
