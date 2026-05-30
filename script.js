const API_BASE = 'https://web-production-241e7.up.railway.app';

let currentUrl = '';
let progressTimer = null;
let currentPct = 0;

const $ = id => document.getElementById(id);
const urlInput   = $('url-input');
const btnFetch   = $('btn-fetch');
const btnDl      = $('btn-download');
const alertEl    = $('alert');
const previewEl  = $('preview');
const progressEl = $('progress-wrap');

urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') fetchInfo(); });
urlInput.addEventListener('input', () => {
  hide(alertEl); hide(previewEl); hide(btnDl); hide(progressEl);
});

function show(el) { el.style.display = 'block'; }
function hide(el) { el.style.display = 'none'; }
function showAlert(msg) { alertEl.textContent = msg; show(alertEl); }
function setBtn(el, html, disabled = false) { el.innerHTML = html; el.disabled = disabled; }

function isYouTubeUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?.*v=|youtu\.be\/)[\w-]+/.test(url);
}

function extractVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function fetchInfo() {
  currentUrl = urlInput.value.trim();
  if (!currentUrl) { showAlert('Pega un URL de YouTube primero.'); return; }
  if (!isYouTubeUrl(currentUrl)) { showAlert('URL no válido de YouTube.'); return; }

  hide(alertEl); hide(previewEl); hide(btnDl); hide(progressEl);
  setBtn(btnFetch, '<span class="spin"></span>', true);

  try {
    const res = await fetch(`${API_BASE}/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentUrl })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener info.');

    const vidId = extractVideoId(currentUrl);
    $('thumb').src = vidId
      ? `https://img.youtube.com/vi/${vidId}/mqdefault.jpg`
      : data.thumbnail;
    $('song-title').textContent = data.title;
    $('song-sub').textContent   = data.uploader;

    show(previewEl);
    show(btnDl);
  } catch (err) {
    showAlert(err.message);
  } finally {
    setBtn(btnFetch, 'Buscar', false);
  }
}

async function startDownload() {
  if (!currentUrl) return;
  hide(alertEl);
  setBtn(btnDl, '<span class="spin"></span> Procesando...', true);
  show(progressEl);
  animateBar();

  try {
    const res = await fetch(`${API_BASE}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: currentUrl })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Error al descargar.');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const nameMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)/i);
    const fileName = nameMatch ? decodeURIComponent(nameMatch[1]) : 'audio.mp3';

    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    finishBar();
  } catch (err) {
    stopBar();
    showAlert('Error: ' + err.message);
  } finally {
    setBtn(btnDl, '⬇ Descargar MP3', false);
  }
}

function triggerDownload(url, title) {
  const a = document.createElement('a');
  a.href = url; a.download = title + '.mp3'; a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove();
}

function animateBar() {
  currentPct = 0;
  setProgress(0, 'Conectando...');
  progressTimer = setInterval(() => {
    const step = currentPct < 40 ? 4 : currentPct < 70 ? 2 : currentPct < 88 ? 0.8 : 0.15;
    currentPct = Math.min(currentPct + step, 90);
    setProgress(currentPct, currentPct < 50 ? 'Procesando audio...' : 'Preparando descarga...');
  }, 350);
}

function setProgress(pct, label) {
  $('bar-fill').style.width   = Math.round(pct) + '%';
  $('prog-pct').textContent   = Math.round(pct) + '%';
  $('prog-label').textContent = label;
}

function finishBar() {
  clearInterval(progressTimer);
  setProgress(100, '¡Listo!');
  setTimeout(() => hide(progressEl), 3000);
}

function stopBar() {
  clearInterval(progressTimer);
  hide(progressEl);
}
