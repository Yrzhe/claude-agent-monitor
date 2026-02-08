#!/usr/bin/env node
'use strict';

const { readStdin, writeEvent, getAgentName, summarizeTool, detailTool } = require('./lib/shared');

async function main() {
  const input = await readStdin();
  if (!input || !input.session_id) {
    process.exit(0);
  }

  const { session_id, tool_name, tool_input } = input;
  const name = tool_name || 'unknown';

  writeEvent(session_id, {
    ts: new Date().toISOString(),
    event: 'tool_use',
    session_id,
    agent_name: getAgentName(session_id),
    tool_name: name,
    tool_summary: summarizeTool(name, tool_input),
    tool_detail: detailTool(name, tool_input),
  });

  process.exit(0);
}

main().catch(() => process.exit(0));
