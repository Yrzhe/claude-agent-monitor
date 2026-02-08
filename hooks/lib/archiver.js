'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(os.homedir(), '.claude', 'agent-monitor', 'config.json');
const MAP_PATH = path.join(os.homedir(), '.claude', 'agent-monitor', 'archive-map.json');

/**
 * Read archivePath from config.json (lightweight, no dashboard imports).
 * Returns empty string if not configured.
 */
function getArchiveBasePath() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    let archivePath = (parsed.archivePath || '').trim();
    if (!archivePath) return '';
    // Strip wrapping quotes (single or double) that may have been saved by mistake
    if (
      (archivePath.startsWith("'") && archivePath.endsWith("'")) ||
      (archivePath.startsWith('"') && archivePath.endsWith('"'))
    ) {
      archivePath = archivePath.slice(1, -1);
    }
    // Expand ~ to home directory
    if (archivePath.startsWith('~')) {
      return path.join(os.homedir(), archivePath.slice(1));
    }
    return archivePath;
  } catch {
    return '';
  }
}

/**
 * Compute the archive file path for a session.
 * Format: <basePath>/YYYY/MM/YYYY-MM-DD-<first 8 chars of sessionId>.jsonl
 * @param {string} basePath - The archive base directory
 * @param {string} sessionId - The session ID
 * @param {Date} [date] - The date to use (defaults to now)
 * @returns {string} Full path to the archive file
 */
function computeArchivePath(basePath, sessionId, date) {
  const d = date || new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const shortId = sessionId.replace(/-/g, '').slice(0, 8);
  const filename = `${yyyy}-${mm}-${dd}-${shortId}.jsonl`;
  return path.join(basePath, yyyy, mm, filename);
}

/**
 * Append a JSON entry to an archive file.
 * Creates directories as needed. Silent on failure.
 * @param {string} filePath - Full path to the archive JSONL file
 * @param {object} entry - The event object to append
 */
function appendToArchive(filePath, entry) {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(filePath, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // Silent failure — never disrupt hooks
  }
}

/**
 * Load the archive mapping file.
 * Returns { sessionId: archiveFilePath } or empty object on failure.
 */
function loadMap() {
  try {
    const raw = fs.readFileSync(MAP_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Save the archive mapping file atomically.
 * Uses write-to-tmp + rename to avoid corruption from concurrent hook processes.
 */
function saveMap(map) {
  try {
    const dir = path.dirname(MAP_PATH);
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = MAP_PATH + '.tmp.' + process.pid;
    fs.writeFileSync(tmpPath, JSON.stringify(map, null, 2) + '\n', 'utf8');
    fs.renameSync(tmpPath, MAP_PATH);
  } catch {
    // Silent failure
  }
}

/**
 * Initialize an archive file for a new session.
 * Creates the file, writes metadata + session_start, and saves the mapping.
 * @param {string} basePath - The archive base directory
 * @param {object} sessionStartEvent - The session_start event object
 */
function initArchive(basePath, sessionStartEvent) {
  if (!basePath) return;

  try {
    const sessionId = sessionStartEvent.session_id;
    const filePath = computeArchivePath(basePath, sessionId, new Date(sessionStartEvent.ts));

    // Write archive metadata
    appendToArchive(filePath, {
      ts: sessionStartEvent.ts,
      event: 'archive_metadata',
      session_id: sessionId,
      agent_name: sessionStartEvent.agent_name || '',
      model: sessionStartEvent.model || 'unknown',
      cwd: sessionStartEvent.cwd || '',
      archive_version: 1,
    });

    // Write the session_start event
    appendToArchive(filePath, sessionStartEvent);

    // Save mapping (re-read immediately before write to minimize race window)
    const map = loadMap();
    const updatedMap = { ...map, [sessionId]: filePath };
    saveMap(updatedMap);
  } catch {
    // Silent failure
  }
}

/**
 * Resolve the archive file path for an existing session.
 * Reads archive-map.json to find the file regardless of date.
 * @param {string} basePath - The archive base directory (unused but kept for API consistency)
 * @param {string} sessionId - The session ID
 * @returns {string|null} The archive file path, or null if not found
 */
function resolveArchivePath(basePath, sessionId) {
  const map = loadMap();
  return map[sessionId] || null;
}

/**
 * Append an event to an existing session's archive file.
 * Resolves the file path via the mapping, then appends.
 * No-op if archive is not configured or session has no mapping.
 * @param {string} sessionId - The session ID
 * @param {object} event - The event object to append
 */
function archiveEvent(sessionId, event) {
  const basePath = getArchiveBasePath();
  if (!basePath) return;

  const filePath = resolveArchivePath(basePath, sessionId);
  if (!filePath) return;

  appendToArchive(filePath, event);
}

module.exports = {
  getArchiveBasePath,
  computeArchivePath,
  appendToArchive,
  initArchive,
  resolveArchivePath,
  archiveEvent,
};
