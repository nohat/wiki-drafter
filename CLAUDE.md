# Claude Code Instructions for Wiki-Drafter Project

## Task Management
- **USE TodoWrite tool** as the primary task management system
- **SYNC to TODO.md file** immediately after every TodoWrite update so user can monitor in IDE
- Update both systems when:
  - Tasks are completed (TodoWrite: mark completed, TODO.md: move to ✅ section)
  - New tasks are discovered (TodoWrite: add with pending status, TODO.md: add to 📋 section)
  - Tasks change status (TodoWrite: update status, TODO.md: update progress)
- TodoWrite enforces exactly ONE task as "in_progress" at any time
- Mark tasks complete IMMEDIATELY when finished - never batch completions
- Always provide both content and activeForm for TodoWrite tasks

## Project Context
This is the Wiki-Drafter project - an AI-first Wikipedia drafting tool with:
- VS Code extension in `extensions/vscode/`
- Python companion service in `services/local/`
- Three-pane interface: editor, preview, claims grid

## Development Workflow
1. Check TODO.md for current tasks
2. Update TODO.md when starting new work
3. Mark tasks complete in TODO.md immediately upon completion
4. Add new discovered tasks to TODO.md
5. Keep companion service running on localhost:8000 for testing