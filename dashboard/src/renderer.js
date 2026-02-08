'use strict';

const path = require('path');
const { buildTimeline } = require('./timeline');
const { groupSessionsByProject, detectParentChild, buildSessionTree } = require('./relationships');

// ANSI color codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const WHITE = '\x1b[37m';
const GRAY = '\x1b[90m';
const BG_NONE = '';

const STATUS_ICONS = {
  active: `${GREEN}\u25cf${RESET}`,   // filled circle, green
  idle: `${YELLOW}\u25cb${RESET}`,    // empty circle, yellow
  stale: `${GRAY}\u25cb${RESET}`,     // empty circle, gray
  ended: `${GRAY}\u2715${RESET}`,     // x mark, gray
  unknown: `${GRAY}?${RESET}`,
};

// Box-drawing characters
const BOX = {
  tl: '\u250c', tr: '\u2510', bl: '\u2514', br: '\u2518',
  h: '\u2500', v: '\u2502', div: '\u2500',
  tl_bold: '\u250f', tr_bold: '\u2513', bl_bold: '\u2517', br_bold: '\u251b',
  h_bold: '\u2501', v_bold: '\u2503',
};

/**
 * Check if a Unicode code point is full-width (occupies 2 terminal columns).
 * Covers CJK Unified Ideographs, Hiragana, Katakana, Hangul, fullwidth forms, etc.
 */
function isFullWidth(code) {
  return (
    (code >= 0x1100 && code <= 0x115F) ||   // Hangul Jamo
    (code >= 0x2E80 && code <= 0x303E) ||   // CJK Radicals, Kangxi, Symbols
    (code >= 0x3040 && code <= 0x33BF) ||   // Hiragana, Katakana, CJK Compat
    (code >= 0x3400 && code <= 0x4DBF) ||   // CJK Extension A
    (code >= 0x4E00 && code <= 0x9FFF) ||   // CJK Unified Ideographs
    (code >= 0xA000 && code <= 0xA4CF) ||   // Yi
    (code >= 0xAC00 && code <= 0xD7AF) ||   // Hangul Syllables
    (code >= 0xF900 && code <= 0xFAFF) ||   // CJK Compat Ideographs
    (code >= 0xFE30 && code <= 0xFE4F) ||   // CJK Compat Forms
    (code >= 0xFF01 && code <= 0xFF60) ||   // Fullwidth Forms
    (code >= 0xFFE0 && code <= 0xFFE6) ||   // Fullwidth Signs
    (code >= 0x20000 && code <= 0x2FA1F)    // CJK Extension B-F
  );
}

/**
 * Calculate display width of a string in terminal columns.
 * CJK characters = 2 columns, ASCII = 1 column.
 */
function displayWidth(str) {
  let width = 0;
  for (const ch of str) {
    const code = ch.codePointAt(0);
    width += isFullWidth(code) ? 2 : 1;
  }
  return width;
}

/**
 * Strip ANSI escape codes to get visible text.
 */
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Get the display width of a string, stripping ANSI codes first.
 */
function visibleWidth(str) {
  return displayWidth(stripAnsi(str));
}

/**
 * Pad a string (possibly containing ANSI codes) to a visible column width.
 */
function padEndVisible(str, width) {
  const vw = visibleWidth(str);
  const padding = Math.max(0, width - vw);
  return str + ' '.repeat(padding);
}

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
 * Truncate string to fit within maxCols display columns, adding ellipsis if needed.
 */
function truncate(str, maxCols) {
  if (!str) return '';
  if (displayWidth(str) <= maxCols) return str;

  let width = 0;
  let i = 0;
  for (const ch of str) {
    const cw = isFullWidth(ch.codePointAt(0)) ? 2 : 1;
    if (width + cw + 1 > maxCols) break; // +1 for ellipsis
    width += cw;
    i += ch.length; // handle surrogate pairs
  }
  return str.slice(0, i) + '\u2026';
}

/**
 * Get the project name from cwd (basename).
 */
function projectName(cwd) {
  if (!cwd) return '';
  return path.basename(cwd);
}

/**
 * Word-wrap text to fit within maxCols display columns.
 * Handles CJK text (no spaces) by breaking at character boundaries.
 */
