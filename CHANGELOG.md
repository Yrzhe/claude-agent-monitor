# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- **Real-time session archive**: All session events (tool calls, conversations, summaries, topics) are saved as permanent JSONL files in a user-configured archive directory. Hook scripts write tool_use, session_start, stop, and session_end events in real-time; dashboard syncs conversation messages and AI summaries periodically. Archive files organized as `<archivePath>/YYYY/MM/YYYY-MM-DD-<sessionId>.jsonl`. Cross-midnight sessions handled via `archive-map.json` mapping file. Configure archive path via `[s]` setup wizard.
- **AI topic summary**: Generates a concise session topic title by sampling conversation messages from beginning, middle, and end (user queries + assistant responses + recent tools), displayed prominently with magenta `▸` prefix in both TUI and web dashboard — instantly see what each agent is working on instead of just a random codename. Falls back to first user message when no API key is configured.
- **Enhanced notifications**: New tool activity and new conversation message notifications in addition to existing status transition notifications. Toggle `[n]` now shows descriptive status message.
- **Export feedback**: `[e]` export now shows a visible green status message on the dashboard with the exported filename (or error details), instead of the invisible terminal title change.

### Fixed
- **Critical: hooks never fire** — All hook matchers used `""` (empty string) which matches nothing; changed to `"*"` (wildcard) so hooks actually trigger. Affected `hooks/hooks.json`, `.claude-plugin/plugin.json`, and README manual setup instructions.
- **Critical: archive never writes** — `archivePath` with wrapping quotes (e.g. pasted from terminal as `'/path/to/dir'`) was treated as a relative path, causing all archive writes to silently fail. Fixed in both `archiver.js` (strips wrapping quotes on read) and `setup.js` (strips quotes before saving).
- **Session disappears on new window** — Ghost session filter removed sessions with `toolCount === 0` and non-active status immediately. Now keeps sessions visible for 30 minutes even without tool activity, preventing newly opened sessions from vanishing.
- **AI summary stuck on old content** — Summary cache was only invalidated by `toolCount` changes. Now also checks `messageCount`, so new conversation messages (even without tool calls) trigger re-summarization.
- **J/K scroll not working** — `maxScroll` was calculated from `recentTools.length` only, but the rendered timeline includes both tools and conversation messages. Fixed to use full timeline length and accounts for expanded mode (10 visible lines vs 5).

## [0.5.0] - 2026-02-09

### Added
- **Conversation capture**: Reads Claude Code transcript files (`~/.claude/projects/`) to display user and assistant messages alongside tool calls — full conversation context without new hooks
- **Unified timeline**: Tools and messages are merged into a single chronological timeline in both TUI and web dashboard
- **`[n]` keybinding**: Toggle macOS desktop notifications for session transitions (ended, idle, stale)
- **`[f]` keybinding**: Cycle status filter (All → Active → Idle → Ended) to focus on specific session states
- **`[Space]` keybinding**: Expand/collapse focused panel to show tool detail + result (2-line entries, 10 visible)
- **`[e]` keybinding**: Export focused session to Markdown file in `~/.claude/agent-monitor/exports/`
- **`[g]` keybinding**: Toggle project grouping — sessions grouped by working directory with collapsible headers
- **`cam export`**: CLI subcommand to export sessions — `cam export [sessionId] [--format json|csv|md]`
- **`cam stats`**: CLI subcommand showing aggregate statistics — total sessions, tool distribution, project breakdown
- **Session replay**: `/replay?sessionId=...` web page with play/pause/step controls and keyboard shortcuts (Space, ←→, +/-)
- **REST API extensions**: `GET /api/export`, `GET /api/stats`, `GET /api/timeline`, `GET /replay`
- **Parent-child detection**: Temporal correlation to link Task-spawned sub-agent sessions to their parent
- **Project grouping**: Group sessions by project in both TUI (with `▸` headers) and web (collapsible groups)
- **Message styling**: User messages shown with `U:` prefix (magenta), assistant with `A:` prefix (cyan) in TUI; speech-bubble styling in web
- **AI summary context**: Last 3-5 conversation messages appended to AI summary prompt for richer context

### Changed
- Timeline shows interleaved tools + messages instead of tools only
- Footer updated with all new keybinding indicators (`[f] Filter`, `[n] Notify`, `[g] Group`, `[e] Export`, `[Space] Expand`)
- Config extended with `notifications` and `groupByProject` boolean fields
- Web dashboard shows "Activity Timeline" with message entries alongside tool entries

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
