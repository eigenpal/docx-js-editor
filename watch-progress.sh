#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

while true; do
  clear
  echo "═══════════════════════════════════════════"
  echo "  DOCX EDITOR - RALPH PROGRESS"
  echo "═══════════════════════════════════════════"
  echo ""

  # Count passes - format is "**passes:** true"
  DONE=$(grep -c '\*\*passes:\*\* true' plan.md 2>/dev/null || echo "0")
  TODO=$(grep -c '\*\*passes:\*\* false' plan.md 2>/dev/null || echo "0")

  # Trim whitespace
  DONE=$(echo "$DONE" | tr -d '[:space:]')
  TODO=$(echo "$TODO" | tr -d '[:space:]')

  # Handle empty values
  if [ -z "$DONE" ]; then DONE=0; fi
  if [ -z "$TODO" ]; then TODO=0; fi

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
  echo "───────────────────────────────────────────"
  echo "  📍 Current Task:"
  CURRENT=$(grep -B3 '\*\*passes:\*\* false' plan.md 2>/dev/null | grep "^### US-" | head -1 | sed 's/### /  /')
  if [ -n "$CURRENT" ]; then
    echo "$CURRENT"
  else
    echo "  (none found)"
  fi
  echo ""
  echo "───────────────────────────────────────────"
  echo "  📋 Recently Completed:"
  COMPLETED=$(grep -B2 '\*\*passes:\*\* true' plan.md 2>/dev/null | grep "^### US-" | tail -5 | sed 's/### /  ✓ /')
  if [ -n "$COMPLETED" ]; then
    echo "$COMPLETED"
  else
    echo "  (none yet)"
  fi
  echo ""
  echo "───────────────────────────────────────────"
  echo "  📝 Latest Activity:"
  tail -30 activity.md 2>/dev/null | grep -A1 "^### US-" | grep -v "^--$" | tail -6
  echo ""
  echo "═══════════════════════════════════════════"
  echo "  $(date '+%H:%M:%S') | Refreshing every 5s"

  sleep 5
done