function wordWrap(text, maxCols) {
  if (!text) return [''];

  const words = text.split(/(\s+)/); // keep whitespace tokens
  const lines = [];
  let currentLine = '';
  let currentWidth = 0;

  for (const token of words) {
    // Skip pure whitespace tokens between words
    if (/^\s+$/.test(token)) {
      if (currentWidth > 0 && currentWidth + 1 <= maxCols) {
        currentLine += ' ';
        currentWidth += 1;
      }
      continue;
    }

    const tokenWidth = displayWidth(token);

    // If token fits on current line
    if (currentWidth + tokenWidth <= maxCols) {
      currentLine += token;
      currentWidth += tokenWidth;
      continue;
    }

    // Token doesn't fit — if current line has content, push it
    if (currentWidth > 0) {
      lines.push(currentLine);
      currentLine = '';
      currentWidth = 0;
    }

    // If the token itself is wider than maxCols, break it char-by-char
    if (tokenWidth > maxCols) {
      for (const ch of token) {
        const cw = isFullWidth(ch.codePointAt(0)) ? 2 : 1;
        if (currentWidth + cw > maxCols) {
          lines.push(currentLine);
          currentLine = '';
          currentWidth = 0;
        }
        currentLine += ch;
        currentWidth += cw;
      }
    } else {
      currentLine = token;
      currentWidth = tokenWidth;
    }
  }

  if (currentLine) lines.push(currentLine);
  if (lines.length === 0) lines.push('');
  return lines;
}

/**
 * Format elapsed time for tool events (relative to now).
 */
function formatToolElapsed(ts) {
  return formatElapsed(ts);
}

/**
 * Render the top border of a panel with status icon, name, project, and elapsed.
 */
function renderPanelHeader(session, innerWidth, isFocused) {
  const borderColor = isFocused ? WHITE : CYAN;
  const hChar = isFocused ? BOX.h_bold : BOX.h;
  const tlChar = isFocused ? BOX.tl_bold : BOX.tl;
  const trChar = isFocused ? BOX.tr_bold : BOX.tr;

  const icon = STATUS_ICONS[session.status] || STATUS_ICONS.unknown;
  const name = truncate(session.name, 16);
  const proj = truncate(projectName(session.cwd), 20);
  const elapsed = formatElapsed(session.lastEventAt);

  // Tmux window label (e.g., "[2:work]")
  const tmuxLabel = session.tmuxWindow
    ? `${CYAN}[${session.tmuxWindow}]${RESET} `
    : '';

  // Build the header text: ─ ● name ─ [2:work] project ──── elapsed ─
  const label = ` ${icon} ${name} `;
  const projPart = proj ? `${tmuxLabel}${DIM}${proj}${RESET} ` : '';
  const elapsedPart = ` ${elapsed} `;

  const labelVW = visibleWidth(label);
  const projVW = visibleWidth(projPart);
  const elapsedVW = displayWidth(elapsedPart);

  // Fill remaining width with horizontal lines
  const fillLen = Math.max(0, innerWidth - labelVW - projVW - elapsedVW);
  const fill = hChar.repeat(fillLen);

  return `${borderColor}${tlChar}${hChar}${RESET}${label}${borderColor}${hChar}${RESET} ${projPart}${borderColor}${fill}${elapsedPart}${hChar}${trChar}${RESET}`;
}

/**
 * Render a content line inside a panel border.
 */
function renderPanelLine(content, innerWidth, isFocused) {
  const borderColor = isFocused ? WHITE : CYAN;
  const vChar = isFocused ? BOX.v_bold : BOX.v;
  const padded = padEndVisible(content, innerWidth);
  return `${borderColor}${vChar}${RESET} ${padded} ${borderColor}${vChar}${RESET}`;
}

/**
 * Render a horizontal divider inside a panel.
 */
function renderPanelDivider(innerWidth, isFocused) {
  const borderColor = isFocused ? WHITE : CYAN;
  const vChar = isFocused ? BOX.v_bold : BOX.v;
  const dashes = BOX.div.repeat(innerWidth + 2);
  return `${borderColor}${vChar}${dashes}${vChar}${RESET}`;
}

/**
 * Render the bottom border of a panel.
 */
