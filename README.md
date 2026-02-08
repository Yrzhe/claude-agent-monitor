# Claude Agent Monitor (cam)

Real-time terminal dashboard for monitoring multiple Claude Code agent sessions.

```
┌─ CLAUDE AGENT MONITOR ──────────────────────────────── 2 active ─┐
│                                                                   │
│ ┏━ ● swift-falcon ━ my-project ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 3s ━┓ │
│ ┃ Editing 2 files (auth.ts, login.ts), ran 1 command            ┃ │
│ ┃───────────────────────────────────────────────────────────────┃ │
│ ┃  • Edit auth.ts                                          2s  ┃ │
│ ┃  • Bash git status                                       5s  ┃ │
│ ┃  • Read package.json                                    10s  ┃ │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛ │
│                                                                   │
│ ┌─ ○ calm-river ─ dashboard ──────────────────────────────── 1m ─┐ │
│ │ Ran 1 command                                                 │ │
│ │───────────────────────────────────────────────────────────────│ │
│ │  • Bash npm test                                         1m  │ │
│ └───────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  [↑↓] Focus  [j/k] Scroll  [s] Setup  [q] Quit  [r] Refresh    │
└───────────────────────────────────────────────────────────────────┘
```

Zero dependencies. Pure Node.js.

## Installation

### Option A: Plugin Marketplace (Recommended)

Install as a Claude Code plugin — hooks are configured automatically, no manual setup needed.

```bash
# 1. Add the marketplace
claude plugin marketplace add Yrzhe/claude-agent-monitor

# 2. Install the plugin
claude plugin install claude-agent-monitor@claude-agent-monitor
```

Then launch the dashboard:

```bash
node ~/.claude/plugins/cache/claude-agent-monitor/claude-agent-monitor/0.2.1/dashboard/bin/cam.js
```

Or link it globally for a shorter command:

```bash
cd ~/.claude/plugins/cache/claude-agent-monitor/claude-agent-monitor/0.2.1 && npm link
cam
```

### Option B: Manual Setup

#### 1. Clone

```bash
git clone https://github.com/Yrzhe/claude-agent-monitor.git ~/claude-agent-monitor
```

#### 2. Configure hooks

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

#### 3. Launch dashboard

```bash
node ~/claude-agent-monitor/dashboard/bin/cam.js
```

Or link it globally:

```bash
cd ~/claude-agent-monitor && npm link
cam
```

## Updating

The plugin does not auto-update. To get the latest version:

### Plugin Marketplace

```bash
claude plugin marketplace remove claude-agent-monitor
claude plugin marketplace add Yrzhe/claude-agent-monitor
claude plugin install claude-agent-monitor@claude-agent-monitor
```

### Manual Setup

```bash
cd ~/claude-agent-monitor && git pull
```

## Usage

1. **Terminal A** — Run `cam` to open the dashboard
2. **Terminal B/C/D** — Start Claude Code sessions as usual
3. The dashboard updates in real-time as agents work

## First-Run Setup

On first launch (when no API key is configured), an interactive setup wizard appears:

```
┌─ CLAUDE AGENT MONITOR ─ Setup ──────────────────────────┐
│                                                          │
│  AI summaries require an API key.                        │
│                                                          │
│  Provider:                                               │
│    [1] Anthropic  [2] OpenAI  [3] Custom                │
│                                                          │
│  API Key: sk-ant-***...***key█                           │
│  Base URL: https://api.anthropic.com/v1 (default)       │
│  Model: claude-haiku-4-5-20251001 (default)             │
│                                                          │
│  [Enter] Next  [Esc] Skip                               │
└──────────────────────────────────────────────────────────┘
```

- Select a provider (1/2/3) to auto-fill base URL and model defaults
- Type your API key, then press Enter to advance through each field
- Press Esc to skip setup and use rule-based summaries instead
- Press `s` anytime in the dashboard to re-open settings

## Configuration

Config is stored at `~/.claude/agent-monitor/config.json`. You can edit it manually or use the in-app setup (`s` key).

```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-...",
  "baseUrl": "https://api.anthropic.com/v1",
  "model": "claude-haiku-4-5-20251001",
  "maxRecentTools": 10
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `provider` | `anthropic` | Provider name: `anthropic`, `openai`, or `custom` |
| `apiKey` | _(empty)_ | API key for AI summaries. Omit to use rule-based summaries |
| `baseUrl` | `https://api.anthropic.com/v1` | API base URL |
| `model` | `claude-haiku-4-5-20251001` | Model for generating summaries |
| `maxRecentTools` | `10` | Number of recent tool events to track per session |

All fields are optional. The dashboard works fully without any config file.

### Multi-Provider Support

| Provider | Base URL | Example Models |
|----------|----------|---------------|
| Anthropic | `https://api.anthropic.com/v1` | `claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20250929` |
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini`, `gpt-4o` |
| Custom | _(any OpenAI-compatible endpoint)_ | Depends on provider |

**Custom endpoints** work with any API that follows the OpenAI Chat Completions format (`/v1/chat/completions`), including:
- DeepSeek API
- Ollama (local)
- Together AI
- OpenRouter
- Any OpenAI-compatible proxy

### AI Summaries

When an API key is configured, the dashboard generates intelligent summaries like:
> "Implementing JWT authentication by editing auth.ts and running tests"

Without an API key, rule-based summaries are used:
> "Editing 2 files (auth.ts, login.ts), ran 1 command"

AI summaries are cached for 30 seconds and refreshed when tool activity changes.

## How It Works

**Hooks** (push model) capture events from each Claude Code session:

| Event | What it captures |
|-------|-----------------|
| `SessionStart` | New agent session with cwd, model |
| `PostToolUse` | Every tool call with summary + detailed description |
| `Stop` | Agent finished responding |
| `SessionEnd` | Agent session exited |

Events are written as JSONL to `~/.claude/agent-monitor/sessions/<session_id>.jsonl`.

**Dashboard** watches the state directory and renders panel-based UI:

| Icon | Status | Meaning |
|------|--------|---------|
| ● (green) | active | Tool used in last 5 minutes |
| ○ (yellow) | idle | Agent stopped, waiting for input |
| ○ (gray) | stale | No activity for 5+ minutes |
| ✕ (gray) | ended | Session exited |

## Keyboard Controls

| Key | Action |
|-----|--------|
| `↑` / `↓` | Switch focus between agent panels |
| `j` / `k` | Scroll tool history in focused panel |
| `s` | Open setup / settings |
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
