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
  language: '',
  maxRecentTools: 10,
  notifications: false,
  groupByProject: false,
  archivePath: '',
  hideSelf: true,
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
      language: typeof parsed.language === 'string' ? parsed.language : DEFAULTS.language,
      maxRecentTools:
        typeof parsed.maxRecentTools === 'number' && parsed.maxRecentTools > 0
          ? parsed.maxRecentTools
          : DEFAULTS.maxRecentTools,
      notifications: typeof parsed.notifications === 'boolean' ? parsed.notifications : DEFAULTS.notifications,
      groupByProject: typeof parsed.groupByProject === 'boolean' ? parsed.groupByProject : DEFAULTS.groupByProject,
      archivePath: typeof parsed.archivePath === 'string' ? parsed.archivePath : DEFAULTS.archivePath,
      hideSelf: typeof parsed.hideSelf === 'boolean' ? parsed.hideSelf : DEFAULTS.hideSelf,
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
    language: config.language || '',
    maxRecentTools: config.maxRecentTools || DEFAULTS.maxRecentTools,
    notifications: !!config.notifications,
    groupByProject: !!config.groupByProject,
    archivePath: config.archivePath || '',
    hideSelf: config.hideSelf !== false,
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

module.exports = { loadConfig, saveConfig, DEFAULTS, PROVIDERS, CONFIG_PATH };
