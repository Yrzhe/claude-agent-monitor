#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const { readStdin, writeEvent, getAgentName } = require('./lib/shared');

/**
 * Capture tmux pane ID and window info from the current environment.
 * Returns { tmux_pane, tmux_window } or empty strings if not in tmux.
 */
function getTmuxInfo() {
  const tmuxPane = process.env.TMUX_PANE || '';
  let tmuxWindow = '';

  if (tmuxPane) {
    try {
      // Sanitize pane ID (normally %N format from tmux)
      const safePaneId = tmuxPane.replace(/[^a-zA-Z0-9%_-]/g, '');
      tmuxWindow = execSync(
        `tmux display-message -t "${safePaneId}" -p "#I:#W"`,
        { encoding: 'utf8', timeout: 2000, stdio: ['pipe', 'pipe', 'pipe'] }
      ).trim();
    } catch {
      // tmux not available or pane gone
    }
  }

  return { tmux_pane: tmuxPane, tmux_window: tmuxWindow };
}

async function main() {
  const input = await readStdin();
  if (!input || !input.session_id) {
    process.exit(0);
  }

  const { session_id, cwd, source, model } = input;
  const tmux = getTmuxInfo();

  writeEvent(session_id, {
    ts: new Date().toISOString(),
    event: 'session_start',
    session_id,
    agent_name: getAgentName(session_id),
    cwd: cwd || process.cwd(),
    model: model || 'unknown',
    source: source || 'unknown',
    tmux_pane: tmux.tmux_pane,
    tmux_window: tmux.tmux_window,
  });

  process.exit(0);
}

main().catch(() => process.exit(0));
