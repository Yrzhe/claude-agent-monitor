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
} else {
  const { start } = require('../src/app');
  start();
}
