'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const STATE_DIR = path.join(os.homedir(), '.claude', 'agent-monitor', 'sessions');

const ADJECTIVES = [
  'swift', 'calm', 'bold', 'keen', 'warm',
  'bright', 'quick', 'sharp', 'cool', 'steady',
  'silent', 'vivid', 'noble', 'fierce', 'gentle',
  'loyal', 'proud', 'wise', 'brave', 'clear'
];

const NOUNS = [
  'falcon', 'river', 'hawk', 'wolf', 'pine',
  'tiger', 'cedar', 'flame', 'stone', 'crane',
  'eagle', 'brook', 'fox', 'oak', 'bear',
  'heron', 'spark', 'lynx', 'elm', 'orca'
];

/**
 * Read all of stdin and parse as JSON.
 * Returns parsed object or null on failure.
 */
function readStdin() {
  return new Promise((resolve) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => {
      try {
        resolve(JSON.parse(chunks.join('')));
      } catch {
        resolve(null);
      }
    });
    process.stdin.on('error', () => resolve(null));
  });
}

/**
 * Get the state directory path, creating it if needed.
 */
function getStateDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
  return STATE_DIR;
}

/**
 * Append a JSON event line to the session's JSONL file.
 */
function writeEvent(sessionId, event) {
  const dir = getStateDir();
  const filePath = path.join(dir, `${sessionId}.jsonl`);
  const line = JSON.stringify(event) + '\n';
  fs.appendFileSync(filePath, line, 'utf8');
}

/**
 * Generate a deterministic adjective-noun name from session ID.
 */
function getAgentName(sessionId) {
  const hash = crypto.createHash('md5').update(sessionId).digest();
  const adjIdx = hash[0] % ADJECTIVES.length;
  const nounIdx = hash[1] % NOUNS.length;
  return `${ADJECTIVES[adjIdx]}-${NOUNS[nounIdx]}`;
}

/**
 * Extract a short summary string from tool name and input.
 */
function summarizeTool(toolName, toolInput) {
  if (!toolInput) return toolName;

  switch (toolName) {
    case 'Bash': {
      const cmd = toolInput.command || '';
      return cmd.length > 50 ? cmd.slice(0, 50) + '...' : cmd;
    }
    case 'Edit':
    case 'Write':
    case 'Read': {
      const fp = toolInput.file_path || '';
      return path.basename(fp);
    }
    case 'Grep': {
      return toolInput.pattern || toolName;
    }
    case 'Glob': {
      return toolInput.pattern || toolName;
    }
    case 'Task': {
      return toolInput.description || toolName;
    }
    case 'WebSearch': {
      return toolInput.query || toolName;
    }
    case 'WebFetch': {
      return toolInput.url || toolName;
    }
    default:
      return toolName;
  }
}

module.exports = {
  readStdin,
  writeEvent,
  getAgentName,
  summarizeTool,
  getStateDir,
};