function renderPanelFooter(innerWidth, isFocused) {
  const borderColor = isFocused ? WHITE : CYAN;
  const hChar = isFocused ? BOX.h_bold : BOX.h;
  const blChar = isFocused ? BOX.bl_bold : BOX.bl;
  const brChar = isFocused ? BOX.br_bold : BOX.br;
  return `${borderColor}${blChar}${hChar.repeat(innerWidth + 2)}${brChar}${RESET}`;
}

/**
 * Render summary lines (AI or rule-based), word-wrapped up to 3 lines.
 */
function renderSummaryLines(summary, innerWidth) {
  if (!summary) return [`${DIM}(no summary)${RESET}`];
  const wrapped = wordWrap(summary, innerWidth);
  const lines = wrapped.map((line) => `${DIM}${line}${RESET}`);
  return lines;
}

/**
 * Render tool history lines with scroll offset.
 * @param {Array} recentTools - Array of {toolName, toolSummary, toolDetail, ts}
 * @param {number} innerWidth - Available inner width
 * @param {number} scrollOffset - How many lines to skip from top
 * @param {number} maxLines - Max visible tool lines (default 5)
 */
function renderToolLines(recentTools, innerWidth, scrollOffset, maxLines) {
  const visibleLines = maxLines || 5;
  if (!recentTools || recentTools.length === 0) {
    return [`${DIM}  (no tools used)${RESET}`];
  }

  const allLines = recentTools.map((t) => {
    const elapsed = formatToolElapsed(t.ts);
    const elapsedStr = elapsed.padStart(4);
    const prefix = `  \u2022 `;
    const suffix = `  ${elapsedStr}`;
    const maxToolCols = innerWidth - prefix.length - suffix.length;
    const toolText = truncate(`${t.toolName} ${t.toolSummary}`, maxToolCols);
    const toolPad = Math.max(0, maxToolCols - displayWidth(toolText));
    return `${prefix}${toolText}${' '.repeat(toolPad)}${DIM}${suffix}${RESET}`;
  });

  const offset = Math.min(scrollOffset || 0, Math.max(0, allLines.length - visibleLines));
  const visible = allLines.slice(offset, offset + visibleLines);

  // Show scroll indicators
  if (offset > 0) {
    visible[0] = `${DIM}  \u25b2 ${(offset)} more above${RESET}`;
  }
  if (offset + visibleLines < allLines.length) {
    const remaining = allLines.length - offset - visibleLines;
    visible[visible.length - 1] = `${DIM}  \u25bc ${remaining} more below${RESET}`;
  }

  return visible;
}

/**
 * Render timeline lines (interleaved tools + messages) with scroll offset.
 * @param {Array} recentTools - Array of {toolName, toolSummary, toolDetail, ts, ...}
 * @param {Array} conversation - Array of {role, text, ts}
 * @param {number} innerWidth - Available inner width
 * @param {number} scrollOffset - How many lines to skip from top
 * @param {number} maxLines - Max visible lines (default 5)
 */
function renderTimelineLines(recentTools, conversation, innerWidth, scrollOffset, maxLines) {
  const visibleLines = maxLines || 5;
  const timeline = buildTimeline(recentTools, conversation);

  if (timeline.length === 0) {
    return [`${DIM}  (no activity)${RESET}`];
  }

  const allLines = timeline.map((entry) => {
    const elapsed = formatToolElapsed(entry.ts);
    const elapsedStr = elapsed.padStart(4);
    const suffix = `  ${elapsedStr}`;

    if (entry.type === 'tool') {
      const prefix = `  \u2022 `;
      const maxToolCols = innerWidth - prefix.length - suffix.length;
      const toolText = truncate(`${entry.toolName} ${entry.toolSummary}`, maxToolCols);
      const toolPad = Math.max(0, maxToolCols - displayWidth(toolText));
      return `${prefix}${toolText}${' '.repeat(toolPad)}${DIM}${suffix}${RESET}`;
    } else if (entry.type === 'user_message') {
      const prefix = `  ${MAGENTA}U:${RESET} `;
      const prefixVisW = 5; // "  U: " = 5 visible chars
      const maxMsgCols = innerWidth - prefixVisW - suffix.length;
      const msgText = truncate(entry.text.replace(/\n/g, ' '), maxMsgCols);
      const msgPad = Math.max(0, maxMsgCols - displayWidth(msgText));
      return `${prefix}${DIM}${msgText}${RESET}${' '.repeat(msgPad)}${DIM}${suffix}${RESET}`;
    } else {
      // assistant_message
      const prefix = `  ${CYAN}A:${RESET} `;
      const prefixVisW = 5; // "  A: " = 5 visible chars
      const maxMsgCols = innerWidth - prefixVisW - suffix.length;
      const msgText = truncate(entry.text.replace(/\n/g, ' '), maxMsgCols);
      const msgPad = Math.max(0, maxMsgCols - displayWidth(msgText));
      return `${prefix}${DIM}${msgText}${RESET}${' '.repeat(msgPad)}${DIM}${suffix}${RESET}`;
    }
  });

  const offset = Math.min(scrollOffset || 0, Math.max(0, allLines.length - visibleLines));
  const visible = allLines.slice(offset, offset + visibleLines);

  // Show scroll indicators
  if (offset > 0) {
    visible[0] = `${DIM}  \u25b2 ${offset} more above${RESET}`;
  }
  if (offset + visibleLines < allLines.length) {
    const remaining = allLines.length - offset - visibleLines;
    visible[visible.length - 1] = `${DIM}  \u25bc ${remaining} more below${RESET}`;
  }

  return visible;
}

