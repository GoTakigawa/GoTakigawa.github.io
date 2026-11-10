// ── Export helpers: Standard MIDI File, fretboard image (PNG) / PDF, share-link encoding ──

const vlq = n => { const b = [n & 0x7f]; while ((n >>= 7) > 0) b.unshift((n & 0x7f) | 0x80); return b; };
const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const u16 = n => [(n >> 8) & 255, n & 255];
const ascii = s => Array.from(s).map(c => c.charCodeAt(0) & 127);

// notes: [{ tick, dur, midi, vel }] (480 ticks per quarter note). Returns Uint8Array of a format-1 file with a tempo track and one note track.
export function buildMidi({ bpm, beats, program, title, notes }) {
  const DIV = 480, tempo = Math.round(60000000 / bpm);
  const chunk = (id, data) => [...ascii(id), ...u32(data.length), ...data];
  const name = (s) => { const b = ascii(s || 'GTI'); return [0, 0xff, 0x03, ...vlq(b.length), ...b]; };
  const t0 = [...name(title || 'Fretboard Explorer'), 0, 0xff, 0x51, 0x03, (tempo >> 16) & 255, (tempo >> 8) & 255, tempo & 255, 0, 0xff, 0x58, 0x04, beats, 2, 24, 8, 0, 0xff, 0x2f, 0];
  const ev = [];
  notes.forEach(n => {
    const on = Math.max(0, Math.round(n.tick)), off = Math.max(on + 1, Math.round(n.tick + n.dur)), m = Math.max(0, Math.min(127, n.midi)), v = Math.max(1, Math.min(127, Math.round(n.vel * 100)));
    ev.push({ t: on, o: 1, d: [0x90, m, v] }, { t: off, o: 0, d: [0x80, m, 0] });
  });
  ev.sort((a, b) => a.t - b.t || a.o - b.o);
  const t1 = [...name('Notes'), 0, 0xc0, program & 127];
  let last = 0;
  ev.forEach(e => { t1.push(...vlq(e.t - last), ...e.d); last = e.t; });
  t1.push(0, 0xff, 0x2f, 0);
  return new Uint8Array([...chunk('MThd', [...u16(1), ...u16(2), ...u16(DIV)]), ...chunk('MTrk', t0), ...chunk('MTrk', t1)]);
}

export function download(blob, filename) {
  const a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}

// Draw the fretboard SVG on a canvas with a title line; returns the canvas.
export async function fretboardCanvas(svgEl, title, sub) {
  // the picture is drawn in the page's current theme: CSS variables are replaced by their values (a standalone SVG has no page CSS)
  const cs = getComputedStyle(document.documentElement), v = n => cs.getPropertyValue(n).trim();
  const vb = svgEl.viewBox.baseVal, w = Math.round(vb.width), h = Math.round(vb.height), S = 2, padX = 36, head = 96, foot = 44;
  // the clickable hit areas are transparent only through the page's CSS, so they must not go into the picture
  const clone = svgEl.cloneNode(true); clone.querySelectorAll('.fb-hit,.fb-glow').forEach(n => n.remove());
  const xml = new XMLSerializer().serializeToString(clone).replace(/color-mix\(in srgb, ?var\((--[\w-]+)\) (\d+)%, ?transparent\)/g, (m, n, p) => v(n)).replace(/var\((--[\w-]+)\)/g, (m, n) => v(n) || '#888');
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); });
  const c = document.createElement('canvas'); c.width = (w + padX * 2) * S; c.height = (h + head + foot) * S;
  const g = c.getContext('2d'); g.scale(S, S);
  g.fillStyle = v('--fb-bg') || '#0a0a0a'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = v('--text') || '#e8e8e8'; g.font = '700 30px Barlow, sans-serif'; g.textBaseline = 'alphabetic'; g.fillText(title, padX, 50);
  g.fillStyle = v('--text3') || '#8a8a8a'; g.font = '500 16px Barlow, sans-serif'; g.fillText(sub, padX, 78);
  g.drawImage(img, padX, head, w, h);
  g.fillStyle = v('--text3') || '#5a5a5a'; g.font = '600 13px Barlow, sans-serif'; g.textAlign = 'right'; g.fillText('GTI  Fretboard Explorer', w + padX, h + head + 28);
  return c;
}
export const canvasBlob = (c, type = 'image/png', q) => new Promise(r => c.toBlob(r, type, q));

// A single-page PDF holding the canvas as a JPEG (landscape, fitted to the image).
export async function pdfFromCanvas(c) {
  const jpg = new Uint8Array(await (await canvasBlob(c, 'image/jpeg', 0.92)).arrayBuffer());
  const W = 842, H = Math.round(W * c.height / c.width), enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const push = b => { const u = typeof b === 'string' ? enc.encode(b) : b; parts.push(u); len += u.length; };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
  obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  obj(2, () => push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'));
  obj(3, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`));
  obj(4, () => { push(`<< /Type /XObject /Subtype /Image /Width ${c.width} /Height ${c.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`); push(jpg); push('\nendstream'); });
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  obj(5, () => push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
  const xr = len;
  push(`xref\n0 6\n0000000000 65535 f \n` + [1, 2, 3, 4, 5].map(n => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF`);
  const out = new Uint8Array(len); let p = 0; parts.forEach(u => { out.set(u, p); p += u.length; });
  return new Blob([out], { type: 'application/pdf' });
}

// share link: JSON ⇄ URL-safe base64 (UTF-8)
export function encodeShare(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj)); let s = ''; bytes.forEach(b => s += String.fromCharCode(b));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeShare(str) {
  try {
    const b = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    const bytes = Uint8Array.from(b, ch => ch.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (e) { return null; }
}
