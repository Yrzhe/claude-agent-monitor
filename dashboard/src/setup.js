'use strict';

const os = require('os');
const path = require('path');
const { PROVIDERS, DEFAULTS } = require('./config');

// ANSI codes (matching renderer.js style)
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const GRAY = '\x1b[90m';

const BOX = {
  tl: '\u250c', tr: '\u2510', bl: '\u2514', br: '\u2518',
  h: '\u2500', v: '\u2502',
};

// Setup flow steps
const STEP_PROVIDER = 0;
const STEP_API_KEY = 1;
const STEP_BASE_URL = 2;
const STEP_MODEL = 3;
const STEP_LANGUAGE = 4;
const STEP_ARCHIVE_PATH = 5;

const PROVIDER_NAMES = ['anthropic', 'openai', 'custom'];

/**
 * Create initial setup state from existing config.
 */
function createSetupState(existingConfig) {
  const cfg = existingConfig || {};
  return {
    step: STEP_PROVIDER,
    provider: cfg.provider || DEFAULTS.provider,
    apiKey: cfg.apiKey || '',
    baseUrl: cfg.baseUrl || DEFAULTS.baseUrl,
    model: cfg.model || DEFAULTS.model,
    language: cfg.language || '',
    archivePath: cfg.archivePath || '',
    // Track if baseUrl/model were manually edited (vs auto-filled from provider)
    baseUrlEdited: false,
    modelEdited: false,
  };
}

/**
 * Mask an API key for display: show first 7 + last 4, mask the rest.
 */
function maskApiKey(key) {
  if (!key) return '';
  if (key.length <= 12) return '*'.repeat(key.length);
  return key.slice(0, 7) + '*'.repeat(key.length - 11) + key.slice(-4);
}

/**
 * Render the setup screen to a string.
 */