/**
 * Render expanded timeline lines showing 2 lines per tool entry (detail + result).
 */
function renderExpandedTimelineLines(recentTools, conversation, innerWidth, scrollOffset, maxLines) {
  const visibleLines = maxLines || 10;
  const timeline = buildTimeline(recentTools, conversation);

  if (timeline.length === 0) {
    return [`${DIM}  (no activity)${RESET}`];
  }

  const allLines = [];
  for (const entry of timeline) {
    const elapsed = formatToolElapsed(entry.ts);
    const elapsedStr = elapsed.padStart(4);
    const suffix = `  ${elapsedStr}`;

    if (entry.type === 'tool') {
      // Line 1: tool name + summary
      const prefix = `  \u2022 `;
      const maxToolCols = innerWidth - prefix.length - suffix.length;
      const toolText = truncate(`${entry.toolName} ${entry.toolSummary}`, maxToolCols);
      const toolPad = Math.max(0, maxToolCols - displayWidth(toolText));
      allLines.push(`${prefix}${toolText}${' '.repeat(toolPad)}${DIM}${suffix}${RESET}`);

      // Line 2: detail + result (indented)
      const detailPrefix = '    ';
      const maxDetailCols = innerWidth - detailPrefix.length;
      let detailText = '';
      if (entry.toolDetail) {
        detailText = entry.toolDetail;
      }
      if (entry.toolResultBrief) {
        detailText += detailText ? ` \u2192 ${entry.toolResultBrief}` : `\u2192 ${entry.toolResultBrief}`;
      }
      if (detailText) {
        const truncDetail = truncate(detailText, maxDetailCols);
        allLines.push(`${DIM}${detailPrefix}${truncDetail}${RESET}`);
      }
    } else if (entry.type === 'user_message') {
      const prefix = `  ${MAGENTA}U:${RESET} `;
      const prefixVisW = 5;
      const maxMsgCols = innerWidth - prefixVisW - suffix.length;
      const msgText = truncate(entry.text.replace(/\n/g, ' '), maxMsgCols);
      const msgPad = Math.max(0, maxMsgCols - displayWidth(msgText));
      allLines.push(`${prefix}${DIM}${msgText}${RESET}${' '.repeat(msgPad)}${DIM}${suffix}${RESET}`);
    } else {
      const prefix = `  ${CYAN}A:${RESET} `;
      const prefixVisW = 5;
      const maxMsgCols = innerWidth - prefixVisW - suffix.length;
      const msgText = truncate(entry.text.replace(/\n/g, ' '), maxMsgCols);
      const msgPad = Math.max(0, maxMsgCols - displayWidth(msgText));
      allLines.push(`${prefix}${DIM}${msgText}${RESET}${' '.repeat(msgPad)}${DIM}${suffix}${RESET}`);
    }
  }

  const offset = Math.min(scrollOffset || 0, Math.max(0, allLines.length - visibleLines));
  const visible = allLines.slice(offset, offset + visibleLines);

  if (offset > 0) {
    visible[0] = `${DIM}  \u25b2 ${offset} more above${RESET}`;
  }
  if (offset + visibleLines < allLines.length) {
    const remaining = allLines.length - offset - visibleLines;
    visible[visible.length - 1] = `${DIM}  \u25bc ${remaining} more below${RESET}`;
  }

  return visible;
}

