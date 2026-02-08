'use strict';

/**
 * Generate the HTML page for session replay.
 * Standalone page with play/pause/step controls.
 * Fetches timeline data from /api/timeline?sessionId=...
 */
function getReplayHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session Replay — Claude Agent Monitor</title>
<style>
${getReplayCSS()}
</style>
</head>
<body>
<div id="app">
  <header class="top-bar">
    <a href="/" class="back-link">&larr; Dashboard</a>
    <span class="logo">SESSION REPLAY</span>
    <span class="session-info" id="session-info"></span>
  </header>

  <div class="controls" id="controls">
    <button class="btn" id="btn-play" title="Play/Pause (Space)">&#x25B6; Play</button>
    <button class="btn" id="btn-prev" title="Previous (&larr;)">&larr; Prev</button>
    <button class="btn" id="btn-next" title="Next (&rarr;)">Next &rarr;</button>
    <span class="speed-control">
      <button class="btn btn-small" id="btn-slower" title="Slower (-)">-</button>
      <span id="speed-label">1x</span>
      <button class="btn btn-small" id="btn-faster" title="Faster (+)">+</button>
    </span>
    <span class="progress" id="progress">0 / 0</span>
  </div>

  <div class="timeline-container" id="timeline-container">
    <div class="empty-state" id="empty-state">
      <p>Select a session to replay</p>
      <p class="hint">Use URL parameter: /replay?sessionId=...</p>
    </div>
  </div>

  <div class="scrubber" id="scrubber">
    <input type="range" id="scrubber-range" min="0" max="0" value="0">
  </div>
</div>

<script>
${getReplayJS()}
</script>
</body>
</html>`;
}

function getReplayCSS() {
  return `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0d1117;
  --bg-card: #161b22;
  --border: #30363d;
  --text: #e6edf3;
  --text-dim: #8b949e;
  --text-muted: #484f58;
  --accent: #58a6ff;
  --green: #3fb950;
  --yellow: #d29922;
  --purple: #bc8cff;
  --cyan: #39d2c0;
  --orange: #db6d28;
  --red: #f85149;
  --bar-bg: #21262d;
  --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

#app { display: flex; flex-direction: column; min-height: 100vh; }

.top-bar {
  display: flex; align-items: center; gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-card);
}
.back-link { color: var(--accent); text-decoration: none; font-size: 0.85rem; }
.back-link:hover { text-decoration: underline; }
.logo { font-family: var(--font-mono); font-weight: 700; color: var(--cyan); font-size: 0.9rem; }
.session-info { font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-dim); margin-left: auto; }

.controls {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-card);
}
.btn {
  font-family: var(--font-mono); font-size: 0.8rem; padding: 6px 14px;
  border-radius: 6px; border: 1px solid var(--border);
  background: var(--bar-bg); color: var(--text-dim); cursor: pointer;
}
.btn:hover { background: var(--bg-card); color: var(--text); }
.btn:active { transform: scale(0.97); }
.btn-small { padding: 4px 8px; font-size: 0.75rem; }
.btn.active { background: var(--accent); color: var(--bg); border-color: var(--accent); }
.speed-control { display: flex; align-items: center; gap: 6px; font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-dim); }
.progress { font-family: var(--font-mono); font-size: 0.8rem; color: var(--text-muted); margin-left: auto; }

.timeline-container {
  flex: 1; padding: 20px; max-width: 900px; margin: 0 auto; width: 100%; overflow-y: auto;
}

.empty-state { text-align: center; padding: 60px 20px; color: var(--text-dim); }
.hint { font-size: 0.8rem; color: var(--text-muted); margin-top: 8px; }

.replay-entry {
  display: flex; gap: 12px; padding: 10px 12px; border-left: 3px solid var(--border);
  margin-left: 8px; margin-bottom: 2px; opacity: 0.3; transition: opacity 0.3s, border-color 0.3s;
}
.replay-entry.visible { opacity: 1; }
.replay-entry.current { border-left-color: var(--accent); background: rgba(88, 166, 255, 0.05); }

.replay-entry.type-tool { border-left-color: var(--green); }
.replay-entry.type-user_message { border-left-color: var(--purple); }
.replay-entry.type-assistant_message { border-left-color: var(--cyan); }

