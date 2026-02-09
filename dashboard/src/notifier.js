'use strict';

const { execSync } = require('child_process');
const os = require('os');

/**
 * Send a macOS desktop notification via osascript.
 * No-op on non-macOS platforms.
 * @param {string} title - Notification title.
 * @param {string} message - Notification body text.
 */
function notify(title, message) {
  if (os.platform() !== 'darwin') return;

  try {
    // Escape double quotes and backslashes for AppleScript
    const safeTitle = (title || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const safeMsg = (message || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    execSync(
      `osascript -e 'display notification "${safeMsg}" with title "${safeTitle}"'`,
      { timeout: 3000, stdio: 'ignore' }
    );
  } catch {
    // Notification failed — non-critical, ignore
  }
}

/**
 * Detect meaningful session transitions between two snapshots.
 * Returns an array of {type, session} objects for transitions that warrant notification.
 *
 * Detectable transitions:
 * - session_end: A session that was active/idle is now ended
 * - became_idle: A session that was active is now idle (agent stopped responding)
 * - became_stale: A session that was active is now stale (5+ min unresponsive)
 * - new_tool_activity: A session gained new tool usage
 * - new_messages: A session has new conversation messages
 *
 * @param {Array} prev - Previous sessions array.
 * @param {Array} current - Current sessions array.
 * @returns {Array<{type: string, session: object}>}
 */
function detectTransitions(prev, current) {
  const transitions = [];
  if (!prev || !current) return transitions;

  const prevMap = new Map();
  for (const s of prev) {
    prevMap.set(s.id, s);
  }

  for (const cur of current) {
    const old = prevMap.get(cur.id);
    if (!old) continue;

    // Active/idle → ended
    if (
      (old.status === 'active' || old.status === 'idle') &&
      cur.status === 'ended'
    ) {
      transitions.push({ type: 'session_end', session: cur });
    }

    // Active → idle (agent stopped)
    if (old.status === 'active' && cur.status === 'idle') {
      transitions.push({ type: 'became_idle', session: cur });
    }

    // Active → stale (agent unresponsive)
    if (old.status === 'active' && cur.status === 'stale') {
      transitions.push({ type: 'became_stale', session: cur });
    }

    // New tool activity (toolCount increased)
    if (cur.toolCount > old.toolCount) {
      const lastTool = (cur.recentTools && cur.recentTools[0])
        ? cur.recentTools[0].toolName
        : 'tool';
      transitions.push({ type: 'new_tool_activity', session: cur, detail: lastTool });
    }

    // New conversation messages (messageCount increased)
    if ((cur.messageCount || 0) > (old.messageCount || 0)) {
      transitions.push({ type: 'new_messages', session: cur });
    }
  }

  return transitions;
}

module.exports = { notify, detectTransitions };
