'use strict';

/**
 * Generate the full HTML page for the web dashboard.
 * All CSS and JS are inlined — zero external resource requests.
 */
function getHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Claude Agent Monitor</title>
<style>
${getCSS()}
</style>
</head>
<body>
<div id="app">
  <header class="top-bar">
    <div class="top-bar-left">
      <span class="logo">CLAUDE AGENT MONITOR</span>
      <span class="badge" id="active-count">0 active</span>
    </div>
    <div class="top-bar-right">
      <button class="btn btn-clear" id="btn-clear" title="Clear ended sessions">Clear Ended</button>
      <span class="connection-dot" id="connection-dot" title="SSE connection status"></span>
    </div>
  </header>

  <main id="sessions-container">
    <div class="empty-state" id="empty-state">
      <div class="empty-icon">&#x1F50D;</div>
      <p>No active agent sessions</p>
      <p class="empty-hint">Start a Claude Code agent to see it here</p>
    </div>
  </main>

  <footer class="bottom-bar">
    <span>Claude Agent Monitor &mdash; Web Dashboard</span>
  </footer>
</div>

<script>
${getJS()}
</script>
</body>
</html>`;
}

function getCSS() {
  return `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #0d1117;
  --bg-card: #161b22;
  --bg-card-hover: #1c2333;
  --border: #30363d;
  --border-focus: #58a6ff;
  --text: #e6edf3;
  --text-dim: #8b949e;
  --text-muted: #484f58;
  --accent: #58a6ff;
  --green: #3fb950;
  --yellow: #d29922;
  --red: #f85149;
  --orange: #db6d28;
  --purple: #bc8cff;
  --cyan: #39d2c0;
  --bar-bg: #21262d;
  --radius: 8px;
  --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace;
}

html { font-size: 14px; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* Top bar */
.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-card);
  position: sticky;
  top: 0;
  z-index: 10;
}
.top-bar-left { display: flex; align-items: center; gap: 12px; }
.top-bar-right { display: flex; align-items: center; gap: 12px; }
.logo {
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 1rem;
  letter-spacing: 0.05em;
  color: var(--cyan);
}
.badge {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--bar-bg);
  color: var(--green);
  border: 1px solid var(--border);
}
.connection-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--red);
  transition: background 0.3s;
}
.connection-dot.connected { background: var(--green); }

.btn {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bar-bg);
  color: var(--text-dim);
  cursor: pointer;
  transition: all 0.15s;
}
.btn:hover { background: var(--bg-card-hover); color: var(--text); border-color: var(--text-muted); }
.btn:active { transform: scale(0.97); }

/* Main content */
main {
  flex: 1;
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  color: var(--text-dim);
}
.empty-icon { font-size: 3rem; margin-bottom: 16px; opacity: 0.5; }
.empty-hint { font-size: 0.85rem; color: var(--text-muted); margin-top: 8px; }

/* Session card */
.session-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 16px;
  overflow: hidden;
  transition: border-color 0.2s;
}
.session-card:hover { border-color: var(--text-muted); }
.session-card.status-active { border-left: 3px solid var(--green); }
.session-card.status-idle { border-left: 3px solid var(--yellow); }
.session-card.status-stale { border-left: 3px solid var(--text-muted); }
.session-card.status-ended { border-left: 3px solid var(--red); opacity: 0.6; }

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.status-dot {
  width: 10px; height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.status-dot.active { background: var(--green); box-shadow: 0 0 6px var(--green); }
.status-dot.idle { background: var(--yellow); }
.status-dot.stale { background: var(--text-muted); }
.status-dot.ended { background: var(--red); }
.status-dot.unknown { background: var(--text-muted); }

.agent-name {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text);
}
.agent-model {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
  background: var(--bar-bg);
  padding: 1px 6px;
  border-radius: 4px;
}
.agent-project {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-dim);
  margin-left: auto;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}
.agent-elapsed {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
  white-space: nowrap;
}

