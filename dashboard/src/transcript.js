'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

// Cache: sessionId -> { messages, mtime }
const _cache = {};

/**
 * Encode a project path to the format Claude Code uses for project directories.
 * e.g., "/Users/foo/bar" → "-Users-foo-bar"
 */
function encodeProjectPath(cwd) {
  if (!cwd) return '';
  return cwd.replace(/\//g, '-');
}

/**
 * Find the Claude Code transcript file for a given session.
 * Looks in ~/.claude/projects/<encoded-path>/<sessionId>.jsonl
 * @param {string} sessionId - The session UUID.
 * @param {string} cwd - The working directory of the session.
 * @returns {string|null} Path to the transcript file, or null if not found.
 */
function findTranscriptFile(sessionId, cwd) {
  if (!sessionId) return null;

  // Try the encoded project path first
  if (cwd) {
    const encoded = encodeProjectPath(cwd);
    const candidate = path.join(CLAUDE_PROJECTS_DIR, encoded, `${sessionId}.jsonl`);
    if (fs.existsSync(candidate)) return candidate;
  }

  // Fallback: scan all project directories for the session file
  try {
    const dirs = fs.readdirSync(CLAUDE_PROJECTS_DIR);
    for (const dir of dirs) {
      const candidate = path.join(CLAUDE_PROJECTS_DIR, dir, `${sessionId}.jsonl`);
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch {
    // Projects dir may not exist
  }

  return null;
}

/**
 * Extract user/assistant messages from a Claude Code transcript file.
 * @param {string} filePath - Path to the JSONL transcript.
 * @param {number} max - Maximum number of recent messages to return.
 * @returns {Array<{role: string, text: string, ts: number}>}
 */
function extractMessages(filePath, max) {
  const limit = max || 20;

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim());
    const messages = [];

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        const type = obj.type;

        if (type !== 'user' && type !== 'assistant') continue;

        const msg = obj.message;
        if (!msg) continue;

        const role = msg.role;
        const ts = obj.timestamp ? new Date(obj.timestamp).getTime() : 0;

        // Extract text content
        let text = '';
        if (typeof msg.content === 'string') {
          text = msg.content;
        } else if (Array.isArray(msg.content)) {
          // Assistant messages have content as array of {type, text/thinking/tool_use}
          const textParts = msg.content
            .filter((c) => c.type === 'text' && c.text && c.text.trim())
            .map((c) => c.text.trim());
          text = textParts.join(' ');
        }

        // Skip empty messages, tool results, and pure tool_use messages
        if (!text) continue;

        // For user messages that are tool_results, skip them
        if (typeof msg.content === 'object' && !Array.isArray(msg.content) && msg.content.type === 'tool_result') {
          continue;
        }
        if (Array.isArray(msg.content) && msg.content.length > 0 && msg.content[0].type === 'tool_result') {
          continue;
        }

        // Truncate very long messages
        if (text.length > 300) {
          text = text.slice(0, 297) + '...';
        }

        messages.push({ role, text, ts });
      } catch {
        // Skip malformed lines
      }
    }

    // Return the most recent N messages
    return messages.slice(-limit);
  } catch {
    return [];
  }
}

/**
 * Load conversation for a session, with mtime-based caching.
 * @param {string} sessionId - The session UUID.
 * @param {string} cwd - The working directory.
 * @returns {Array<{role: string, text: string, ts: number}>}
 */
function loadConversation(sessionId, cwd) {
  const filePath = findTranscriptFile(sessionId, cwd);
  if (!filePath) return [];

  try {
    const stat = fs.statSync(filePath);
    const mtime = stat.mtimeMs;

    // Return cached if file hasn't changed
    const cached = _cache[sessionId];
    if (cached && cached.mtime === mtime) {
      return cached.messages;
    }

    const messages = extractMessages(filePath, 20);
    _cache[sessionId] = { messages, mtime };
    return messages;
  } catch {
    return [];
  }
}

module.exports = { encodeProjectPath, findTranscriptFile, extractMessages, loadConversation };
