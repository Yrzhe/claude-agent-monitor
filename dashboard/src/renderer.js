'use strict';

const path = require('path');

// ANSI color codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

const STATUS_ICONS = {
  active: `${GREEN}\u25cf${RESET}`,   // filled circle, green
  idle: `${YELLOW}\u25cb${RESET}`,    // empty circle, yellow
  stale: `${GRAY}\u25cb${RESET}`,     // empty circle, gray
  ended: `${GRAY}\u2715${RESET}`,     // x mark, gray
  unknown: `${GRAY}?${RESET}`,
};

/**
 * Format elapsed time since timestamp into human-readable string.
 */
function formatElapsed(timestampMs) {
  const elapsed = Math.max(0, Date.now() - timestampMs);
  const seconds = Math.floor(elapsed / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

/**
 * Strip ANSI escape codes to get visible length.
 */
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Pad a string (possibly containing ANSI codes) to a visible width.
 */
function padEndVisible(str, width) {
  const visibleLen = stripAnsi(str).length;
  const padding = Math.max(0, width - visibleLen);
  return str + ' '.repeat(padding);
}

/**
 * Truncate string to max length, adding ellipsis if needed.
 */
function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

/**
 * Get the project name from cwd (basename).
 */
function projectName(cwd) {
  if (!cwd) return '';
  return path.basename(cwd);
}

/**
 * Render the full dashboard to a string.
 */
function render(sessions) {
  const cols = process.stdout.columns || 80;
  if (cols < 60) {
    return `${DIM}Terminal too narrow (need 60+ columns)${RESET}`;
  }
  const lines = [];

  // Count active sessions
  const activeCount = sessions.filter(
    (s) => s.status === 'active' || s.status === 'idle'
  ).length;

  // Header
  const title = ' CLAUDE AGENT MONITOR ';
  const countStr = ` ${activeCount} active `;
  const headerPadLen = Math.max(0, cols - title.length - countStr.length - 4);
  const headerPad = '\u2500'.repeat(headerPadLen);
  lines.push(
    `${BOLD}${CYAN}\u250c\u2500${title}${headerPad}${countStr}\u2500\u2510${RESET}`
  );

  // Empty line
  lines.push(`${CYAN}\u2502${RESET}${' '.repeat(cols - 2)}${CYAN}\u2502${RESET}`);

  if (sessions.length === 0) {
    const msg = 'No active agent sessions';
    const pad = ' '.repeat(Math.max(0, cols - msg.length - 6));
    lines.push(`${CYAN}\u2502${RESET}  ${DIM}${msg}${RESET}${pad}${CYAN}\u2502${RESET}`);
  } else {
    // Column widths
    const nameWidth = 16;
    const projectWidth = 14;
    const timeWidth = 5;
    // Remaining for action
    const actionWidth = Math.max(10, cols - nameWidth - projectWidth - timeWidth - 10);

    for (const session of sessions) {
      const icon = STATUS_ICONS[session.status] || STATUS_ICONS.unknown;
      const name = truncate(session.name, nameWidth).padEnd(nameWidth);

      const proj = truncate(projectName(session.cwd), projectWidth).padEnd(projectWidth);

      let action;
      if (session.status === 'ended') {
        action = `${DIM}(ended)${RESET}`;
      } else if (session.status === 'idle' || session.status === 'stale') {
        action = `${DIM}(${session.status})${RESET}`;
      } else {
        action = truncate(session.lastTool || '(starting)', actionWidth);
      }
      const actionPadded = padEndVisible(action, actionWidth);

      const elapsed = formatElapsed(session.lastEventAt).padStart(timeWidth);

      const innerContent = `  ${icon} ${name} ${proj} ${actionPadded} ${elapsed}  `;

      lines.push(`${CYAN}\u2502${RESET}${innerContent}${CYAN}\u2502${RESET}`);
    }
  }

  // Empty line
  lines.push(`${CYAN}\u2502${RESET}${' '.repeat(cols - 2)}${CYAN}\u2502${RESET}`);

  // Footer
  const footer = '  [q] Quit  [r] Refresh  [c] Clear ended  ';
  const footerPad = ' '.repeat(Math.max(0, cols - footer.length - 2));
  lines.push(
    `${CYAN}\u2502${RESET}${DIM}${footer}${RESET}${footerPad}${CYAN}\u2502${RESET}`
  );

  // Bottom border
  lines.push(`${CYAN}\u2514${'─'.repeat(cols - 2)}\u2518${RESET}`);

  return lines.join('\n');
}

/**
 * Clear screen and draw the dashboard.
 */
function draw(sessions) {
  const output = render(sessions);
  process.stdout.write('\x1b[2J\x1b[H'); // clear screen, move cursor to top
  process.stdout.write(output + '\n');
}

module.exports = { render, draw };
