'use strict';

const http = require('http');
const { loadAllSessions, clearEndedSessions } = require('../state');
const { SessionWatcher } = require('../watcher');
const { loadConfig } = require('../config');
const { SummaryManager } = require('../summarizer');
const { getHtml } = require('./client');
const { exportSession } = require('../exporter');

const MAX_SSE_CLIENTS = 50;

/**
 * Build the sessions payload with summaries attached.
 */
function buildPayload(config, summaryManager) {
  const sessions = loadAllSessions(config);
  return sessions.map((session) => ({
    ...session,
    summary: summaryManager.getSummary(session),
    topicSummary: summaryManager.getTopicSummary(session),
    // conversation is already included from state.js
  }));
}

/**
 * Start the web dashboard server.
 * @param {number} port - Port number to listen on.
 */
function startWebServer(port) {
  const config = loadConfig();
  const summaryManager = new SummaryManager(config);

  // SSE clients
  const sseClients = new Set();

  /**
   * Broadcast current state to all SSE clients.
   */
  function broadcast() {
    try {
      const payload = JSON.stringify(buildPayload(config, summaryManager));
      for (const res of sseClients) {
        try {
          res.write(`data: ${payload}\n\n`);
        } catch {
          sseClients.delete(res);
        }
      }
    } catch {
      // Filesystem or serialization error — skip this broadcast cycle
    }
  }

  // Wire up watcher
  const watcher = new SessionWatcher();
  watcher.on('change', broadcast);
  watcher.start();

  // Auto-refresh every 5 seconds (matches TUI)
  const autoRefreshTimer = setInterval(broadcast, 5000);

  // Trigger broadcast on async summary updates
  summaryManager.onUpdate = () => broadcast();

  const server = http.createServer((req, res) => {
    const host = req.headers.host || `localhost:${port}`;
    const parsedUrl = new URL(req.url || '/', `http://${host}`);
    const pathname = parsedUrl.pathname;

    // GET / — HTML page
    if (pathname === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getHtml());
      return;
    }

    // GET /api/sessions — JSON snapshot
    if (pathname === '/api/sessions' && req.method === 'GET') {
      const payload = buildPayload(config, summaryManager);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }

    // POST /api/clear — clear ended/stale sessions
    if (pathname === '/api/clear' && req.method === 'POST') {
      const cleared = clearEndedSessions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cleared }));
      // Broadcast updated state
      setTimeout(broadcast, 100);
      return;
    }

    // GET /api/export — export a session
    if (pathname === '/api/export' && req.method === 'GET') {
      const sessionId = parsedUrl.searchParams.get('sessionId');
      const format = parsedUrl.searchParams.get('format') || 'json';

      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId parameter required' }));
        return;
      }

      const sessions = loadAllSessions(config);
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }

      const summary = summaryManager.getSummary(session);
      const content = exportSession(session, format, summary);

      const contentTypes = {
        json: 'application/json',
        csv: 'text/csv',
        md: 'text/markdown',
      };
      const ct = contentTypes[format] || 'text/plain';
      const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'md';

      res.writeHead(200, {
        'Content-Type': `${ct}; charset=utf-8`,
        'Content-Disposition': `attachment; filename="${session.name}.${ext}"`,
      });
      res.end(content);
      return;
    }

    // GET /api/stats — session statistics
    if (pathname === '/api/stats' && req.method === 'GET') {
      try {
        const { computeStats } = require('../stats');
        const sessions = loadAllSessions(config);
        const stats = computeStats(sessions);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
      } catch {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Stats module not available' }));
      }
      return;
    }

    // GET /api/timeline — session timeline for replay
    if (pathname === '/api/timeline' && req.method === 'GET') {
      const sessionId = parsedUrl.searchParams.get('sessionId');
      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'sessionId parameter required' }));
        return;
      }

      const sessions = loadAllSessions(config);
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Session not found' }));
        return;
      }

      const { buildTimeline } = require('../timeline');
      const timeline = buildTimeline(session.recentTools, session.conversation || []);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ session: { id: session.id, name: session.name, status: session.status }, timeline }));
      return;
    }

    // GET /replay — session replay page
    if (pathname === '/replay' && req.method === 'GET') {
      try {
        const { getReplayHtml } = require('./replay');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(getReplayHtml());
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Replay module not available');
      }
      return;
    }

    // GET /api/events — SSE stream
    if (pathname === '/api/events' && req.method === 'GET') {
      if (sseClients.size >= MAX_SSE_CLIENTS) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Too many connections' }));
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      res.write('\n');

      sseClients.add(res);

      // Clean up on socket errors
      res.on('error', () => {
        sseClients.delete(res);
      });

      // Send initial state
      try {
        const payload = JSON.stringify(buildPayload(config, summaryManager));
        res.write(`data: ${payload}\n\n`);
      } catch {
        // ignore — client will get data on next broadcast
      }

      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Error: port ${port} is already in use. Try --port <number>`);
      process.exit(1);
    }
    throw err;
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`Claude Agent Monitor — Web Dashboard`);
    console.log(`  http://localhost:${port}`);
    console.log(`  Press Ctrl+C to stop`);
  });

  function cleanup() {
    watcher.stop();
    clearInterval(autoRefreshTimer);
    for (const client of sseClients) {
      try { client.end(); } catch { /* ignore */ }
    }
    sseClients.clear();
    server.close();
    process.exit(0);
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

module.exports = { startWebServer };
