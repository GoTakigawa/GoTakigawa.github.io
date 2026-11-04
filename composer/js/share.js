// ── Seed: song state → deflate → base64url (generator-style seed string) ──
const b64u = bytes => { let s = ''; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = str => Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

async function pipe(bytes, stream) {
  const res = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function encodeSeed(song) {
  const json = new TextEncoder().encode(JSON.stringify(song));
  if (typeof CompressionStream !== 'undefined') {
    try { return 'z' + b64u(await pipe(json, new CompressionStream('deflate-raw'))); } catch (e) {}
  }
  return 'j' + b64u(json);
}

export async function decodeSeed(seed) {
  seed = String(seed || '').trim();
  if (!/^[zj][A-Za-z0-9_-]+$/.test(seed) || seed.length > 8000) throw new Error('シードの形式が正しくありません。');
  let bytes = unb64u(seed.slice(1));
  if (seed[0] === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('このブラウザは圧縮シードに対応していません。');
    bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