/* Topic line */
.topic-line {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--purple);
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
}

/* Card body */
.card-body { padding: 12px 16px; }

.summary-text {
  font-size: 0.85rem;
  color: var(--text-dim);
  margin-bottom: 12px;
  line-height: 1.5;
}

/* Stats row */
.stats-row {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.stat-item {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}
.stat-value {
  color: var(--accent);
  font-weight: 600;
}

/* Tool distribution bar */
.tool-dist {
  margin-bottom: 12px;
}
.tool-dist-label {
  font-size: 0.7rem;
  color: var(--text-muted);
  margin-bottom: 4px;
  font-family: var(--font-mono);
}
.tool-bar {
  display: flex;
  height: 6px;
  border-radius: 3px;
  overflow: hidden;
  background: var(--bar-bg);
}
.tool-bar-segment {
  height: 100%;
  transition: width 0.3s;
}

/* Tool timeline */
.tool-timeline { margin-top: 8px; }
.timeline-toggle {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--accent);
  cursor: pointer;
  background: none;
  border: none;
  padding: 4px 0;
  display: flex;
  align-items: center;
  gap: 4px;
}
.timeline-toggle:hover { text-decoration: underline; }
.timeline-toggle .arrow { transition: transform 0.2s; display: inline-block; }
.timeline-toggle .arrow.open { transform: rotate(90deg); }

.timeline-list {
  list-style: none;
  margin-top: 8px;
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}
.timeline-list.open { max-height: 2000px; }

