'use strict';

/**
 * Build a unified timeline by merging tool events and conversation messages.
 * Returns entries sorted by timestamp (newest first), matching recentTools order.
 *
 * @param {Array} recentTools - Array of {toolName, toolSummary, toolDetail, toolResultBrief, ts}
 * @param {Array} conversation - Array of {role, text, ts}
 * @returns {Array<{type: string, ts: number, ...}>}
 *   type: 'tool' | 'user_message' | 'assistant_message'
 */
function buildTimeline(recentTools, conversation) {
  const entries = [];

  // Add tool entries
  if (recentTools) {
    for (const t of recentTools) {
      entries.push({
        type: 'tool',
        ts: t.ts,
        toolName: t.toolName,
        toolSummary: t.toolSummary,
        toolDetail: t.toolDetail || '',
        toolResultBrief: t.toolResultBrief || '',
      });
    }
  }

  // Add message entries
  if (conversation) {
    for (const m of conversation) {
      entries.push({
        type: m.role === 'user' ? 'user_message' : 'assistant_message',
        ts: m.ts,
        text: m.text,
      });
    }
  }

  // Sort newest first (matching recentTools convention)
  entries.sort((a, b) => b.ts - a.ts);

  return entries;
}

module.exports = { buildTimeline };
