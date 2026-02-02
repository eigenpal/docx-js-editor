#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

RALPH_DIR=".ralph"

while true; do
  clear
  echo "═══════════════════════════════════════════"
  echo "  DOCX EDITOR - RALPH PROGRESS"
  echo "═══════════════════════════════════════════"
  echo ""

  # Count from all .ralph/*.md files
  PASSES_DONE=$(grep -h '\*\*passes:\*\* true' "$RALPH_DIR"/*.md 2>/dev/null | wc -l | tr -d '[:space:]')
  PASSES_TODO=$(grep -h '\*\*passes:\*\* false' "$RALPH_DIR"/*.md 2>/dev/null | wc -l | tr -d '[:space:]')
  CHECK_DONE=$(grep -h '^\- \[x\]' "$RALPH_DIR"/*.md 2>/dev/null | wc -l | tr -d '[:space:]')
  CHECK_TODO=$(grep -h '^\- \[ \]' "$RALPH_DIR"/*.md 2>/dev/null | wc -l | tr -d '[:space:]')

  # Default to 0 if empty
  : "${PASSES_DONE:=0}"
  : "${PASSES_TODO:=0}"
  : "${CHECK_DONE:=0}"
  : "${CHECK_TODO:=0}"

  # Combine totals
  DONE=$((PASSES_DONE + CHECK_DONE))
  TODO=$((PASSES_TODO + CHECK_TODO))
  TOTAL=$((DONE + TODO))

  if [ "$TOTAL" -gt 0 ]; then
    PCT=$((DONE * 100 / TOTAL))
  else
    PCT=0
  fi

  # Progress bar
  BAR_WIDTH=30
  FILLED=$((PCT * BAR_WIDTH / 100))
  EMPTY=$((BAR_WIDTH - FILLED))
  BAR=$(printf "%${FILLED}s" | tr ' ' '█')$(printf "%${EMPTY}s" | tr ' ' '░')

  echo "  [$BAR] $PCT%"
  echo "  ✅ $DONE completed | ⏳ $TODO remaining | 📊 $TOTAL total"
  echo ""

  # List plan files
  echo "───────────────────────────────────────────"
  echo "  📁 Plans:"
  for f in "$RALPH_DIR"/*.md; do
    if [ -f "$f" ]; then
      fname=$(basename "$f")
      fdone_passes=$(grep -c '\*\*passes:\*\* true' "$f" 2>/dev/null)
      fdone_check=$(grep -c '^\- \[x\]' "$f" 2>/dev/null)
      ftodo_passes=$(grep -c '\*\*passes:\*\* false' "$f" 2>/dev/null)
      ftodo_check=$(grep -c '^\- \[ \]' "$f" 2>/dev/null)
      # Ensure numeric values
      fdone_passes=$((fdone_passes + 0))
      fdone_check=$((fdone_check + 0))
      ftodo_passes=$((ftodo_passes + 0))
      ftodo_check=$((ftodo_check + 0))
      fdone=$((fdone_passes + fdone_check))
      ftodo=$((ftodo_passes + ftodo_check))
      ftotal=$((fdone + ftodo))
      if [ "$ftotal" -gt 0 ]; then
        echo "  $fname: $fdone/$ftotal"
      else
        echo "  $fname: (empty)"
      fi
    fi
  done
  echo ""

  echo "───────────────────────────────────────────"
  echo "  📍 Current Task:"

  # Find first unchecked task
  CURRENT=$(grep -h '^\- \[ \]' "$RALPH_DIR"/*.md 2>/dev/null | head -1 | sed 's/^- \[ \] /  /')
  if [ -n "$CURRENT" ]; then
    echo "$CURRENT"
  else
    CURRENT=$(grep -B20 '\*\*passes:\*\* false' "$RALPH_DIR"/*.md 2>/dev/null | grep "^### US-" | head -1 | sed 's/### /  /')
    if [ -n "$CURRENT" ]; then
      echo "$CURRENT"
    else
      echo "  (none - all done!)"
    fi
  fi
  echo ""

  echo "───────────────────────────────────────────"
  echo "  📋 Recently Completed:"
  CHECK_COMPLETED=$(grep -h '^\- \[x\]' "$RALPH_DIR"/*.md 2>/dev/null | tail -3 | sed 's/^- \[x\] /  ✓ /')
  if [ -n "$CHECK_COMPLETED" ]; then
    echo "$CHECK_COMPLETED"
  fi
  PASSES_COMPLETED=$(grep -B20 '\*\*passes:\*\* true' "$RALPH_DIR"/*.md 2>/dev/null | grep "^### US-" | tail -3 | sed 's/### /  ✓ /')
  if [ -n "$PASSES_COMPLETED" ]; then
    echo "$PASSES_COMPLETED"
  fi
  if [ -z "$CHECK_COMPLETED" ] && [ -z "$PASSES_COMPLETED" ]; then
    echo "  (none yet)"
  fi
  echo ""

  echo "═══════════════════════════════════════════"
  echo "  $(date '+%H:%M:%S') | Refreshing every 5s"

  sleep 5
done
