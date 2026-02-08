'use strict';

const https = require('https');
const http = require('http');
const url = require('url');

const DEBOUNCE_MS = 30000; // 30 seconds between API calls per session
const REQUEST_TIMEOUT_MS = 10000; // 10 second timeout

/**
 * Generate a rule-based summary from recent tools.
 * Always available, no API key needed.
 */
function ruleSummary(session) {
  const tools = session.recentTools || [];
  if (tools.length === 0) {
    switch (session.status) {
      case 'idle': return 'Waiting for input';
      case 'stale': return 'Inactive for 5+ minutes';
      case 'ended': return 'Session ended';
      default: return 'Starting up';
    }
  }

  // Group tools by type
  const groups = {};
  for (const t of tools) {
    const name = t.toolName;
    if (!groups[name]) groups[name] = [];
    groups[name].push(t);
  }

  const parts = [];

  // File operations
  const editFiles = (groups['Edit'] || []).map((t) => t.toolSummary);
  const writeFiles = (groups['Write'] || []).map((t) => t.toolSummary);
  const readFiles = (groups['Read'] || []).map((t) => t.toolSummary);
  const allEditedFiles = [...new Set([...editFiles, ...writeFiles])];

  if (allEditedFiles.length > 0) {
    const fileList = allEditedFiles.slice(0, 3).join(', ');
    const extra = allEditedFiles.length > 3 ? ` +${allEditedFiles.length - 3}` : '';
    parts.push(`Editing ${allEditedFiles.length} file${allEditedFiles.length > 1 ? 's' : ''} (${fileList}${extra})`);
  }

  if (readFiles.length > 0 && allEditedFiles.length === 0) {
    const fileList = [...new Set(readFiles)].slice(0, 3).join(', ');
    parts.push(`Reading ${fileList}`);
  }

  // Bash commands
  const bashCmds = groups['Bash'] || [];
  if (bashCmds.length > 0) {
    parts.push(`ran ${bashCmds.length} command${bashCmds.length > 1 ? 's' : ''}`);
  }

  // Search operations
  const greps = groups['Grep'] || [];
  const globs = groups['Glob'] || [];
  const searches = greps.length + globs.length;
  if (searches > 0) {
    parts.push(`${searches} search${searches > 1 ? 'es' : ''}`);
  }

  // Task/agent operations
  const tasks = groups['Task'] || [];
  if (tasks.length > 0) {
    parts.push(`${tasks.length} sub-agent${tasks.length > 1 ? 's' : ''}`);
  }

  // Web operations
  const webSearches = groups['WebSearch'] || [];
  const webFetches = groups['WebFetch'] || [];
  const webOps = webSearches.length + webFetches.length;
  if (webOps > 0) {
    parts.push(`${webOps} web request${webOps > 1 ? 's' : ''}`);
  }

  if (parts.length === 0) {
    return `Using ${Object.keys(groups).join(', ')}`;
  }

  // Capitalize first part
  const result = parts.join(', ');
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Call Anthropic API to generate an AI summary.
 * Returns a promise that resolves with summary text or null on failure.
 */
function callAnthropicApi(config, session) {
  return new Promise((resolve) => {
    const tools = (session.recentTools || []).slice(0, 10);
    const toolList = tools
      .map((t) => `- ${t.toolName}: ${t.toolDetail || t.toolSummary}`)
      .join('\n');

    const prompt = `You are summarizing what a coding agent is doing. Given these recent tool calls for agent "${session.name}" working in project "${session.cwd}":\n\n${toolList}\n\nWrite a 1-2 sentence summary of what the agent is currently doing. Be concise and specific. No markdown.`;

    const body = JSON.stringify({
      model: config.model,
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    });

    const parsed = url.parse(config.baseUrl);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: REQUEST_TIMEOUT_MS,
    };

    const req = mod.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          if (data.content && data.content[0] && data.content[0].text) {
            resolve(data.content[0].text.trim());
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.write(body);
    req.end();
  });
}

/**
 * SummaryManager — caches and debounces summaries per session.
 * Uses rule-based fallback, optional AI via Anthropic API.
 */
class SummaryManager {
  constructor(config) {
    this._config = config;
    this._cache = {}; // sessionId -> { text, toolCount, ts }
    this._pending = new Set(); // sessionIds with in-flight API calls
    this.onUpdate = null; // callback when async summary arrives
  }

  /**
   * Get summary for a session (sync). Returns cached AI summary or rule-based.
   * Triggers async API call if needed.
   */
  getSummary(session) {
    const id = session.id;
    const cached = this._cache[id];
    const now = Date.now();

    // Return cached if still valid
    if (cached && cached.toolCount === session.toolCount) {
      return cached.text;
    }

    // Trigger async AI refresh if API key is configured
    if (
      this._config.apiKey &&
      !this._pending.has(id) &&
      (!cached || now - cached.ts >= DEBOUNCE_MS)
    ) {
      this._refreshSummary(session);
    }

    // Return rule-based immediately (or stale cached text while AI loads)
    if (cached && cached.text) return cached.text;
    return ruleSummary(session);
  }

  /**
   * Async: call API and update cache.
   */
  _refreshSummary(session) {
    const id = session.id;
    this._pending.add(id);

    callAnthropicApi(this._config, session)
      .then((text) => {
        this._pending.delete(id);
        if (text) {
          this._cache[id] = {
            text,
            toolCount: session.toolCount,
            ts: Date.now(),
          };
        } else {
          // API failed, cache rule-based
          this._cache[id] = {
            text: ruleSummary(session),
            toolCount: session.toolCount,
            ts: Date.now(),
          };
        }
        if (this.onUpdate) this.onUpdate();
      })
      .catch(() => {
        this._pending.delete(id);
        this._cache[id] = {
          text: ruleSummary(session),
          toolCount: session.toolCount,
          ts: Date.now(),
        };
        if (this.onUpdate) this.onUpdate();
      });
  }
}

module.exports = { SummaryManager, ruleSummary };
