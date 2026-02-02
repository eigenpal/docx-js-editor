# Eigenpal DOCX Editor — Ralph Loop Setup

Autonomous Claude Code loop (frankbria/ralph-claude-code) that builds the minimal DOCX editor iteratively.

---

## Prerequisites

```bash
# 1. Claude Code CLI
curl -fsSL https://claude.ai/install.sh | bash
claude   # authenticate once

# 2. Bun
curl -fsSL https://bun.sh/install | bash

# 3. tmux (for ralph --monitor)
# macOS: brew install tmux
# Ubuntu: sudo apt install tmux

# 4. jq
# macOS: brew install jq
# Ubuntu: sudo apt install jq
```

---

## Phase 1: Install Ralph globally (one time)

```bash
git clone https://github.com/frankbria/ralph-claude-code.git
cd ralph-claude-code
./install.sh
# Adds ralph, ralph-monitor, ralph-setup, ralph-enable, etc. to PATH
```

---

## Phase 2: Set up the project

```bash
mkdir eigenpal-docx-editor && cd eigenpal-docx-editor
git init

# Create the .ralph/ directory and copy files in:
mkdir -p .ralph

# Copy these files from the download:
#   .ralphrc          → project root
#   prd.json          → project root          — full story details + acceptance criteria
#   fix_plan.md       → .ralph/fix_plan.md    — the task checklist ralph iterates over
#   CLAUDE.md         → .ralph/PROMPT.md      — the prompt fed to Claude each loop

cp fix_plan.md .ralph/fix_plan.md
cp CLAUDE.md .ralph/PROMPT.md

# Initial commit
git add -A
git commit -m "chore: ralph loop scaffold"
```

---

## Phase 3: Run

```bash
# Recommended — launches ralph + live monitor in a tmux split
ralph --monitor

# Or run ralph alone (no live dashboard)
ralph
```

---

## How it works

Each iteration ralph spawns a fresh Claude Code session. Claude:

1. Reads `.ralph/fix_plan.md`, finds the first unchecked task
2. Reads `prd.json` for that task's full description and acceptance criteria
3. Investigates `reference/superdoc` source for SuperDoc API details (not guessing)
4. Implements the task, runs `bun build` to verify
5. On success: checks off the task in `fix_plan.md`, commits, logs learnings to `progress.txt`
6. Outputs a `RALPH_STATUS` block — ralph's exit detector reads `exit_signal: true` when all tasks are done

Loop continues until all 6 tasks are checked off or ralph's circuit breaker triggers.

---

## File layout

```
eigenpal-docx-editor/
├── .ralphrc                  ← ralph config (tool permissions, timeouts, rate limits)
├── prd.json                  ← 6 user stories with full descriptions + acceptance criteria
├── progress.txt              ← auto-generated: learnings across iterations
├── .ralph/
│   ├── PROMPT.md             ← prompt fed to Claude each loop iteration
│   ├── fix_plan.md           ← markdown checklist — ralph's task queue
│   └── logs/                 ← ralph execution logs (auto-created)
└── src/                      ← source code (built by Claude across iterations)
```

---

## After completion

```bash
bun dev   # run the dev server
```

The app will have:

- A DOCX file loader (input + drag-and-drop)
- A template variable panel (define `{name}` → `value` pairs)
- A SuperDoc WYSIWYG viewer — fonts, styles, colors, tables, headers all preserved
- Live re-render after template substitution, with full formatting fidelity surviving the round-trip
