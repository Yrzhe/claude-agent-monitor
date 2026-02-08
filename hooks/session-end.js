#!/usr/bin/env node
'use strict';

const { readStdin, writeEvent, getAgentName } = require('./lib/shared');

async function main() {
  const input = await readStdin();
  if (!input || !input.session_id) {
    process.exit(0);
  }

  const { session_id, reason } = input;

  writeEvent(session_id, {
    ts: new Date().toISOString(),
    event: 'session_end',
    session_id,
    agent_name: getAgentName(session_id),
    reason: reason || 'unknown',
  });

  process.exit(0);
}

main().catch(() => process.exit(0));
