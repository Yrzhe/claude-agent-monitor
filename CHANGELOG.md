# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

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
