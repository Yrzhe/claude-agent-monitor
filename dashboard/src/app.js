'use strict';

const { loadAllSessions, clearEndedSessions } = require('./state');
const { draw } = require('./renderer');
const { SessionWatcher } = require('./watcher');

/**
 * Refresh: load sessions and redraw.
 */
function refresh() {
  const sessions = loadAllSessions();
  draw(sessions);
}

/**
 * Start the dashboard application.
 */
function start() {
  // Initial render
  refresh();

  // Watch for changes
  const watcher = new SessionWatcher();
  watcher.on('change', refresh);
  watcher.start();

  // Auto-refresh every 5 seconds to update elapsed times
  const autoRefreshTimer = setInterval(refresh, 5000);

  // Keyboard input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (key) => {
      switch (key) {
        case 'q':
        case '\u0003': // Ctrl+C
          cleanup();
          break;
        case 'r':
          refresh();
          break;
        case 'c':
          clearEndedSessions();
          refresh();
          break;
      }
    });
  }

  function cleanup() {
    watcher.stop();
    clearInterval(autoRefreshTimer);
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
