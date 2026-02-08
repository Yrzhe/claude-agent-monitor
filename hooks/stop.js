#!/usr/bin/env node
'use strict';

const { readStdin, writeEvent, getAgentName } = require('./lib/shared');
const { archiveEvent } = require('./lib/archiver');

async function main() {
  const input = await readStdin();
  if (!input || !input.session_id) {
    process.exit(0);
  }

  const { session_id } = input;

  const event = {
    ts: new Date().toISOString(),
    event: 'stop',
    session_id,
    agent_name: getAgentName(session_id),
  };

  writeEvent(session_id, event);

  try { archiveEvent(session_id, event); } catch { /* silent */ }

  process.exit(0);
}

main().catch(() => process.exit(0));
