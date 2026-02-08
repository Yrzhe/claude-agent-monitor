#!/usr/bin/env node
'use strict';

const args = process.argv.slice(2);
const subcommand = args[0];

if (subcommand === 'web') {
  // Parse --port flag
  let port = 3210;
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    const parsed = parseInt(args[portIdx + 1], 10);
    if (!Number.isNaN(parsed) && parsed > 0 && parsed < 65536) {
      port = parsed;
    } else {
      console.warn(`Warning: invalid port "${args[portIdx + 1]}", using default ${port}`);
    }
  }

  const { startWebServer } = require('../src/web/server');
  startWebServer(port);
} else if (subcommand === 'export') {
  // cam export [sessionId] [--format json|csv|md]
  const { loadAllSessions } = require('../src/state');
  const { loadConfig } = require('../src/config');
  const { SummaryManager } = require('../src/summarizer');
  const { saveExport } = require('../src/exporter');

  const config = loadConfig();
  const summaryManager = new SummaryManager(config);
  const sessions = loadAllSessions(config);

  const sessionId = args[1];
  const formatIdx = args.indexOf('--format');
  const format = (formatIdx !== -1 && args[formatIdx + 1]) ? args[formatIdx + 1] : 'md';

  let target;
  if (sessionId && !sessionId.startsWith('--')) {
    target = sessions.find((s) => s.id === sessionId || s.name === sessionId);
    if (!target) {
      console.error(`Session not found: ${sessionId}`);
      console.error('Available sessions:');
      for (const s of sessions) {
        console.error(`  ${s.name} (${s.id}) — ${s.status}`);
      }
      process.exit(1);
    }
  } else {
    // Export most recent active/idle session
    target = sessions[0];
    if (!target) {
      console.error('No sessions available to export');
      process.exit(1);
    }
  }

  const summary = summaryManager.getSummary(target);
  const filePath = saveExport(target, format, summary);
  console.log(`Exported to: ${filePath}`);
} else if (subcommand === 'stats') {
  // cam stats
  const { loadAllSessions } = require('../src/state');
  const { loadConfig } = require('../src/config');
  const { computeStats } = require('../src/stats');

  const config = loadConfig();
  const sessions = loadAllSessions(config);
  const stats = computeStats(sessions);

  console.log('Claude Agent Monitor — Statistics\n');
  console.log(`  Total Sessions:  ${stats.totalSessions}`);
  console.log(`  Active:          ${stats.activeSessions}`);
  console.log(`  Idle:            ${stats.idleSessions}`);
  console.log(`  Ended:           ${stats.endedSessions}`);
  console.log(`  Total Tools:     ${stats.totalTools}`);
  console.log(`  Total Messages:  ${stats.totalMessages}`);
  console.log('');

  if (Object.keys(stats.toolDistribution).length > 0) {
    console.log('  Tool Distribution:');
    const sorted = Object.entries(stats.toolDistribution).sort((a, b) => b[1] - a[1]);
    for (const [name, count] of sorted) {
      const bar = '\u2588'.repeat(Math.min(30, Math.ceil(count / stats.totalTools * 30)));
      console.log(`    ${name.padEnd(12)} ${String(count).padStart(4)}  ${bar}`);
    }
    console.log('');
  }

  if (stats.projectBreakdown.length > 0) {
    console.log('  Projects:');
    for (const p of stats.projectBreakdown) {
      console.log(`    ${p.project.padEnd(30)} ${p.sessions} session(s), ${p.tools} tools`);
    }
  }
} else {
  const { start } = require('../src/app');
  start();
}
