'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

const STATE_DIR = path.join(os.homedir(), '.claude', 'agent-monitor', 'sessions');
const DEBOUNCE_MS = 300;
const POLL_INTERVAL_MS = 1000;

class SessionWatcher extends EventEmitter {
  constructor() {
    super();
    this._fsWatcher = null;
    this._pollTimer = null;
    this._debounceTimer = null;
    this._lastMtimes = new Map();
  }

  /**
   * Start watching the state directory for changes.
   */
  start() {
    // Ensure directory exists
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }

    // Try fs.watch first, fall back to polling
    try {
      this._fsWatcher = fs.watch(STATE_DIR, () => {
        this._debouncedEmit();
      });
      this._fsWatcher.on('error', () => {
        this._fsWatcher = null;
        this._startPolling();
      });
    } catch {
      this._startPolling();
    }
  }

  /**
   * Stop watching.
   */
  stop() {
    if (this._fsWatcher) {
      this._fsWatcher.close();
      this._fsWatcher = null;
    }
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }

  /**
   * Poll for changes by comparing file modification times.
   */
  _startPolling() {
    if (this._pollTimer) return;

    this._pollTimer = setInterval(() => {
      if (!fs.existsSync(STATE_DIR)) return;

      let changed = false;
      const files = fs.readdirSync(STATE_DIR).filter((f) => f.endsWith('.jsonl'));

      // Check for new or modified files
      for (const file of files) {
        try {
          const stat = fs.statSync(path.join(STATE_DIR, file));
          const mtime = stat.mtimeMs;
          if (this._lastMtimes.get(file) !== mtime) {
            this._lastMtimes.set(file, mtime);
            changed = true;
          }
        } catch {
          // File may have been deleted
        }
      }

      // Check for removed files
      const fileSet = new Set(files);
      for (const [file] of this._lastMtimes) {
        if (!fileSet.has(file)) {
          this._lastMtimes.delete(file);
          changed = true;
        }
      }

      if (changed) {
        this.emit('change');
      }
    }, POLL_INTERVAL_MS);
  }

  /**
   * Debounce change emissions to avoid excessive re-renders.
   */
  _debouncedEmit() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }
    this._debounceTimer = setTimeout(() => {
      this.emit('change');
    }, DEBOUNCE_MS);
  }
}

module.exports = { SessionWatcher };
