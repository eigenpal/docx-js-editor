#!/bin/bash
# Watch Ralph progress in real-time
# Usage: ./scripts/watch.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "=== Ralph Progress Watcher ==="
echo "Watching: .ralph/progress.txt and .ralph/last_output.txt"
echo "Press Ctrl+C to stop"
echo ""

# Check if files exist
touch .ralph/progress.txt .ralph/last_output.txt 2>/dev/null

# Use tail to follow both files
# -f = follow, shows new lines as they're added
tail -f .ralph/progress.txt .ralph/last_output.txt
