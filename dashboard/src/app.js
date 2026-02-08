'use strict';

const { loadAllSessions, clearEndedSessions } = require('./state');
const { draw } = require('./renderer');
const { SessionWatcher } = require('./watcher');
const { loadConfig } = require('./config');
const { SummaryManager } = require('./summarizer');

/**
 * Start the dashboard application.
 */
function start() {
  const config = loadConfig();

  // UI state
  const uiState = {
    focusIndex: 0,
    scrollOffsets: {},  // sessionId -> number
  };

  // Summary manager
  const summaryManager = new SummaryManager(config);

  // Cached sessions for re-render
  let currentSessions = [];

  /**
   * Refresh: load sessions and redraw.
   */
  function refresh() {
    currentSessions = loadAllSessions(config);

    // Clamp focus index
    if (currentSessions.length === 0) {
      uiState.focusIndex = 0;
    } else if (uiState.focusIndex >= currentSessions.length) {
      uiState.focusIndex = currentSessions.length - 1;
    }

    // Gather summaries
    const summaries = {};
    for (const session of currentSessions) {
      summaries[session.id] = summaryManager.getSummary(session);
    }

    draw(currentSessions, uiState, config, summaries);
  }

  // Wire up async summary updates to trigger re-render
  summaryManager.onUpdate = () => refresh();

  // Initial render
  refresh();

  // Watch for changes
  const watcher = new SessionWatcher();
  watcher.on('change', refresh);
  watcher.start();

  // Auto-refresh every 5 seconds to update elapsed times
  const autoRefreshTimer = setInterval(refresh, 5000);

  // Handle terminal resize
  process.stdout.on('resize', refresh);

  // Keyboard input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (key) => {
      const sessions = currentSessions;

      switch (key) {
        case 'q':
        case '\u0003': // Ctrl+C
          cleanup();
          return;
        case 'r':
          refresh();
          return;
        case 'c':
          clearEndedSessions();
          refresh();
          return;
      }

      // Arrow keys come as escape sequences
      if (key === '\x1b[A' || key === '\x1b[B') {
        // Up/Down arrows — switch focus between panels
        if (sessions.length === 0) return;
        if (key === '\x1b[A') {
          // Up
          uiState.focusIndex = Math.max(0, uiState.focusIndex - 1);
        } else {
          // Down
          uiState.focusIndex = Math.min(sessions.length - 1, uiState.focusIndex + 1);
        }
        refresh();
        return;
      }

      if (key === 'j' || key === 'k') {
        // j/k — scroll tool history within focused panel
        if (sessions.length === 0) return;
        const focused = sessions[uiState.focusIndex];
        if (!focused) return;
        const id = focused.id;
        const current = uiState.scrollOffsets[id] || 0;
        const maxScroll = Math.max(0, (focused.recentTools || []).length - 3);

        if (key === 'j') {
          // Scroll down (show older tools)
          uiState.scrollOffsets[id] = Math.min(current + 1, maxScroll);
        } else {
          // Scroll up (show newer tools)
          uiState.scrollOffsets[id] = Math.max(current - 1, 0);
        }
        refresh();
        return;
      }
    });
  }

  function cleanup() {
    watcher.stop();
    clearInterval(autoRefreshTimer);
    process.stdout.removeAllListeners('resize');
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false);
    }
    process.stdout.write('\x1b[2J\x1b[H'); // clear screen
    process.stdout.write('Goodbye!\n');
    process.exit(0);
  }

  // Handle signals gracefully
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

module.exports = { start };
