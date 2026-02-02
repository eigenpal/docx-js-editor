#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

RALPH_DIR=".ralph"

for ((i=1; i<=$1; i++)); do
  echo "=========================================="
  echo "Ralph Iteration $i of $1"
  echo "=========================================="

  # Find the highest numbered plan file in .ralph/
  CURRENT_PLAN=$(ls -1 "$RALPH_DIR"/*.md 2>/dev/null | sort -V | tail -1)

  if [ -z "$CURRENT_PLAN" ]; then
    echo "No plan files found in $RALPH_DIR/"
    exit 1
  fi

  echo "Current plan: $CURRENT_PLAN"

  # Build the full prompt with file contents included
  FULL_PROMPT="
# CURRENT PLAN ($CURRENT_PLAN)
$(cat "$CURRENT_PLAN")

# ACTIVITY.MD
$(cat activity.md 2>/dev/null || echo '(no activity.md)')

# CLAUDE.MD
$(cat CLAUDE.md)

# INSTRUCTIONS
$(cat PROMPT.md | grep -v '^@')
"

  # Run Claude with real-time output, also capture to file for exit check
  OUTPUT_FILE="$RALPH_DIR/last_output.txt"
  claude --dangerously-skip-permissions -p "$FULL_PROMPT" --output-format text 2>&1 | tee "$OUTPUT_FILE" || true

  result=$(cat "$OUTPUT_FILE")

  # Check for exit signal
  if [[ "$result" == *'"exit_signal": true'* ]] || [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "=========================================="
    echo "All tasks complete after $i iterations!"
    echo "=========================================="
    exit 0
  fi

  echo ""
  echo "--- End of iteration $i ---"
  echo ""
done

echo "=========================================="
echo "Reached max iterations ($1)"
echo "=========================================="
exit 1
