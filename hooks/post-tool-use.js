#!/usr/bin/env node
'use strict';

const { readStdin, writeEvent, getAgentName, summarizeTool } = require('./lib/shared');

async function main() {
  const input = await readStdin();
  if (!input || !input.session_id) {
    process.exit(0);
  }

  const { session_id, tool_name, tool_input } = input;

  writeEvent(session_id, {
    ts: new Date().toISOString(),
    event: 'tool_use',
    session_id,
    agent_name: getAgentName(session_id),
    tool_name: tool_name || 'unknown',
    tool_summary: summarizeTool(tool_name || 'unknown', tool_input),
  });

  process.exit(0);
}

main().catch(() => process.exit(0));
