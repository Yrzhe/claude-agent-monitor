'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const STATE_DIR = path.join(os.homedir(), '.claude', 'agent-monitor', 'sessions');
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Parse a single JSONL file into an array of event objects.
 */
function parseJsonlFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Derive session status from events.
 */
function deriveStatus(events, now) {
  if (events.length === 0) return 'unknown';

  const lastEvent = events[events.length - 1];
  const elapsed = now - new Date(lastEvent.ts).getTime();

  switch (lastEvent.event) {
    case 'session_end': return 'ended';
    case 'stop': return 'idle';
    case 'session_start':
      return elapsed >= STALE_THRESHOLD_MS ? 'stale' : 'idle';
    case 'tool_use':
      return elapsed >= STALE_THRESHOLD_MS ? 'stale' : 'active';
    default:
      return 'unknown';
  }
}

/**
 * Build a session summary from its events.
 * @param {Array} events - Array of parsed event objects.
 * @param {number} maxRecentTools - Max number of recent tool events to keep.
 */
function buildSession(events, maxRecentTools) {
  if (events.length === 0) return null;

  const max = maxRecentTools || 10;
  const now = Date.now();
  const startEvent = events.find((e) => e.event === 'session_start');
  const toolEvents = events.filter((e) => e.event === 'tool_use');
  const lastEvent = events[events.length - 1];
  const lastToolEvent = toolEvents[toolEvents.length - 1];

  // Build recentTools array (newest first, up to max)
  const recentTools = toolEvents
    .slice(-max)
    .reverse()
    .map((e) => ({
      toolName: e.tool_name || 'unknown',
      toolSummary: e.tool_summary || e.tool_name || 'unknown',
      toolDetail: e.tool_detail || '',
      ts: new Date(e.ts).getTime(),
    }));

  return {
    id: events[0].session_id,
    name: events[0].agent_name || 'unknown',
    cwd: startEvent ? startEvent.cwd : '',
    model: startEvent ? startEvent.model : 'unknown',
    status: deriveStatus(events, now),
    lastTool: lastToolEvent
      ? `${lastToolEvent.tool_name} ${lastToolEvent.tool_summary}`
      : null,
    recentTools,
    lastEventAt: new Date(lastEvent.ts).getTime(),
    toolCount: toolEvents.length,
  };
}

/**
 * Load all sessions from the state directory.
 * Returns array of session objects sorted by last event time (most recent first).
 * @param {object} config - Config object with maxRecentTools.
 */
function loadAllSessions(config) {
  if (!fs.existsSync(STATE_DIR)) {
    return [];
  }

  const maxRecentTools = (config && config.maxRecentTools) || 10;
  const files = fs.readdirSync(STATE_DIR).filter((f) => f.endsWith('.jsonl'));

  return files
    .map((file) => {
      const events = parseJsonlFile(path.join(STATE_DIR, file));
      return buildSession(events, maxRecentTools);
    })
    .filter(Boolean)
    // Hide ghost sessions: stale/ended with zero tool events
    .filter((s) => s.toolCount > 0 || s.status === 'active' || s.status === 'idle')
    .sort((a, b) => b.lastEventAt - a.lastEventAt);
}

/**
 * Remove JSONL files for inactive sessions (ended or stale).
 * Sessions with status 'ended' or 'stale' are no longer doing useful work.
 */
function clearEndedSessions() {
  if (!fs.existsSync(STATE_DIR)) return 0;

  const files = fs.readdirSync(STATE_DIR).filter((f) => f.endsWith('.jsonl'));
  let cleared = 0;

  for (const file of files) {
    const events = parseJsonlFile(path.join(STATE_DIR, file));
    const session = buildSession(events);
    if (session && (session.status === 'ended' || session.status === 'stale')) {
      try {
        fs.unlinkSync(path.join(STATE_DIR, file));
        cleared++;
      } catch {
        // File may have been already removed
      }
    }
  }

  return cleared;
}

module.exports = { loadAllSessions, clearEndedSessions };
