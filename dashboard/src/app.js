'use strict';

const { execSync } = require('child_process');
const { loadAllSessions, clearEndedSessions } = require('./state');
const { draw } = require('./renderer');
const { SessionWatcher } = require('./watcher');
const { loadConfig, saveConfig } = require('./config');
const { SummaryManager } = require('./summarizer');
const { runSetup } = require('./setup');

/**
 * Start the dashboard application.
 */
async function start() {
  let config = loadConfig();

  // Summary manager
  const summaryManager = new SummaryManager(config);

  // Set up raw mode for keyboard input
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
  }

  // First-run setup: if no API key configured, offer the setup wizard
  if (!config.apiKey) {
    const setupResult = await runSetup(config);
    if (setupResult) {
      config = { ...config, ...setupResult };
      saveConfig(config);
      summaryManager.updateConfig(config);
    }
  }

  // UI state
  const uiState = {
    focusIndex: 0,
    scrollOffsets: {},  // sessionId -> number
  };

  // Cached sessions for re-render
  let currentSessions = [];

  // Track whether we're in setup mode (blocks dashboard keys)
  let inSetup = false;

  /**
   * Refresh: load sessions and redraw.
   */
  function refresh() {
    if (inSetup) return; // Don't redraw dashboard while in setup

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

  /**
   * Open the setup screen from the dashboard.
   */
  async function openSetup() {
    inSetup = true;
    const setupResult = await runSetup(config);
    if (setupResult) {
      config = { ...config, ...setupResult };
      saveConfig(config);
      summaryManager.updateConfig(config);
    }
    inSetup = false;
    refresh();
  }

  // Keyboard input
  if (process.stdin.isTTY) {
    process.stdin.on('data', (key) => {
      // If we're in setup, don't handle dashboard keys (setup handles its own keys)
      if (inSetup) return;

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
        case 's':
          openSetup();
          return;
        case '\r': // Enter — jump to focused session's tmux pane
        case '\n': {
          if (sessions.length === 0) return;
          const focused = sessions[uiState.focusIndex];
          if (focused && focused.tmuxPane) {
            try {
              const safePaneId = focused.tmuxPane.replace(/[^a-zA-Z0-9%_-]/g, '');
              execSync(`tmux select-pane -t "${safePaneId}"`, {
                timeout: 2000,
                stdio: ['pipe', 'pipe', 'pipe'],
              });
            } catch {
              // pane may no longer exist
            }
          }
          return;
        }
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