/**
 * Render a single agent panel.
 * @param {object} session - Session state object.
 * @param {number} width - Total panel width including borders.
 * @param {object} config - Config object.
 * @param {boolean} isFocused - Whether this panel is focused.
 * @param {number} scrollOffset - Tool history scroll offset.
 * @param {string} summary - AI or rule-based summary text.
 * @param {string} topic - AI or rule-based topic text.
 */
function renderPanel(session, width, config, isFocused, scrollOffset, summary, topic) {
  const innerWidth = width - 4; // 2 border chars + 2 spaces
  const lines = [];

  // Header (top border with name, project, elapsed)
  lines.push(renderPanelHeader(session, innerWidth, isFocused));

  // Topic line: AI-generated or first user message
  const topicDisplay = topic || session.topic;
  if (topicDisplay) {
    const topicText = truncate(topicDisplay, innerWidth - 4);
    lines.push(renderPanelLine(`${MAGENTA}\u25B8${RESET} ${topicText}`, innerWidth, isFocused));
  }

  // Summary lines (up to 3 lines)
  const summaryLines = renderSummaryLines(summary, innerWidth);
  for (const sl of summaryLines) {
    lines.push(renderPanelLine(sl, innerWidth, isFocused));
  }

  // Divider
  lines.push(renderPanelDivider(innerWidth, isFocused));

  // Determine if panel is expanded (more lines, show tool details)
  const isExpanded = config && config._expandedPanels && config._expandedPanels.has(session.id);
  const maxToolLines = isExpanded ? 10 : 5;

  // Timeline: interleaved tools + messages
  if (isExpanded) {
    // Expanded: show 2-line entries with detail + result
    const expandedLines = renderExpandedTimelineLines(
      session.recentTools, session.conversation || [], innerWidth, scrollOffset, maxToolLines
    );
    for (const tl of expandedLines) {
      lines.push(renderPanelLine(tl, innerWidth, isFocused));
    }
  } else {
    const timelineLines = renderTimelineLines(
      session.recentTools, session.conversation || [], innerWidth, scrollOffset, maxToolLines
    );
    for (const tl of timelineLines) {
      lines.push(renderPanelLine(tl, innerWidth, isFocused));
    }
  }

  // Footer (bottom border)
  lines.push(renderPanelFooter(innerWidth, isFocused));

  return lines;
}

/**
 * Render the full dashboard to a string.
 * @param {Array} sessions - Array of session objects.
 * @param {object} uiState - {focusIndex, scrollOffsets}.
 * @param {object} config - Config object.
 * @param {object} summaries - Map of sessionId -> summary text.
 * @param {object} topics - Map of sessionId -> topic text.
 */
