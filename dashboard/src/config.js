'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_PATH = path.join(os.homedir(), '.claude', 'agent-monitor', 'config.json');

const PROVIDERS = {
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-haiku-4-5-20251001', 'claude-sonnet-4-5-20250929'],
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o'],
  },
  custom: {
    baseUrl: '',
    models: [],
  },
};

const DEFAULTS = {
  provider: 'anthropic',
  apiKey: '',
  baseUrl: PROVIDERS.anthropic.baseUrl,
  model: PROVIDERS.anthropic.models[0],
  maxRecentTools: 10,
};

/**
 * Load config from ~/.claude/agent-monitor/config.json.
 * All fields optional. Returns defaults on missing/malformed file.
 * Backward compat: old configs without `provider` field default to 'anthropic'.
 */
function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      provider: typeof parsed.provider === 'string' ? parsed.provider : DEFAULTS.provider,
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

/**
 * Save config to ~/.claude/agent-monitor/config.json.
 * Creates directory if needed.
 */
function saveConfig(config) {
  const dir = path.dirname(CONFIG_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const data = {
    provider: config.provider || DEFAULTS.provider,
    apiKey: config.apiKey || '',
    baseUrl: config.baseUrl || DEFAULTS.baseUrl,
    model: config.model || DEFAULTS.model,
    maxRecentTools: config.maxRecentTools || DEFAULTS.maxRecentTools,
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

module.exports = { loadConfig, saveConfig, DEFAULTS, PROVIDERS, CONFIG_PATH };
