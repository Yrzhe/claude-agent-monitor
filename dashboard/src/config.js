'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(os.homedir(), '.claude', 'agent-monitor', 'config.json');

const DEFAULTS = {
  apiKey: '',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-haiku-4-5-20251001',
  maxRecentTools: 10,
};

/**
 * Load config from ~/.claude/agent-monitor/config.json.
 * All fields optional. Returns defaults on missing/malformed file.
 */
function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : DEFAULTS.apiKey,
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : DEFAULTS.baseUrl,
      model: typeof parsed.model === 'string' ? parsed.model : DEFAULTS.model,
      maxRecentTools:
        typeof parsed.maxRecentTools === 'number' && parsed.maxRecentTools > 0
          ? parsed.maxRecentTools
          : DEFAULTS.maxRecentTools,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

module.exports = { loadConfig, DEFAULTS, CONFIG_PATH };
