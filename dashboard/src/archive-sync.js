'use strict';

const { resolveArchivePath, appendToArchive, getArchiveBasePath } = require('../../hooks/lib/archiver');

const CACHE_TTL_MS = 30000; // Cache basePath for 30 seconds

/**
 * ArchiveSyncer — syncs conversation messages, summaries, and topics
 * from the dashboard to archive JSONL files.
 *
 * The dashboard has access to conversation transcripts and AI summaries
 * that hooks don't, so this class periodically appends those to the archive.
 */
class ArchiveSyncer {
  constructor() {
    // Per-session tracking: { lastMsgCount, lastSummary, lastTopic }
    this._state = {};
    // Cache basePath to avoid reading config.json on every refresh cycle
    this._cachedBasePath = null;
    this._cacheTs = 0;
  }

  /**
   * Get basePath with caching (avoids reading config.json every 5 seconds).
   */
  _getBasePath() {
    const now = Date.now();
    if (this._cachedBasePath !== null && now - this._cacheTs < CACHE_TTL_MS) {
      return this._cachedBasePath;
    }
    this._cachedBasePath = getArchiveBasePath();
    this._cacheTs = now;
    return this._cachedBasePath;
  }

  /**
   * Sync a session's conversation messages, summary, and topic to the archive.
   * Only appends new data since the last sync.
   * @param {object} session - The session object from state.js
   * @param {string} summary - Current AI/rule summary text
   * @param {string} topic - Current AI/rule topic text
   */
  sync(session, summary, topic) {
    const basePath = this._getBasePath();
    if (!basePath) return;

    const sessionId = session.id;
    const filePath = resolveArchivePath(basePath, sessionId);
    if (!filePath) return;

    // Initialize tracking state for this session (immutable)
    const st = this._state[sessionId] || {
      lastMsgCount: 0,
      lastSummary: '',
      lastTopic: '',
    };

    const conversation = session.conversation || [];
    let updated = st;

    // Append new conversation messages
    if (conversation.length > st.lastMsgCount) {
      const newMsgs = conversation.slice(st.lastMsgCount);
      for (const msg of newMsgs) {
        appendToArchive(filePath, {
          ts: msg.ts ? new Date(msg.ts).toISOString() : new Date().toISOString(),
          event: 'conversation_message',
          session_id: sessionId,
          role: msg.role || 'unknown',
          text: msg.text || '',
        });
      }
      updated = { ...updated, lastMsgCount: conversation.length };
    }

    // Append summary update if changed
    if (summary && summary !== st.lastSummary) {
      appendToArchive(filePath, {
        ts: new Date().toISOString(),
        event: 'summary_update',
        session_id: sessionId,
        summary,
      });
      updated = { ...updated, lastSummary: summary };
    }

    // Append topic update if changed
    if (topic && topic !== st.lastTopic) {
      appendToArchive(filePath, {
        ts: new Date().toISOString(),
        event: 'topic_update',
        session_id: sessionId,
        topic,
      });
      updated = { ...updated, lastTopic: topic };
    }

    // Immutable state update
    if (updated !== st) {
      this._state = { ...this._state, [sessionId]: updated };
    }
  }
}

module.exports = { ArchiveSyncer };
