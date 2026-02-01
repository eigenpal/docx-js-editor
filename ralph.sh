#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: $0 <iterations>"
  exit 1
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

for ((i=1; i<=$1; i++)); do
  echo "=========================================="
  echo "Ralph Iteration $i of $1"
  echo "=========================================="

  # Build the full prompt with file contents included
  FULL_PROMPT="
# PLAN.MD
$(cat plan.md)

# ACTIVITY.MD
$(cat activity.md)

# CLAUDE.MD
$(cat CLAUDE.md)

# INSTRUCTIONS
$(cat PROMPT.md | grep -v '^@')
"

  result=$(claude --dangerously-skip-permissions -p "$FULL_PROMPT" --output-format text 2>&1) || true

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
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
