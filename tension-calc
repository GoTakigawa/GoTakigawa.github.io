/**

- tension-calc.js
- Formula: T_lb = UW * (2 * L * f)^2 / 386.4
  */

const UW_PLAIN = [
{ gauge: 0.009, uw: 0.00001791 },
{ gauge: 0.010, uw: 0.00002215 },
{ gauge: 0.011, uw: 0.00002680 },
{ gauge: 0.013, uw: 0.00003752 },
{ gauge: 0.016, uw: 0.00005685 },
{ gauge: 0.017, uw: 0.00006419 },
{ gauge: 0.018, uw: 0.00007178 },
];

const UW_WOUND = [
{ gauge: 0.024, uw: 0.00010818 },
{ gauge: 0.025, uw: 0.00011861 },
{ gauge: 0.026, uw: 0.00012679 },
{ gauge: 0.032, uw: 0.00019038 },
{ gauge: 0.035, uw: 0.00022514 },
{ gauge: 0.036, uw: 0.00023327 },
{ gauge: 0.042, uw: 0.00031499 },
{ gauge: 0.045, uw: 0.00036979 },
{ gauge: 0.046, uw: 0.00036968 },
{ gauge: 0.054, uw: 0.00051834 },
{ gauge: 0.059, uw: 0.00061967 },
{ gauge: 0.065, uw: 0.00075030 },
{ gauge: 0.080, uw: 0.00110774 },
{ gauge: 0.085, uw: 0.00125139 },
{ gauge: 0.100, uw: 0.00170826 },
{ gauge: 0.105, uw: 0.00187564 },
{ gauge: 0.135, uw: 0.00306912 },
];

const NOTE_NAMES = [‘C’,‘C#’,‘D’,‘D#’,‘E’,‘F’,‘F#’,‘G’,‘G#’,‘A’,‘A#’,‘B’];

function noteToFreq(noteStr) {
const str = noteStr.trim().toUpperCase()
.replace(‘BB’,‘A#’).replace(‘EB’,‘D#’)
.replace(‘AB’,‘G#’).replace(‘DB’,‘C#’).replace(‘GB’,‘F#’);
const m = str.match(/^([A-G]#?)(-?\d)$/);
if (!m) return null;
const idx = NOTE_NAMES.indexOf(m[1]);
if (idx < 0) return null;
const midi = (parseInt(m[2], 10) + 1) * 12 + idx;
return 440 * Math.pow(2, (midi - 69) / 12);
}

function interpolateUW(gauge, table) {
if (gauge <= table[0].gauge) return table[0].uw;
if (gauge >= table[table.length - 1].gauge) return table[table.length - 1].uw;
for (let i = 0; i < table.length - 1; i++) {
const lo = table[i], hi = table[i + 1];
if (gauge >= lo.gauge && gauge <= hi.gauge) {
const t = (gauge - lo.gauge) / (hi.gauge - lo.gauge);
return lo.uw + t * (hi.uw - lo.uw);
}
}
return null;
}

function calcTension(gaugeInch, type, freq, scaleLenInch) {
const f = typeof freq === ‘string’ ? noteToFreq(freq) : freq;
if (!f || f <= 0) return null;
const table = type === ‘plain’ ? UW_PLAIN : UW_WOUND;
const uw = interpolateUW(gaugeInch, table);
if (!uw) return null;
const T_lb = uw * Math.pow(2 * scaleLenInch * f, 2) / 386.4;
const T_kg = T_lb / 2.20462;
return {
lb:   Math.round(T_lb * 10) / 10,
kg:   Math.round(T_kg * 100) / 100,
uw, freq: Math.round(f * 100) / 100,
};
}

function calcSet(strings) {
return strings.map((s, i) => ({
string: i + 1, gauge: s.gauge, type: s.type, note: s.note, scale: s.scale,
…calcTension(s.gauge, s.type, s.note, s.scale),
}));
}

function totalTension(setResult) {
return {
lb: Math.round(setResult.reduce((a, s) => a + (s.lb || 0), 0) * 10) / 10,
kg: Math.round(setResult.reduce((a, s) => a + (s.kg || 0), 0) * 100) / 100,
};
}

module.exports = { calcTension, calcSet, totalTension, noteToFreq, UW_PLAIN, UW_WOUND };