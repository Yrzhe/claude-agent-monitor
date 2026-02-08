# Claude Agent Monitor (cam)

Real-time terminal dashboard for monitoring multiple Claude Code agent sessions.

```
┌─ CLAUDE AGENT MONITOR ──────────────────── 3 active ─┐
│                                                       │
│  ● swift-falcon  my-project  Edit auth.ts         3s  │
│  ● calm-river    dashboard   Bash npm test        1m  │
│  ○ bold-hawk     api-server  (idle)               5m  │
│  ✕ dim-wolf      utils       (ended)             10m  │
│                                                       │
│  [q] Quit  [r] Refresh  [c] Clear ended              │
└───────────────────────────────────────────────────────┘
```

Zero dependencies. Pure Node.js.

## Quick Start

### 1. Clone

```bash
git clone https://github.com/Yrzhe/claude-agent-monitor.git ~/claude-agent-monitor
```

### 2. Configure hooks

Add this to your `~/.claude/settings.json` (merge with existing config if needed):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/claude-agent-monitor/hooks/session-start.js"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/claude-agent-monitor/hooks/post-tool-use.js",
            "async": true
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/claude-agent-monitor/hooks/stop.js",
            "async": true
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node ~/claude-agent-monitor/hooks/session-end.js",
            "async": true
          }
        ]
      }
    ]
  }
}
```

### 3. Launch dashboard

```bash
node ~/claude-agent-monitor/dashboard/bin/cam.js
```

Or link it globally:

```bash
cd ~/claude-agent-monitor && npm link
cam
```

### 4. Open Claude Code sessions

Start Claude Code in other terminal windows — the dashboard updates in real-time.

## How It Works

**Hooks** (push model) capture events from each Claude Code session:

| Event | What it captures |
|-------|-----------------|
| `SessionStart` | New agent session with cwd, model |
| `PostToolUse` | Every tool call with smart summary |
| `Stop` | Agent finished responding |
| `SessionEnd` | Agent session exited |

Events are written as JSONL to `~/.claude/agent-monitor/sessions/<session_id>.jsonl`.

**Dashboard** watches the state directory and renders a live table:

| Icon | Status | Meaning |
|------|--------|---------|
| ● (green) | active | Tool used in last 5 minutes |
| ○ (yellow) | idle | Agent stopped, waiting for input |
| ○ (gray) | stale | No activity for 5+ minutes |
| ✕ (gray) | ended | Session exited |

## Keyboard Controls

| Key | Action |
|-----|--------|
| `q` | Quit dashboard |
| `r` | Force refresh |
| `c` | Clear ended sessions |

## Agent Names

Each session gets a deterministic name derived from its session ID (e.g., `swift-falcon`, `calm-river`). Same session always gets the same name.

## Requirements

- Node.js >= 18
- Claude Code with hooks support

## License

MIT
