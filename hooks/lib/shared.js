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

/**
 * Extract a longer detail string from tool name and input (up to 200 chars).
 * Provides richer context than summarizeTool for panel display.
 */
function detailTool(toolName, toolInput) {
  if (!toolInput) return toolName;

  const cap = (str, max) =>
    str.length > max ? str.slice(0, max - 1) + '\u2026' : str;

  switch (toolName) {
    case 'Bash': {
      const cmd = toolInput.command || '';
      const desc = toolInput.description || '';
      if (desc) return cap(`${desc} — ${cmd}`, 200);
      return cap(cmd, 200);
    }
    case 'Edit': {
      const fp = toolInput.file_path || '';
      const rel = fp.split('/').slice(-3).join('/');
      const old = (toolInput.old_string || '').split('\n')[0];
      if (old) return cap(`${rel}: replacing "${old}"`, 200);
      return cap(rel, 200);
    }
    case 'Write': {
      const fp = toolInput.file_path || '';
      const rel = fp.split('/').slice(-3).join('/');
      return cap(`Writing ${rel}`, 200);
    }
    case 'Read': {
      const fp = toolInput.file_path || '';
      const rel = fp.split('/').slice(-3).join('/');
      const offset = toolInput.offset ? ` from line ${toolInput.offset}` : '';
      return cap(`Reading ${rel}${offset}`, 200);
    }
    case 'Grep': {
      const pat = toolInput.pattern || '';
      const p = toolInput.path || '';
      const dir = p ? path.basename(p) : 'cwd';
      return cap(`Searching "${pat}" in ${dir}`, 200);
    }
    case 'Glob': {
      const pat = toolInput.pattern || '';
      const p = toolInput.path || '';
      const dir = p ? path.basename(p) : 'cwd';
      return cap(`Finding ${pat} in ${dir}`, 200);
    }
    case 'Task': {
      const desc = toolInput.description || '';
      const type = toolInput.subagent_type || '';
      if (type) return cap(`[${type}] ${desc}`, 200);
      return cap(desc, 200);
    }
    case 'WebSearch': {
      return cap(`Searching web: "${toolInput.query || ''}"`, 200);
    }
    case 'WebFetch': {
      const prompt = toolInput.prompt || '';
      const url = toolInput.url || '';
      if (prompt) return cap(`Fetching ${url} — ${prompt}`, 200);
      return cap(`Fetching ${url}`, 200);
    }
    default:
      return toolName;
  }
}

/**
 * Extract a brief summary of the tool result (up to 150 chars).
 * Handles string results and common object shapes.
 */
function briefResult(result) {
  if (!result) return '';

  let text = '';
  if (typeof result === 'string') {
    text = result;
  } else if (typeof result === 'object') {
    // Some tools return { content: "..." } or { output: "..." }
    text = result.content || result.output || result.text || JSON.stringify(result);
  } else {
    text = String(result);
  }

  // Collapse whitespace and truncate
  text = text.replace(/\s+/g, ' ').trim();
  if (text.length > 150) {
    return text.slice(0, 147) + '...';
  }
  return text;
}

module.exports = {
  readStdin,
  writeEvent,
  getAgentName,
  summarizeTool,
  detailTool,
  briefResult,
  getStateDir,
};
