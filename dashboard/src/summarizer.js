'use strict';

const https = require('https');
const http = require('http');
const url = require('url');

const DEBOUNCE_MS = 10000; // 10 seconds between API calls per session
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
 * Build the prompt for AI summary.
 */
function buildPrompt(config, session) {
  const tools = (session.recentTools || []).slice(0, 10);
  const toolList = tools
    .map((t) => {
      const base = `- ${t.toolName}: ${t.toolDetail || t.toolSummary}`;
      if (t.toolResultBrief) {
        return `${base}\n  Result: ${t.toolResultBrief}`;
      }
      return base;
    })
    .join('\n');

  // Include recent conversation messages for context
  const messages = (session.conversation || []).slice(-5);
  const msgSection = messages.length > 0
    ? '\n\nRecent conversation:\n' + messages.map((m) => {
        const prefix = m.role === 'user' ? 'User' : 'Assistant';
        const text = (m.text || '').slice(0, 200);
        return `- ${prefix}: ${text}`;
      }).join('\n')
    : '';

  const langInstruction = config.language
    ? ` Respond in ${config.language}.`
    : '';

  return `You are summarizing what a coding agent is doing. Given these recent tool calls for agent "${session.name}" working in project "${session.cwd}":\n\n${toolList}${msgSection}\n\nWrite a 1-2 sentence summary of what the agent is currently doing. Be concise and specific. No markdown.${langInstruction}`;
}

/**
 * Call API to generate an AI summary.
 * Detects provider from config to use Anthropic or OpenAI-compatible format.
 * Returns a promise that resolves with summary text or null on failure.
 */
function callApi(config, session) {
  return new Promise((resolve) => {
    const prompt = buildPrompt(config, session);
    const isAnthropic = config.provider === 'anthropic';

    const body = JSON.stringify({
      model: config.model,
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    });

    const parsed = url.parse(config.baseUrl);
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    // Anthropic uses /messages, others use /chat/completions
    const apiPath = isAnthropic ? '/v1/messages' : '/v1/chat/completions';
    // Strip trailing /v1 from baseUrl if present, since we add it in apiPath
    let basePath = parsed.path || '';
    if (basePath.endsWith('/v1')) basePath = basePath.slice(0, -3);
    if (basePath.endsWith('/v1/')) basePath = basePath.slice(0, -4);

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };

    if (isAnthropic) {
      headers['x-api-key'] = config.apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: basePath + apiPath,
      method: 'POST',
      headers,
      timeout: REQUEST_TIMEOUT_MS,
    };

    const req = mod.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          if (isAnthropic) {
            // Anthropic format: content[0].text
            if (data.content && data.content[0] && data.content[0].text) {
              resolve(data.content[0].text.trim());
            } else {
              resolve(null);
            }
          } else {
            // OpenAI format: choices[0].message.content
            if (data.choices && data.choices[0] && data.choices[0].message) {
              resolve(data.choices[0].message.content.trim());
            } else {
              resolve(null);
            }
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
 * Uses rule-based fallback, optional AI via configurable provider.
 */
class SummaryManager {
  constructor(config) {
    this._config = config;
    this._cache = {}; // sessionId -> { text, toolCount, ts }
    this._pending = new Set(); // sessionIds with in-flight API calls
    this.onUpdate = null; // callback when async summary arrives
  }

  /**
   * Update config (e.g. after setup changes).
   */
  updateConfig(config) {
    this._config = config;
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

    callApi(this._config, session)
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