function render(sessions, uiState, config, summaries, topics) {
  const cols = process.stdout.columns || 80;
  if (cols < 60) {
    return `${DIM}Terminal too narrow (need 60+ columns)${RESET}`;
  }

  const ui = uiState || { focusIndex: 0, scrollOffsets: {} };
  const sums = summaries || {};
  const tops = topics || {};
  const lines = [];

  // Count active sessions
  const activeCount = sessions.filter(
    (s) => s.status === 'active' || s.status === 'idle'
  ).length;

  // Outer header
  const title = ' CLAUDE AGENT MONITOR ';
  const countStr = ` ${activeCount} active `;
  const headerPadLen = Math.max(0, cols - title.length - countStr.length - 4);
  const headerPad = BOX.h.repeat(headerPadLen);
  lines.push(
    `${BOLD}${CYAN}${BOX.tl}${BOX.h}${title}${headerPad}${countStr}${BOX.h}${BOX.tr}${RESET}`
  );

  // Empty line
  lines.push(`${CYAN}${BOX.v}${RESET}${' '.repeat(cols - 2)}${CYAN}${BOX.v}${RESET}`);

  if (sessions.length === 0) {
    const msg = ui.filter !== 'all' ? `No ${ui.filter} sessions (filter active)` : 'No active agent sessions';
    const pad = ' '.repeat(Math.max(0, cols - msg.length - 6));
    lines.push(`${CYAN}${BOX.v}${RESET}  ${DIM}${msg}${RESET}${pad}${CYAN}${BOX.v}${RESET}`);
  } else {
    const panelWidth = cols - 4; // 2 outer borders + 2 padding
    const isGrouped = config && config.groupByProject;

    // Build render list: optionally grouped by project
    let renderList; // [{session, groupHeader?}]
    if (isGrouped) {
      const groups = groupSessionsByProject(sessions);
      renderList = [];
      let idx = 0;
      for (const [project, groupSessions] of groups) {
        renderList.push({ groupHeader: project, sessionCount: groupSessions.length });
        for (const s of groupSessions) {
          renderList.push({ session: s, originalIndex: idx++ });
        }
      }
    } else {
      renderList = sessions.map((s, i) => ({ session: s, originalIndex: i }));
    }

    let panelIdx = 0;
    for (const item of renderList) {
      if (item.groupHeader) {
        // Render project group header
        const headerText = `  ${BOLD}${CYAN}\u25B8 ${item.groupHeader}${RESET} ${DIM}(${item.sessionCount})${RESET}`;
        const headerPad = ' '.repeat(Math.max(0, cols - visibleWidth(headerText) - 4));
        lines.push(`${CYAN}${BOX.v}${RESET}${headerText}${headerPad}  ${CYAN}${BOX.v}${RESET}`);
        continue;
      }

      const session = item.session;
      const isFocused = item.originalIndex === ui.focusIndex;
      const scrollOffset = ui.scrollOffsets[session.id] || 0;
      const summary = sums[session.id] || '';
      const topic = tops[session.id] || '';

      const panelLines = renderPanel(
        session, panelWidth, config, isFocused, scrollOffset, summary, topic
      );

      for (const pl of panelLines) {
        // Wrap each panel line inside the outer border
        const vw = visibleWidth(pl);
        const rightPad = Math.max(0, cols - vw - 4);
        lines.push(
          `${CYAN}${BOX.v}${RESET} ${pl}${' '.repeat(rightPad)} ${CYAN}${BOX.v}${RESET}`
        );
      }

      panelIdx++;
      // Spacing between panels
      if (panelIdx < sessions.length) {
        lines.push(`${CYAN}${BOX.v}${RESET}${' '.repeat(cols - 2)}${CYAN}${BOX.v}${RESET}`);
      }
    }
  }

  // Empty line
  lines.push(`${CYAN}${BOX.v}${RESET}${' '.repeat(cols - 2)}${CYAN}${BOX.v}${RESET}`);

  // Footer with keybindings
  const aiLabel = config && config.apiKey ? `${GREEN}AI${RESET}` : `${DIM}rules${RESET}`;
  const notifyLabel = ui.notifications ? `${GREEN}ON${RESET}` : `${DIM}off${RESET}`;
  const filterLabel = (ui.filter || 'all').charAt(0).toUpperCase() + (ui.filter || 'all').slice(1);
  const groupLabel = ui.groupByProject ? `${GREEN}ON${RESET}` : `${DIM}off${RESET}`;
  const footer = `  [\u2191\u2193] Focus  [j/k] Scroll  [Space] Expand  [f] ${filterLabel}  [n] Notify:${notifyLabel}  [g] Group:${groupLabel}  [e] Export  [w] Web  [q] Quit  ${aiLabel}  `;
  const footerPadLen = Math.max(0, cols - visibleWidth(footer) - 2);
  lines.push(
    `${CYAN}${BOX.v}${RESET}${DIM}${footer}${RESET}${' '.repeat(footerPadLen)}${CYAN}${BOX.v}${RESET}`
  );

  // Bottom border
  lines.push(`${CYAN}${BOX.bl}${BOX.h.repeat(cols - 2)}${BOX.br}${RESET}`);

  return lines.join('\n');
}

/**
 * Clear screen and draw the dashboard.
 */
function draw(sessions, uiState, config, summaries, topics) {
  const output = render(sessions, uiState, config, summaries, topics);
  process.stdout.write('\x1b[2J\x1b[H'); // clear screen, move cursor to top
  process.stdout.write(output + '\n');
}

module.exports = { render, draw, stripAnsi, displayWidth, visibleWidth, padEndVisible, wordWrap, formatElapsed, truncate, renderTimelineLines };
