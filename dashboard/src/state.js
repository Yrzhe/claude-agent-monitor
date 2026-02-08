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
 */
function buildSession(events) {
  if (events.length === 0) return null;

  const now = Date.now();
  const startEvent = events.find((e) => e.event === 'session_start');
  const toolEvents = events.filter((e) => e.event === 'tool_use');
  const lastEvent = events[events.length - 1];
  const lastToolEvent = toolEvents[toolEvents.length - 1];

  return {
    id: events[0].session_id,
    name: events[0].agent_name || 'unknown',
    cwd: startEvent ? startEvent.cwd : '',
    model: startEvent ? startEvent.model : 'unknown',
    status: deriveStatus(events, now),
    lastTool: lastToolEvent
      ? `${lastToolEvent.tool_name} ${lastToolEvent.tool_summary}`
      : null,
    lastEventAt: new Date(lastEvent.ts).getTime(),
    toolCount: toolEvents.length,
  };
}

/**
 * Load all sessions from the state directory.
 * Returns array of session objects sorted by last event time (most recent first).
 */
function loadAllSessions() {
  if (!fs.existsSync(STATE_DIR)) {
    return [];
  }

  const files = fs.readdirSync(STATE_DIR).filter((f) => f.endsWith('.jsonl'));

  return files
    .map((file) => {
      const events = parseJsonlFile(path.join(STATE_DIR, file));
      return buildSession(events);
    })
    .filter(Boolean)
    .sort((a, b) => b.lastEventAt - a.lastEventAt);
}

/**
 * Remove JSONL files for ended sessions.
 */
function clearEndedSessions() {
  if (!fs.existsSync(STATE_DIR)) return 0;

  const files = fs.readdirSync(STATE_DIR).filter((f) => f.endsWith('.jsonl'));
  let cleared = 0;

  for (const file of files) {
    const events = parseJsonlFile(path.join(STATE_DIR, file));
    const session = buildSession(events);
    if (session && session.status === 'ended') {
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