.replay-ts { font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-muted); min-width: 70px; white-space: nowrap; }
.replay-badge {
  font-family: var(--font-mono); font-size: 0.7rem; font-weight: 600;
  padding: 1px 6px; border-radius: 3px; white-space: nowrap;
}
.replay-badge.tool { background: #1a3a2a; color: var(--green); }
.replay-badge.user { background: #2a1a2a; color: var(--purple); }
.replay-badge.assistant { background: #1a2a3a; color: var(--cyan); }
.replay-content { font-size: 0.8rem; color: var(--text-dim); flex: 1; word-break: break-word; }

.scrubber { padding: 12px 20px; border-top: 1px solid var(--border); background: var(--bg-card); }
.scrubber input[type=range] { width: 100%; }
`;
}

function getReplayJS() {
  return `
'use strict';

const sessionInfo = document.getElementById('session-info');
const timelineContainer = document.getElementById('timeline-container');
const emptyState = document.getElementById('empty-state');
const progress = document.getElementById('progress');
const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnSlower = document.getElementById('btn-slower');
const btnFaster = document.getElementById('btn-faster');
const speedLabel = document.getElementById('speed-label');
const scrubberRange = document.getElementById('scrubber-range');

let timeline = [];
let currentIndex = -1;
let isPlaying = false;
let playTimer = null;
let speed = 1; // 1x, 2x, 4x, 0.5x

function formatTime(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString();
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderTimeline() {
  if (timeline.length === 0) {
    emptyState.style.display = '';
    return;
  }
  emptyState.style.display = 'none';

  // Render all entries (oldest first for replay)
  const sorted = [...timeline].reverse();
  const html = sorted.map((entry, i) => {
    const isVisible = i <= currentIndex;
    const isCurrent = i === currentIndex;
    const ts = entry.ts ? formatTime(entry.ts) : '';

    let badge = '';
    let content = '';
    let typeClass = 'type-' + entry.type;

    if (entry.type === 'tool') {
      badge = '<span class="replay-badge tool">' + esc(entry.toolName) + '</span>';
      content = esc(entry.toolSummary || entry.toolDetail || '');
      if (entry.toolResultBrief) {
        content += ' <span style="color:var(--text-muted)">&rarr; ' + esc(entry.toolResultBrief) + '</span>';
      }
    } else if (entry.type === 'user_message') {
      badge = '<span class="replay-badge user">User</span>';
      content = esc(entry.text || '');
    } else {
      badge = '<span class="replay-badge assistant">Assistant</span>';
      content = esc(entry.text || '');
    }

    return '<div class="replay-entry ' + typeClass +
      (isVisible ? ' visible' : '') +
      (isCurrent ? ' current' : '') +
      '" data-index="' + i + '">' +
      '<span class="replay-ts">' + ts + '</span>' +
      badge +
      '<span class="replay-content">' + content + '</span>' +
    '</div>';
  }).join('');

  timelineContainer.innerHTML = html;
  progress.textContent = (currentIndex + 1) + ' / ' + sorted.length;
  scrubberRange.max = sorted.length - 1;
  scrubberRange.value = currentIndex;

  // Scroll current into view
  const currentEl = timelineContainer.querySelector('.current');
  if (currentEl) currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function step(direction) {
  const maxIndex = timeline.length - 1;
  currentIndex = Math.max(-1, Math.min(maxIndex, currentIndex + direction));
  renderTimeline();
}

function togglePlay() {
  isPlaying = !isPlaying;
  btnPlay.innerHTML = isPlaying ? '&#x23F8; Pause' : '&#x25B6; Play';
  btnPlay.classList.toggle('active', isPlaying);

  if (isPlaying) {
    playNext();
  } else {
    clearTimeout(playTimer);
  }
}

function playNext() {
  if (!isPlaying) return;
  if (currentIndex >= timeline.length - 1) {
    isPlaying = false;
    btnPlay.innerHTML = '&#x25B6; Play';
    btnPlay.classList.remove('active');
    return;
  }
  step(1);
  // Calculate delay based on gap between events (capped at 3s)
  const sorted = [...timeline].reverse();
  let delay = 500;
  if (currentIndex < sorted.length - 1 && currentIndex >= 0) {
    const gap = Math.abs(sorted[currentIndex + 1].ts - sorted[currentIndex].ts);
    delay = Math.min(3000, Math.max(200, gap / speed));
  }
  playTimer = setTimeout(playNext, delay / speed);
}

// Load timeline
const params = new URLSearchParams(window.location.search);
const sessionId = params.get('sessionId');

if (sessionId) {
  sessionInfo.textContent = 'Loading...';
  fetch('/api/timeline?sessionId=' + encodeURIComponent(sessionId))
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        sessionInfo.textContent = 'Error: ' + data.error;
        return;
      }
      sessionInfo.textContent = data.session.name + ' (' + data.session.status + ')';
      timeline = data.timeline || [];
      scrubberRange.max = Math.max(0, timeline.length - 1);
      renderTimeline();
    })
    .catch(err => {
      sessionInfo.textContent = 'Failed to load timeline';
    });
}

// Controls
btnPlay.addEventListener('click', togglePlay);
btnPrev.addEventListener('click', () => step(-1));
btnNext.addEventListener('click', () => step(1));

btnSlower.addEventListener('click', () => {
  speed = Math.max(0.25, speed / 2);
  speedLabel.textContent = speed + 'x';
});
btnFaster.addEventListener('click', () => {
  speed = Math.min(8, speed * 2);
  speedLabel.textContent = speed + 'x';
});

scrubberRange.addEventListener('input', () => {
  currentIndex = parseInt(scrubberRange.value, 10);
  renderTimeline();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'ArrowLeft') { step(-1); }
  else if (e.key === 'ArrowRight') { step(1); }
  else if (e.key === '+' || e.key === '=') { speed = Math.min(8, speed * 2); speedLabel.textContent = speed + 'x'; }
  else if (e.key === '-') { speed = Math.max(0.25, speed / 2); speedLabel.textContent = speed + 'x'; }
});
`;
}

module.exports = { getReplayHtml };
