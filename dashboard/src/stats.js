'use strict';

const path = require('path');

/**
 * Compute aggregate statistics from all sessions.
 * @param {Array} sessions - All session objects.
 * @returns {object} Statistics object.
 */
function computeStats(sessions) {
  const totalSessions = sessions.length;
  const activeSessions = sessions.filter((s) => s.status === 'active').length;
  const idleSessions = sessions.filter((s) => s.status === 'idle' || s.status === 'stale').length;
  const endedSessions = sessions.filter((s) => s.status === 'ended').length;

  let totalTools = 0;
  let totalMessages = 0;
  const toolDistribution = {};
  const projectMap = {};

  for (const s of sessions) {
    totalTools += s.toolCount || 0;
    totalMessages += s.messageCount || 0;

    // Tool distribution from recentTools
    for (const t of (s.recentTools || [])) {
      const name = t.toolName || 'unknown';
      toolDistribution[name] = (toolDistribution[name] || 0) + 1;
    }

    // Project breakdown
    const project = s.cwd ? path.basename(s.cwd) : 'unknown';
    if (!projectMap[project]) {
      projectMap[project] = { sessions: 0, tools: 0, messages: 0 };
    }
    projectMap[project].sessions += 1;
    projectMap[project].tools += s.toolCount || 0;
    projectMap[project].messages += s.messageCount || 0;
  }

  const projectBreakdown = Object.entries(projectMap)
    .map(([project, data]) => ({ project, ...data }))
    .sort((a, b) => b.tools - a.tools);

  return {
    totalSessions,
    activeSessions,
    idleSessions,
    endedSessions,
    totalTools,
    totalMessages,
    toolDistribution,
    projectBreakdown,
  };
}

module.exports = { computeStats };
