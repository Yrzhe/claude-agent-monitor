#!/usr/bin/env node
'use strict';

const { readStdin, writeEvent, getAgentName, summarizeTool, detailTool, briefResult } = require('./lib/shared');
const { archiveEvent } = require('./lib/archiver');

async function main() {
  const input = await readStdin();
  if (!input || !input.session_id) {
    process.exit(0);
  }

  const { session_id, tool_name, tool_input } = input;
  const name = tool_name || 'unknown';

  // Capture tool result if available (PostToolUse hook provides it)
  const resultBrief = briefResult(input.tool_result || input.tool_response || '');

  const event = {
    ts: new Date().toISOString(),
    event: 'tool_use',
    session_id,
    agent_name: getAgentName(session_id),
    tool_name: name,
    tool_summary: summarizeTool(name, tool_input),
    tool_detail: detailTool(name, tool_input),
  };

  if (resultBrief) {
    event.tool_result_brief = resultBrief;
  }

  writeEvent(session_id, event);

  try { archiveEvent(session_id, event); } catch { /* silent */ }

  process.exit(0);
}

main().catch(() => process.exit(0));
