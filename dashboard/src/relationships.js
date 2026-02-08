'use strict';

const path = require('path');

/**
 * Detect parent-child relationships between sessions.
 * A child session is one that was spawned by a Task tool call in a parent session.
 * Detection: parent has a Task tool_use event, and a new session starts within 5s.
 *
 * @param {Array} sessions - All sessions sorted by lastEventAt (newest first).
 * @returns {Map<string, string>} childId -> parentId
 */
function detectParentChild(sessions) {
  const parentMap = new Map();

  // Collect all Task tool timestamps per session
  const taskCalls = new Map(); // sessionId -> [{ts}]
  for (const s of sessions) {
    const calls = (s.recentTools || [])
      .filter((t) => t.toolName === 'Task')
      .map((t) => t.ts);
    if (calls.length > 0) {
      taskCalls.set(s.id, calls);
    }
  }

  // For each session, check if it started close to a Task call in another session
  for (const child of sessions) {
    if (parentMap.has(child.id)) continue;

    for (const [parentId, calls] of taskCalls) {
      if (parentId === child.id) continue;

      // Check if any Task call in parent is within 5s of child's earliest event
      const childStart = child.lastEventAt - (child.toolCount * 2000); // rough estimate
      for (const callTs of calls) {
        if (Math.abs(callTs - childStart) < 5000) {
          parentMap.set(child.id, parentId);
          break;
        }
      }
      if (parentMap.has(child.id)) break;
    }
  }

  return parentMap;
}

/**
 * Build a session tree: depth-first flattened array with depth info.
 * @param {Array} sessions - Sessions to organize.
 * @param {Map} parentMap - childId -> parentId mapping.
 * @returns {Array<{session, depth, isChild}>}
 */
function buildSessionTree(sessions, parentMap) {
  const childrenOf = new Map(); // parentId -> [session]
  const topLevel = [];
  const childIds = new Set(parentMap.keys());

  for (const s of sessions) {
    if (childIds.has(s.id)) {
      const parentId = parentMap.get(s.id);
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
      childrenOf.get(parentId).push(s);
    } else {
      topLevel.push(s);
    }
  }

  const result = [];
  for (const s of topLevel) {
    result.push({ session: s, depth: 0, isChild: false });
    const children = childrenOf.get(s.id) || [];
    for (const child of children) {
      result.push({ session: child, depth: 1, isChild: true });
    }
  }

  return result;
}

/**
 * Group sessions by project (working directory basename).
 * @param {Array} sessions - All sessions.
 * @returns {Map<string, Array>} projectName -> sessions[]
 */
function groupSessionsByProject(sessions) {
  const groups = new Map();
  for (const s of sessions) {
    const project = s.cwd ? path.basename(s.cwd) : 'unknown';
    if (!groups.has(project)) groups.set(project, []);
    groups.get(project).push(s);
  }
  return groups;
}

module.exports = { detectParentChild, buildSessionTree, groupSessionsByProject };