function renderSetupScreen(state) {
  const cols = process.stdout.columns || 80;
  const innerWidth = Math.min(60, cols - 4);
  const totalWidth = innerWidth + 2;

  const lines = [];

  function hLine(left, right) {
    return `${CYAN}${left}${BOX.h.repeat(totalWidth)}${right}${RESET}`;
  }

  function contentLine(content) {
    const stripped = content.replace(/\x1b\[[0-9;]*m/g, '');
    const pad = Math.max(0, innerWidth - stripped.length);
    return `${CYAN}${BOX.v}${RESET} ${content}${' '.repeat(pad)} ${CYAN}${BOX.v}${RESET}`;
  }

  function emptyLine() {
    return `${CYAN}${BOX.v}${RESET}${' '.repeat(totalWidth)}${CYAN}${BOX.v}${RESET}`;
  }

  // Top border with title
  const title = ' CLAUDE AGENT MONITOR \u2500 Setup ';
  const titlePad = Math.max(0, totalWidth - title.length);
  lines.push(`${CYAN}${BOX.tl}${title}${BOX.h.repeat(titlePad)}${BOX.tr}${RESET}`);

  lines.push(emptyLine());
  lines.push(contentLine(`${DIM}AI summaries require an API key.${RESET}`));
  lines.push(emptyLine());

  // Provider selection
  const providerLabel = state.step === STEP_PROVIDER
    ? `${WHITE}${BOLD}Provider:${RESET}`
    : `${DIM}Provider:${RESET}`;
  lines.push(contentLine(providerLabel));

  const providerOptions = PROVIDER_NAMES.map((name, i) => {
    const num = i + 1;
    const isSelected = name === state.provider;
    if (isSelected) {
      return `${GREEN}[${num}] ${name}${RESET}`;
    }
    return `${DIM}[${num}] ${name}${RESET}`;
  });
  const providerLine = `  ${providerOptions.join('  ')}`;
  lines.push(contentLine(providerLine));

  lines.push(emptyLine());

  // API Key
  const keyLabel = state.step === STEP_API_KEY
    ? `${WHITE}${BOLD}API Key:${RESET}`
    : `${DIM}API Key:${RESET}`;
  const keyDisplay = state.step === STEP_API_KEY
    ? `${maskApiKey(state.apiKey)}${YELLOW}\u2588${RESET}`
    : (state.apiKey ? maskApiKey(state.apiKey) : `${DIM}(not set)${RESET}`);
  lines.push(contentLine(`${keyLabel} ${keyDisplay}`));

  // Base URL
  const urlLabel = state.step === STEP_BASE_URL
    ? `${WHITE}${BOLD}Base URL:${RESET}`
    : `${DIM}Base URL:${RESET}`;
  const providerPreset = PROVIDERS[state.provider];
  const urlDefault = providerPreset ? providerPreset.baseUrl : '';
  const urlSuffix = state.step === STEP_BASE_URL ? `${YELLOW}\u2588${RESET}` : '';
  const urlDefaultHint = (state.step === STEP_BASE_URL && !state.baseUrlEdited && urlDefault)
    ? ` ${DIM}(default)${RESET}`
    : '';
  lines.push(contentLine(`${urlLabel} ${state.baseUrl}${urlSuffix}${urlDefaultHint}`));

  // Model
  const modelLabel = state.step === STEP_MODEL
    ? `${WHITE}${BOLD}Model:${RESET}`
    : `${DIM}Model:${RESET}`;
  const modelDefault = (providerPreset && providerPreset.models[0]) || '';
  const modelSuffix = state.step === STEP_MODEL ? `${YELLOW}\u2588${RESET}` : '';
  const modelDefaultHint = (state.step === STEP_MODEL && !state.modelEdited && modelDefault)
    ? ` ${DIM}(default)${RESET}`
    : '';
  lines.push(contentLine(`${modelLabel} ${state.model}${modelSuffix}${modelDefaultHint}`));

  // Language
  const langLabel = state.step === STEP_LANGUAGE
    ? `${WHITE}${BOLD}Language:${RESET}`
    : `${DIM}Language:${RESET}`;
  const langSuffix = state.step === STEP_LANGUAGE ? `${YELLOW}\u2588${RESET}` : '';
  const langHint = (state.step === STEP_LANGUAGE && !state.language)
    ? ` ${DIM}(e.g. English, 中文, 日本語)${RESET}`
    : '';
  const langValue = state.language || (state.step !== STEP_LANGUAGE ? `${DIM}(auto)${RESET}` : '');
  lines.push(contentLine(`${langLabel} ${langValue}${langSuffix}${langHint}`));

  // Archive path
  const archiveLabel = state.step === STEP_ARCHIVE_PATH
    ? `${WHITE}${BOLD}Archive:${RESET}`
    : `${DIM}Archive:${RESET}`;
  const archiveSuffix = state.step === STEP_ARCHIVE_PATH ? `${YELLOW}\u2588${RESET}` : '';
  const archiveHint = (state.step === STEP_ARCHIVE_PATH && !state.archivePath)
    ? ` ${DIM}(e.g. ~/claude-archives)${RESET}`
    : '';
  const archiveValue = state.archivePath || (state.step !== STEP_ARCHIVE_PATH ? `${DIM}(disabled)${RESET}` : '');
  lines.push(contentLine(`${archiveLabel} ${archiveValue}${archiveSuffix}${archiveHint}`));

  lines.push(emptyLine());

  // Footer actions
  const actions = state.step === STEP_PROVIDER
    ? `${DIM}[1/2/3] Select provider  [Esc] Skip${RESET}`
    : `${DIM}[Enter] Next  [Esc] Skip${RESET}`;
  lines.push(contentLine(actions));

  lines.push(emptyLine());

  // Bottom border
  lines.push(hLine(BOX.bl, BOX.br));

  return lines.join('\n');
}

/**
 * Handle a keypress in the setup flow.
 * Returns { state, result } where result is 'continue' | 'done' | 'skip'.
 * 'done' = save config, 'skip' = user cancelled.
 */
function handleSetupKey(key, state) {
  // Esc at any point → skip
  if (key === '\x1b') {
    return { state, result: 'skip' };
  }

  if (state.step === STEP_PROVIDER) {
    if (key === '1' || key === '2' || key === '3') {
      const idx = parseInt(key, 10) - 1;
      const providerName = PROVIDER_NAMES[idx];
      const preset = PROVIDERS[providerName];
      return {
        state: {
          ...state,
          provider: providerName,
          baseUrl: preset.baseUrl,
          model: preset.models[0] || '',
          baseUrlEdited: false,
          modelEdited: false,
          step: STEP_API_KEY,
        },
        result: 'continue',
      };
    }
    // Enter on provider step → advance to API key with current provider
    if (key === '\r' || key === '\n') {
      return {
        state: { ...state, step: STEP_API_KEY },
        result: 'continue',
      };
    }
    return { state, result: 'continue' };
  }

  if (state.step === STEP_API_KEY) {
    return handleTextInput(key, state, 'apiKey', STEP_BASE_URL);
  }

  if (state.step === STEP_BASE_URL) {
    const res = handleTextInput(key, state, 'baseUrl', STEP_MODEL);
    if (res.state.baseUrl !== state.baseUrl) {
      res.state = { ...res.state, baseUrlEdited: true };
    }
    return res;
  }

  if (state.step === STEP_MODEL) {
    const res = handleTextInput(key, state, 'model', STEP_LANGUAGE);
    if (res.state.model !== state.model) {
      res.state = { ...res.state, modelEdited: true };
    }
    return res;
  }

  if (state.step === STEP_LANGUAGE) {
    return handleTextInput(key, state, 'language', STEP_ARCHIVE_PATH);
  }

  if (state.step === STEP_ARCHIVE_PATH) {
    return handleTextInput(key, state, 'archivePath', null);
  }

  return { state, result: 'continue' };
}

/**
 * Handle text input for a field. Enter advances to nextStep (or 'done' if null).
 * Tab also advances.
 */
function handleTextInput(key, state, field, nextStep) {
  // Enter → advance to next step or finish
  if (key === '\r' || key === '\n') {
    if (nextStep === null) {
      return { state, result: 'done' };
    }
    return {
      state: { ...state, step: nextStep },
      result: 'continue',
    };
  }

  // Tab → advance
  if (key === '\t') {
    if (nextStep === null) {
      return { state, result: 'done' };
    }
    return {
      state: { ...state, step: nextStep },
      result: 'continue',
    };
  }

  // Backspace
  if (key === '\x7f' || key === '\x08') {
    const current = state[field] || '';
    if (current.length > 0) {
      return {
        state: { ...state, [field]: current.slice(0, -1) },
        result: 'continue',
      };
    }
    return { state, result: 'continue' };
  }

  // Printable characters — supports both single keystrokes and pasted strings.
  // In raw mode, pasting sends the entire clipboard as one multi-char data event.
  const printable = key.split('').filter((ch) => ch.charCodeAt(0) >= 32).join('');
  if (printable.length > 0) {
    const current = state[field] || '';
    return {
      state: { ...state, [field]: current + printable },
      result: 'continue',
    };
  }

  return { state, result: 'continue' };
}

/**
 * Run the interactive setup flow. Returns a Promise.
 * Resolves with config object on save, or null on skip.
 * Caller must have stdin in raw mode already.
 */
function runSetup(existingConfig) {
  return new Promise((resolve) => {
    let state = createSetupState(existingConfig);

    function redraw() {
      process.stdout.write('\x1b[2J\x1b[H');
      process.stdout.write(renderSetupScreen(state) + '\n');
    }

    function onKey(key) {
      const { state: newState, result } = handleSetupKey(key, state);
      state = newState;

      if (result === 'done') {
        cleanup();
        // Expand ~ in archivePath
        let archivePath = state.archivePath || '';
        if (archivePath.startsWith('~')) {
          archivePath = path.join(os.homedir(), archivePath.slice(1));
        }
        resolve({
          provider: state.provider,
          apiKey: state.apiKey,
          baseUrl: state.baseUrl,
          model: state.model,
          language: state.language,
          archivePath,
        });
        return;
      }

      if (result === 'skip') {
        cleanup();
        resolve(null);
        return;
      }

      redraw();
    }

    function cleanup() {
      process.stdin.removeListener('data', onKey);
    }

    process.stdin.on('data', onKey);
    redraw();
  });
}

module.exports = { runSetup, renderSetupScreen, handleSetupKey, createSetupState, maskApiKey };
