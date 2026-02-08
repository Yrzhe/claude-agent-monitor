'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { buildTimeline } = require('./timeline');

const EXPORTS_DIR = path.join(os.homedir(), '.claude', 'agent-monitor', 'exports');

/**
 * Format a timestamp as ISO date-time string.
 */
function formatTs(ms) {
  if (!ms) return '';
  return new Date(ms).toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

/**
 * Format elapsed duration in human-readable form.
 */
function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/**
 * Export a session in the specified format.
 * @param {object} session - Session state object (with recentTools, conversation).
 * @param {string} format - 'json' | 'csv' | 'md'
 * @param {string} summary - AI or rule-based summary text.
 * @returns {string} Formatted export content.
 */
function exportSession(session, format, summary) {
  switch (format) {
    case 'json':
      return exportJson(session, summary);
    case 'csv':
      return exportCsv(session, summary);
    case 'md':
      return exportMarkdown(session, summary);
    default:
      return exportJson(session, summary);
  }
}

function exportJson(session, summary) {
  const timeline = buildTimeline(session.recentTools, session.conversation || []);
  return JSON.stringify({
    session: {
      id: session.id,
      name: session.name,
      cwd: session.cwd,
      model: session.model,
      status: session.status,
      toolCount: session.toolCount,
      messageCount: session.messageCount || 0,
      summary: summary || '',
    },
    timeline: timeline.map((e) => ({
      type: e.type,
      ts: formatTs(e.ts),
      ...(e.type === 'tool'
        ? { toolName: e.toolName, toolSummary: e.toolSummary, toolDetail: e.toolDetail, toolResult: e.toolResultBrief }
        : { text: e.text }),
    })),
  }, null, 2);
}

function exportCsv(session, summary) {
  const timeline = buildTimeline(session.recentTools, session.conversation || []);
  const lines = ['timestamp,type,name_or_role,content,detail'];

  for (const e of timeline.reverse()) { // chronological order for CSV
    const ts = formatTs(e.ts);
    if (e.type === 'tool') {
      const content = (e.toolSummary || '').replace(/"/g, '""');
      const detail = (e.toolDetail || '').replace(/"/g, '""');
      lines.push(`"${ts}","tool","${e.toolName}","${content}","${detail}"`);
    } else {
      const role = e.type === 'user_message' ? 'user' : 'assistant';
      const content = (e.text || '').replace(/"/g, '""');
      lines.push(`"${ts}","message","${role}","${content}",""`);
    }
  }

  return lines.join('\n');
}

function exportMarkdown(session, summary) {
  const timeline = buildTimeline(session.recentTools, session.conversation || []);
  const lines = [];

  lines.push(`# Session Report: ${session.name}`);
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Session ID | \`${session.id}\` |`);
  lines.push(`| Agent Name | ${session.name} |`);
  lines.push(`| Project | ${session.cwd || 'N/A'} |`);
  lines.push(`| Model | ${session.model || 'N/A'} |`);
  lines.push(`| Status | ${session.status} |`);
  lines.push(`| Tools Used | ${session.toolCount} |`);
  lines.push(`| Messages | ${session.messageCount || 0} |`);
  lines.push('');

  if (summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push(summary);
    lines.push('');
  }

  lines.push('## Activity Timeline');
  lines.push('');
  lines.push('| Time | Type | Detail |');
  lines.push('|------|------|--------|');

  // Chronological order for markdown
  const chronological = [...timeline].reverse();
  for (const e of chronological) {
    const ts = formatTs(e.ts);
    if (e.type === 'tool') {
      const detail = e.toolDetail || e.toolSummary || '';
      lines.push(`| ${ts} | **${e.toolName}** | ${detail.replace(/\|/g, '\\|')} |`);
    } else {
      const role = e.type === 'user_message' ? 'User' : 'Assistant';
      const text = (e.text || '').slice(0, 200).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      lines.push(`| ${ts} | _${role}_ | ${text} |`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push(`*Exported by Claude Agent Monitor at ${new Date().toISOString()}*`);

  return lines.join('\n');
}

/**
 * Save an export to the exports directory.
 * @param {object} session - Session state object.
 * @param {string} format - 'json' | 'csv' | 'md'
 * @param {string} summary - Summary text.
 * @returns {string} Path to the exported file.
 */
function saveExport(session, format, summary) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });

  const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'md';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `${session.name}_${timestamp}.${ext}`;
  const filePath = path.join(EXPORTS_DIR, filename);

  const content = exportSession(session, format, summary);
  fs.writeFileSync(filePath, content, 'utf8');

  return filePath;
}

module.exports = { exportSession, saveExport, EXPORTS_DIR };
