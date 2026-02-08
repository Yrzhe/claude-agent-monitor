'use strict';

const { execSync, spawn } = require('child_process');
const path = require('path');
const { loadAllSessions, clearEndedSessions } = require('./state');
const { draw } = require('./renderer');
const { SessionWatcher } = require('./watcher');
const { loadConfig, saveConfig } = require('./config');
const { SummaryManager } = require('./summarizer');
const { runSetup } = require('./setup');
const { notify, detectTransitions } = require('./notifier');
const { saveExport } = require('./exporter');

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
    filter: 'all',     // 'all' | 'active' | 'idle' | 'ended'
    expandedPanels: new Set(), // sessionIds with expanded tool details
    notifications: config.notifications || false,
    groupByProject: config.groupByProject || false,
  };

  // Cached sessions for re-render
  let currentSessions = [];
  let previousSessions = []; // For notification transition detection

  // Track whether we're in setup mode (blocks dashboard keys)
  let inSetup = false;

  // Web server child process
  let webProcess = null;
  const webPort = 3210;

  /**
   * Refresh: load sessions and redraw.
   */
  function refresh() {
    if (inSetup) return; // Don't redraw dashboard while in setup

    const allSessions = loadAllSessions(config);

    // Detect transitions for notifications before updating currentSessions
    if (uiState.notifications && previousSessions.length > 0) {
      const transitions = detectTransitions(previousSessions, allSessions);
      for (const t of transitions) {
        const name = t.session.name || 'Agent';
        if (t.type === 'session_end') {
          notify('Agent Finished', `${name} has completed its session`);
        } else if (t.type === 'became_idle') {
          notify('Agent Idle', `${name} is waiting for input`);
        } else if (t.type === 'became_stale') {
          notify('Agent Stale', `${name} has been unresponsive for 5+ minutes`);
        }
      }
    }
    previousSessions = allSessions;

    // Apply status filter
    if (uiState.filter === 'all') {
      currentSessions = allSessions;
    } else if (uiState.filter === 'active') {
      currentSessions = allSessions.filter((s) => s.status === 'active' || s.status === 'idle');
    } else if (uiState.filter === 'idle') {
      currentSessions = allSessions.filter((s) => s.status === 'idle' || s.status === 'stale');
    } else if (uiState.filter === 'ended') {
      currentSessions = allSessions.filter((s) => s.status === 'ended');
    }

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

    // Pass expandedPanels to renderer via config (avoids changing render() signature)
    const renderConfig = { ...config, _expandedPanels: uiState.expandedPanels };
    draw(currentSessions, uiState, renderConfig, summaries);
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
        case 'n': {
          // Toggle desktop notifications
          uiState.notifications = !uiState.notifications;
          config.notifications = uiState.notifications;
          saveConfig(config);
          refresh();
          return;
        }
        case 'f': {
          // Cycle status filter: All → Active → Idle → Ended → All
          const filters = ['all', 'active', 'idle', 'ended'];
          const idx = filters.indexOf(uiState.filter);
          uiState.filter = filters[(idx + 1) % filters.length];
          refresh();
          return;
        }
        case ' ': {
          // Toggle expand/collapse tool details for focused session
          if (sessions.length === 0) return;
          const focused = sessions[uiState.focusIndex];
          if (!focused) return;
          if (uiState.expandedPanels.has(focused.id)) {
            uiState.expandedPanels.delete(focused.id);
          } else {
            uiState.expandedPanels.add(focused.id);
          }
          refresh();
          return;
        }
        case 'e': {
          // Export focused session as markdown
          if (sessions.length === 0) return;
          const focusedSession = sessions[uiState.focusIndex];
          if (!focusedSession) return;
          const summary = summaryManager.getSummary(focusedSession);
          try {
            const exportPath = saveExport(focusedSession, 'md', summary);
            // Brief notification via terminal title
            process.stdout.write(`\x1b]0;Exported to ${path.basename(exportPath)}\x07`);
          } catch {
            // Export failed — non-critical
          }
          return;
        }
        case 'g': {
          // Toggle project grouping
          uiState.groupByProject = !uiState.groupByProject;
          config.groupByProject = uiState.groupByProject;
          saveConfig(config);
          refresh();
          return;
        }
        case 'w': {
          // Launch web dashboard and open browser
          if (!webProcess) {
            const camPath = path.join(__dirname, '..', 'bin', 'cam.js');
            webProcess = spawn(process.execPath, [camPath, 'web', '--port', String(webPort)], {
              stdio: 'ignore',
            });
            webProcess.on('exit', () => { webProcess = null; });
            // Give server a moment to bind the port before opening browser
            setTimeout(() => {
              try {
                execSync(`open http://localhost:${webPort}`, { stdio: 'ignore', timeout: 3000 });
              } catch { /* non-macOS or open unavailable */ }
            }, 500);
          } else {
            // Server already running, just open browser
            try {
              execSync(`open http://localhost:${webPort}`, { stdio: 'ignore', timeout: 3000 });
            } catch { /* non-macOS or open unavailable */ }
          }
          return;
        }
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
    if (webProcess) {
      webProcess.kill();
      webProcess = null;
    }
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
