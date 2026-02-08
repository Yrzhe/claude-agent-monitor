# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- **`[w]` keybinding**: Press `w` in the TUI dashboard to launch the web dashboard and open it in the browser — web server is automatically started and stopped with the TUI

## [0.4.0] - 2026-02-09

### Added
- **Web Dashboard**: `cam web [--port PORT]` launches an HTTP server for browser-based monitoring (default port 3210)
- **SSE real-time streaming**: Browser receives live session updates via Server-Sent Events — no manual refresh needed
- **Session cards**: Dark-themed card layout with status indicator, agent name, model, project path, and elapsed time
- **Tool call timeline**: Expandable per-session tool history with timestamps, tool type badges, and detail summaries
- **Tool distribution bar**: Pure CSS stacked bar showing tool type breakdown per session
- **Session statistics**: Tool count, duration, and per-type counts displayed in each card
- **REST API**: `GET /api/sessions` (JSON snapshot), `POST /api/clear` (remove ended sessions), `GET /api/events` (SSE stream)
- **Responsive layout**: Mobile-friendly design with CSS Grid/Flexbox
- **Connection indicator**: Green/red dot showing SSE connection health

### Changed
- CLI entry point (`cam.js`) now parses subcommands — `cam` for TUI, `cam web` for web dashboard
- Existing TUI behavior is completely preserved when no subcommand is given

## [0.3.0] - 2026-02-08

### Added
- **Tmux window mapping**: Session-start hook captures `$TMUX_PANE` and window index/name via `tmux display-message`
- **Window label in panel header**: Shows `[2:work]`-style tmux window identifier next to project name
- **`[Enter]` keybinding**: Jump to the focused agent's tmux window/pane directly from the dashboard
- **Tool result capture**: PostToolUse hook now captures truncated `tool_result` (up to 150 chars) for richer AI context
- **`briefResult()` helper**: New shared utility for extracting concise tool result summaries

### Changed
- AI summary debounce reduced from 30s to 10s for faster updates
- AI prompt now includes tool results when available, giving more context for better summaries
- Footer keybindings updated with `[Enter] Jump` indicator

## [0.2.1] - 2026-02-08

### Added
- **Interactive setup wizard**: First-run setup screen when no API key is configured — select provider, enter key, set base URL and model
- **`[s]` keybinding**: Open setup/settings anytime from the dashboard to change provider or API key
- **Multi-provider support**: OpenAI, Anthropic, and custom OpenAI-compatible endpoints (DeepSeek, Ollama, etc.)
- **Provider presets**: Built-in defaults for Anthropic and OpenAI (base URL + model auto-filled)
- **`saveConfig()`**: Config system can now write back to `config.json`, not just read

### Changed
- API caller is now provider-aware: uses Anthropic `/messages` format or OpenAI `/chat/completions` format based on config
- Config format extended with `provider` field (backward compatible — old configs default to `anthropic`)
- Footer keybindings updated with `[s] Setup` indicator
- `SummaryManager` gains `updateConfig()` for live config changes without restart

## [0.2.0] - 2026-02-08

### Added
- **Panel-based UI**: Each agent gets a bordered panel with status, summary, and tool history (replaces single-line table)
- **AI-powered summaries**: Optional Anthropic API integration for intelligent session summaries via `~/.claude/agent-monitor/config.json`
- **Rule-based summaries**: Always-available fallback that groups recent tools into human-readable descriptions
- **Scrollable navigation**: Arrow keys (↑↓) to switch focus between panels, j/k to scroll tool history within a panel
- **Enriched hook data**: `tool_detail` field added to tool_use events with longer descriptions (up to 200 chars)
- **Config system**: `~/.claude/agent-monitor/config.json` for API key, base URL, model, and display settings
- **Recent tools array**: State layer now tracks last N tool events per session (default 10) instead of just the last one
- **Terminal resize handling**: Dashboard re-renders on `SIGWINCH`
- **Scroll indicators**: Shows "▲ N more above" / "▼ N more below" when tool history overflows

### Changed
- Dashboard renderer completely rewritten from table layout to panel-based layout
- Focused panel uses bold/bright borders for visual distinction
- Footer shows new keybindings and AI/rules indicator

## [0.1.0] - 2026-02-08

### Added
- Hook scripts for capturing Claude Code agent events (session start, tool use, stop, session end)
- Shared utility library with deterministic agent naming and tool summarization
- Real-time terminal dashboard with ANSI rendering
- File-based session state using JSONL format in `~/.claude/agent-monitor/sessions/`
- `fs.watch` + polling fallback for reliable file change detection
- Keyboard controls: [q] quit, [r] refresh, [c] clear ended sessions
- Claude Code plugin packaging via `.claude-plugin/plugin.json` and `hooks/hooks.json`
- CLI entry point `cam` for launching the dashboard
- Zero external dependencies — pure Node.js stdlib