.timeline-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 4px 0;
  border-left: 2px solid var(--border);
  margin-left: 4px;
  padding-left: 12px;
  font-size: 0.8rem;
}
.timeline-time {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--text-muted);
  white-space: nowrap;
  min-width: 48px;
}
.timeline-tool {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 0.75rem;
  padding: 0 4px;
  border-radius: 3px;
  white-space: nowrap;
}
.timeline-detail {
  font-size: 0.75rem;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

/* Tool colors */
.tool-Read { background: #1a3a2a; color: var(--green); }
.tool-Edit, .tool-Write { background: #3a2a1a; color: var(--orange); }
.tool-Bash { background: #2a1a3a; color: var(--purple); }
.tool-Grep, .tool-Glob { background: #1a2a3a; color: var(--accent); }
.tool-Task { background: #3a1a2a; color: var(--red); }
.tool-WebSearch, .tool-WebFetch { background: #1a3a3a; color: var(--cyan); }
.tool-default { background: var(--bar-bg); color: var(--text-dim); }

/* Message type badges */
.tool-user_msg { background: #2a1a2a; color: #d2a8ff; }
.tool-assistant_msg { background: #1a2a3a; color: var(--cyan); }

/* Message bubble styling */
.timeline-item.msg-item { border-left-color: var(--purple); }
.timeline-item.msg-user { border-left-color: #d2a8ff; }
.timeline-item.msg-assistant { border-left-color: var(--cyan); }
.timeline-msg-text {
  font-size: 0.75rem;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  font-style: italic;
}

/* Bar segment colors */
.seg-Read { background: var(--green); }
.seg-Edit, .seg-Write { background: var(--orange); }
.seg-Bash { background: var(--purple); }
.seg-Grep, .seg-Glob { background: var(--accent); }
.seg-Task { background: var(--red); }
.seg-WebSearch, .seg-WebFetch { background: var(--cyan); }
.seg-default { background: var(--text-muted); }

/* Bottom bar */
.bottom-bar {
  padding: 8px 20px;
  border-top: 1px solid var(--border);
  background: var(--bg-card);
  font-size: 0.75rem;
  color: var(--text-muted);
  text-align: center;
  font-family: var(--font-mono);
}

/* Responsive */
@media (max-width: 640px) {
  .top-bar { padding: 10px 12px; flex-wrap: wrap; gap: 8px; }
  main { padding: 12px; }
  .card-header { flex-wrap: wrap; gap: 6px; padding: 10px 12px; }
  .agent-project { margin-left: 0; max-width: 100%; }
  .stats-row { gap: 8px; }
  .timeline-item { font-size: 0.75rem; }
}

/* Project group headers */
.project-group {
  margin-bottom: 8px;
}
.project-group-header {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--cyan);
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}
.project-group-header:hover { color: var(--text); }
.project-group-header .group-arrow { transition: transform 0.2s; display: inline-block; }
.project-group-header .group-arrow.open { transform: rotate(90deg); }
.project-group-count {
  font-size: 0.7rem;
  color: var(--text-muted);
  font-weight: 400;
}

/* Child session indentation */
.session-card.child-session {
  margin-left: 24px;
  border-left-width: 2px;
}

/* Animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
.status-dot.active { animation: pulse 2s ease-in-out infinite; }
`;
}

function getJS() {
  return `
'use strict';

const container = document.getElementById('sessions-container');
const emptyState = document.getElementById('empty-state');
const activeCountEl = document.getElementById('active-count');
const connectionDot = document.getElementById('connection-dot');
const btnClear = document.getElementById('btn-clear');

// Track expanded timelines
const expandedTimelines = new Set();

// Tool category colors for distribution bar
const TOOL_CATEGORIES = {
  Read: 'seg-Read',
  Edit: 'seg-Edit',
  Write: 'seg-Write',
  Bash: 'seg-Bash',
  Grep: 'seg-Grep',
  Glob: 'seg-Glob',
  Task: 'seg-Task',
  WebSearch: 'seg-WebSearch',
  WebFetch: 'seg-WebFetch',
};

function getToolClass(name) {
  return TOOL_CATEGORIES[name] ? 'tool-' + name : 'tool-default';
}

function getSegClass(name) {
  return TOOL_CATEGORIES[name] || 'seg-default';
}

/**
 * Format elapsed time.
 */
function formatElapsed(ms) {
  const elapsed = Math.max(0, Date.now() - ms);
  const s = Math.floor(elapsed / 1000);
  if (s < 60) return s + 's ago';
  const m = Math.floor(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  return h + 'h ago';
}

/**
 * Format duration from start to now.
 */
function formatDuration(startMs) {
  const elapsed = Math.max(0, Date.now() - startMs);
  const s = Math.floor(elapsed / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return h + 'h ' + (m % 60) + 'm';
  if (m > 0) return m + 'm ' + (s % 60) + 's';
  return s + 's';
}

/**
 * Format absolute time (HH:MM:SS).
 */
function formatTime(ms) {
  const d = new Date(ms);
  return d.toLocaleTimeString();
}

/**
 * Get project name from cwd.
 */
function projectName(cwd) {
  if (!cwd) return '';
  const parts = cwd.split('/');
  return parts[parts.length - 1] || cwd;
}

/**
 * Compute tool type distribution from recentTools.
 */
function toolDistribution(tools) {
  const counts = {};
  for (const t of tools) {
    const name = t.toolName || 'unknown';
    counts[name] = (counts[name] || 0) + 1;
  }
  return counts;
}

/**
 * Escape HTML.
 */
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Render a single session card.
 */
function renderCard(session) {
  const tools = session.recentTools || [];
  const dist = toolDistribution(tools);
  const totalTools = session.toolCount || 0;
  const isExpanded = expandedTimelines.has(session.id);

  // Tool distribution bar segments
  const distEntries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const distTotal = distEntries.reduce((sum, e) => sum + e[1], 0);
  const barSegments = distEntries.map(([name, count]) => {
    const pct = distTotal > 0 ? (count / distTotal * 100).toFixed(1) : 0;
    return '<div class="tool-bar-segment ' + getSegClass(name) + '" style="width:' + pct + '%" title="' + esc(name) + ': ' + count + '"></div>';
  }).join('');

  // Stats
  const distLabels = distEntries.slice(0, 5).map(([name, count]) =>
    '<span class="stat-item">' + esc(name) + ' <span class="stat-value">' + count + '</span></span>'
  ).join('');

  // Build unified timeline (tools + messages), sorted newest first
  const conversation = session.conversation || [];
  const timelineEntries = [];
  for (const t of tools) {
    timelineEntries.push({ type: 'tool', ts: t.ts, data: t });
  }
  for (const m of conversation) {
    timelineEntries.push({
      type: m.role === 'user' ? 'user_message' : 'assistant_message',
      ts: m.ts,
      data: m,
    });
  }
  timelineEntries.sort((a, b) => b.ts - a.ts);

  // Timeline items
  const timelineItems = timelineEntries.map((entry) => {
    if (entry.type === 'tool') {
      const t = entry.data;
      return '<li class="timeline-item">' +
        '<span class="timeline-time">' + formatElapsed(t.ts) + '</span>' +
        '<span class="timeline-tool ' + getToolClass(t.toolName) + '">' + esc(t.toolName) + '</span>' +
        '<span class="timeline-detail" title="' + esc(t.toolDetail || t.toolSummary) + '">' + esc(t.toolSummary || '') + '</span>' +
      '</li>';
    } else if (entry.type === 'user_message') {
      const m = entry.data;
      return '<li class="timeline-item msg-item msg-user">' +
        '<span class="timeline-time">' + formatElapsed(m.ts) + '</span>' +
        '<span class="timeline-tool tool-user_msg">User</span>' +
        '<span class="timeline-msg-text" title="' + esc(m.text) + '">' + esc(m.text) + '</span>' +
      '</li>';
    } else {
      const m = entry.data;
      return '<li class="timeline-item msg-item msg-assistant">' +
        '<span class="timeline-time">' + formatElapsed(m.ts) + '</span>' +
        '<span class="timeline-tool tool-assistant_msg">Assistant</span>' +
        '<span class="timeline-msg-text" title="' + esc(m.text) + '">' + esc(m.text) + '</span>' +
      '</li>';
    }
  }).join('');

  // Topic: AI-generated summary or first user message fallback
  const topicText = session.topicSummary || session.topic || '';
  const topicHtml = topicText
    ? '<div class="topic-line" title="' + esc(session.topic || topicText) + '">&#x25B8; ' + esc(topicText.length > 120 ? topicText.slice(0, 117) + '...' : topicText) + '</div>'
    : '';

  return '<div class="session-card status-' + esc(session.status) + '" data-id="' + esc(session.id) + '">' +
    '<div class="card-header">' +
      '<span class="status-dot ' + esc(session.status) + '"></span>' +
      '<span class="agent-name">' + esc(session.name) + '</span>' +
      '<span class="agent-model">' + esc(session.model || '') + '</span>' +
      '<span class="agent-project" title="' + esc(session.cwd || '') + '">' + esc(projectName(session.cwd)) + '</span>' +
      '<span class="agent-elapsed">' + formatElapsed(session.lastEventAt) + '</span>' +
    '</div>' +
    topicHtml +
    '<div class="card-body">' +
      '<div class="summary-text">' + esc(session.summary || '') + '</div>' +
      '<div class="stats-row">' +
        '<span class="stat-item">Tools <span class="stat-value">' + totalTools + '</span></span>' +
        '<span class="stat-item">Duration <span class="stat-value">' + formatDuration(session.lastEventAt - (totalTools > 0 ? 60000 : 0)) + '</span></span>' +
        distLabels +
      '</div>' +
      (distTotal > 0 ? '<div class="tool-dist"><div class="tool-dist-label">Tool distribution</div><div class="tool-bar">' + barSegments + '</div></div>' : '') +
      '<div class="tool-timeline">' +
        '<button class="timeline-toggle" data-session="' + esc(session.id) + '">' +
          '<span class="arrow' + (isExpanded ? ' open' : '') + '">&#x25B6;</span> ' +
          'Activity Timeline (' + timelineEntries.length + ')' +
        '</button>' +
        '<ul class="timeline-list' + (isExpanded ? ' open' : '') + '">' +
          timelineItems +
        '</ul>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/**
 * Render all sessions.
 */
function renderSessions(sessions) {
  const activeCount = sessions.filter(s => s.status === 'active' || s.status === 'idle').length;
  activeCountEl.textContent = activeCount + ' active';

  if (sessions.length === 0) {
    emptyState.style.display = '';
    // Remove all cards
    const cards = container.querySelectorAll('.session-card');
    cards.forEach(c => c.remove());
    return;
  }

  emptyState.style.display = 'none';

  // Build new HTML - group by project if multiple projects exist
  const projects = {};
  for (const s of sessions) {
    const proj = projectName(s.cwd) || 'unknown';
    if (!projects[proj]) projects[proj] = [];
    projects[proj].push(s);
  }
  const projectKeys = Object.keys(projects);
  const useGrouping = projectKeys.length > 1;

  let html;
  if (useGrouping) {
    html = projectKeys.map(proj => {
      const groupSessions = projects[proj];
      const cards = groupSessions.map(renderCard).join('');
      return '<div class="project-group">' +
        '<div class="project-group-header">' +
          '<span class="group-arrow open">&#x25B6;</span>' +
          esc(proj) +
          '<span class="project-group-count">(' + groupSessions.length + ')</span>' +
        '</div>' +
        '<div class="project-group-body">' + cards + '</div>' +
      '</div>';
    }).join('');
  } else {
    html = sessions.map(renderCard).join('');
  }

  // Only update if changed (avoid flicker)
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Replace content (keep empty state element)
  const existingCards = container.querySelectorAll('.session-card');
  existingCards.forEach(c => c.remove());
  const existingGroups = container.querySelectorAll('.project-group');
  existingGroups.forEach(g => g.remove());

  while (tempDiv.firstChild) {
    container.appendChild(tempDiv.firstChild);
  }

  // Re-attach timeline toggle listeners
  container.querySelectorAll('.timeline-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const sid = btn.dataset.session;
      const list = btn.nextElementSibling;
      const arrow = btn.querySelector('.arrow');
      if (expandedTimelines.has(sid)) {
        expandedTimelines.delete(sid);
        list.classList.remove('open');
        arrow.classList.remove('open');
      } else {
        expandedTimelines.add(sid);
        list.classList.add('open');
        arrow.classList.add('open');
      }
    });
  });
}

// SSE connection
let evtSource = null;

function connectSSE() {
  if (evtSource) {
    evtSource.close();
  }

  evtSource = new EventSource('/api/events');

  evtSource.onopen = () => {
    connectionDot.classList.add('connected');
    connectionDot.title = 'Connected';
  };

  evtSource.onmessage = (e) => {
    try {
      const sessions = JSON.parse(e.data);
      renderSessions(sessions);
    } catch (err) {
      // ignore parse errors
    }
  };

  evtSource.onerror = () => {
    connectionDot.classList.remove('connected');
    connectionDot.title = 'Disconnected — reconnecting...';
    // EventSource auto-reconnects
  };
}

// Clear button
btnClear.addEventListener('click', async () => {
  btnClear.disabled = true;
  btnClear.textContent = 'Clearing...';
  try {
    const res = await fetch('/api/clear', { method: 'POST' });
    const data = await res.json();
    btnClear.textContent = 'Cleared ' + data.cleared;
    setTimeout(() => {
      btnClear.textContent = 'Clear Ended';
      btnClear.disabled = false;
    }, 1500);
  } catch {
    btnClear.textContent = 'Error';
    setTimeout(() => {
      btnClear.textContent = 'Clear Ended';
      btnClear.disabled = false;
    }, 1500);
  }
});

// Start
connectSSE();
`;
}

module.exports = { getHtml };
