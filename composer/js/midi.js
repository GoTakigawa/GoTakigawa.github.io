// ── Standard MIDI File writer (Format 1) ──
const PPQ = 480;
const vlq = v => { const b = [v & 0x7f]; while ((v >>= 7) > 0) b.unshift((v & 0x7f) | 0x80); return b; };
const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = n => [(n >>> 8) & 255, n & 255];
const ascii = s => [...s].map(c => c.charCodeAt(0) & 0x7f);

function track(name, events, endTick) {
  // events: {t, bytes, order} ; note-offs (order 0) before note-ons (order 1) at the same tick
  const ev = [{ t: 0, order: -1, bytes: [0xff, 0x03, ...vlq(name.length), ...ascii(name)] }, ...events]
    .sort((a, b) => a.t - b.t || a.order - b.order);
  const out = []; let last = 0;
  ev.forEach(e => { out.push(...vlq(Math.max(0, e.t - last)), ...e.bytes); last = Math.max(last, e.t); });
  out.push(...vlq(Math.max(0, endTick - last)), 0xff, 0x2f, 0x00);
  return [...ascii('MTrk'), ...u32(out.length), ...out];
}

function noteEvents(list, ch) {
  const ev = [];
  list.forEach(({ t, dur, notes, vel }) => notes.forEach(n => {
    if (n < 0 || n > 127) return;
    ev.push({ t, order: 1, bytes: [0x90 | ch, n, vel] });
    ev.push({ t: t + Math.max(1, dur), order: 0, bytes: [0x80 | ch, n, 0] });
  }));
  return ev;
}

// timeline: { bpm, num, den, totalSteps, pad:[{step,len,notes}], riff:[{step,len,notes,vel}] }
export function buildMidi(tl) {
  const stepTicks = PPQ / 4; // 16th note
  const end = tl.totalSteps * stepTicks;
  const tempo = Math.round(60000000 / tl.bpm);
  const denPow = Math.round(Math.log2(tl.den));
  const conductor = [
    { t: 0, order: 0, bytes: [0xff, 0x51, 3, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255] },
    { t: 0, order: 0, bytes: [0xff, 0x58, 4, tl.num, denPow, 24, 8] }
  ];
  const conv = (arr, vel) => arr.map(e => ({ t: e.step * stepTicks, dur: Math.round(e.len * stepTicks), notes: e.notes, vel: e.vel || vel }));
  const tracks = [
    track('Tempo', conductor, end),
    track('Chords', [{ t: 0, order: 0, bytes: [0xc0, 0] }, ...noteEvents(conv(tl.pad, 64), 0)], end),
    track('Riff', [{ t: 0, order: 0, bytes: [0xc1, 0] }, ...noteEvents(conv(tl.riff, 100), 1)], end)
  ];
  if (tl.lead && tl.lead.length) tracks.push(track('Lead', [{ t: 0, order: 0, bytes: [0xc2, 0] }, ...noteEvents(conv(tl.lead, 100), 2)], end));
  const head = [...ascii('MThd'), ...u32(6), ...u16(1), ...u16(tracks.length), ...u16(PPQ)];
  return new Uint8Array([...head, ...tracks.flat()]);
}
