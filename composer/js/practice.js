// ── Practice: YouTube embed + A-B loop + speed trainer ──
// Transcriptions/markers stay in this browser only (localStorage), nothing is distributed.
const STORE = 'gti-composer:practice';
let player = null, apiPromise = null, timer = null;
const st = { a: null, b: null, loop: false, trainer: false, loops: 0, perStep: 3, rates: [1] };

export function parseVideoId(text) {
  const s = String(text || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1, 12);
    if (u.searchParams.get('v')) return u.searchParams.get('v').slice(0, 11);
    const m = u.pathname.match(/\/(embed|shorts|live)\/([A-Za-z0-9_-]{11})/);
    if (m) return m[2];
  } catch (e) {}
  return null;
}

function loadApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { apiPromise = null; reject(new Error('YouTube を読み込めませんでした。')); };
    document.head.appendChild(s);
  });
  return apiPromise;
}

const fmt = t => t == null ? '--:--.-' : `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;

export function mountPractice(root, notify) {
  const $ = sel => root.querySelector(sel);
  let saved = {}; try { saved = JSON.parse(localStorage.getItem(STORE) || '{}'); } catch (e) {}
  if (saved.url) $('#yt-url').value = saved.url;
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify({ url: $('#yt-url').value, a: st.a, b: st.b })); } catch (e) {} };

  function render() {
    $('#ab-a').textContent = 'A ' + fmt(st.a);
    $('#ab-b').textContent = 'B ' + fmt(st.b);
    $('#ab-loop').classList.toggle('on', st.loop);
    $('#ab-loop').textContent = st.loop ? '⟲ ループ中' : '⟲ A-B ループ';
    $('#trainer-btn').classList.toggle('on', st.trainer);
    $('#trainer-btn').textContent = st.trainer ? '■ トレーナー停止' : '▶ スピードトレーナー';
    const r = player && player.getPlaybackRate ? player.getPlaybackRate() : 1;
    $('#rate-now').textContent = Math.round(r * 100) + '%';
  }

  function fillRates() {
    st.rates = (player.getAvailablePlaybackRates && player.getAvailablePlaybackRates()) || [1];
    $('#yt-rate').innerHTML = st.rates.map(r => `<option value="${r}" ${r === 1 ? 'selected' : ''}>${Math.round(r * 100)}%</option>`).join('');
    $('#rate-note').textContent = '選べる速度：' + st.rates.map(r => Math.round(r * 100) + '%').join(' / ') + '（YouTube 側で決まる刻みです）';
  }

  function tick() {
    if (!player || !player.getCurrentTime) return;
    const t = player.getCurrentTime();
    $('#yt-time').textContent = fmt(t);
    if (st.loop && st.a != null && st.b != null && st.b > st.a && t >= st.b) {
      player.seekTo(st.a, true);
      if (st.trainer) {
        st.loops++;
        if (st.loops >= st.perStep) {
          st.loops = 0;
          const cur = player.getPlaybackRate(), next = st.rates.find(r => r > cur + 1e-6 && r <= 1);
          if (next) { player.setPlaybackRate(next); notify('速度を ' + Math.round(next * 100) + '% に上げました'); }
          else { st.trainer = false; notify('100% に到達しました'); }
        }
      }
      render();
    }
  }

  $('#yt-load').addEventListener('click', async () => {
    const id = parseVideoId($('#yt-url').value);
    if (!id) { notify('YouTube の URL を確認してください'); return; }
    save();
    try { await loadApi(); } catch (e) { notify(e.message); return; }
    if (player) { player.loadVideoById(id); return; }
    player = new YT.Player('yt-player', {
      videoId: id, playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
      events: { onReady: () => { fillRates(); if (saved.a != null && saved.url === $('#yt-url').value) { st.a = saved.a; st.b = saved.b; } render(); clearInterval(timer); timer = setInterval(tick, 50); },
                onPlaybackRateChange: render }
    });
  });
  $('#ab-a').addEventListener('click', () => { if (!player) return; st.a = player.getCurrentTime(); if (st.b != null && st.b <= st.a) st.b = null; save(); render(); });
  $('#ab-b').addEventListener('click', () => { if (!player) return; const t = player.getCurrentTime(); if (st.a != null && t <= st.a) { notify('B は A より後ろに置いてください'); return; } st.b = t; save(); render(); });
  $('#ab-loop').addEventListener('click', () => { if (st.a == null || st.b == null) { notify('先に A と B を決めてください'); return; } st.loop = !st.loop; if (st.loop && player) player.seekTo(st.a, true); render(); });
  $('#ab-clear').addEventListener('click', () => { st.a = st.b = null; st.loop = st.trainer = false; save(); render(); });
  $('#yt-rate').addEventListener('change', e => { if (player) player.setPlaybackRate(parseFloat(e.target.value)); });
  $('#trainer-steps').addEventListener('change', e => { st.perStep = Math.max(1, parseInt(e.target.value) || 3); });
  $('#trainer-btn').addEventListener('click', () => {
    if (!player) return;
    if (st.trainer) { st.trainer = false; render(); return; }
    if (st.a == null || st.b == null) { notify('先に A と B を決めてください'); return; }
    const start = st.rates.find(r => r >= 0.5 && r < 1) || 1;
    player.setPlaybackRate(start); st.loops = 0; st.loop = true; st.trainer = true;
    player.seekTo(st.a, true); player.playVideo(); render();
  });
  render();
}
