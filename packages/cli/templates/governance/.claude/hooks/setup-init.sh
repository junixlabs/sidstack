#!/bin/bash
# =============================================================================
# SidStack Setup Init Hook
# Runs on: SessionStart with matcher "init" (claude --init)
# Purpose: Auto-initialize SidStack if not already set up, set env vars
# =============================================================================

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
CONFIG_FILE="$PROJECT_DIR/.sidstack/config.json"

# Check if SidStack is already initialized
if [ -f "$CONFIG_FILE" ]; then
    # Already initialized - export PROJECT_ID via CLAUDE_ENV_FILE
    if command -v jq &>/dev/null; then
        PROJECT_ID=$(jq -r '.projectId // empty' "$CONFIG_FILE" 2>/dev/null)
        if [ -n "$PROJECT_ID" ] && [ -n "$CLAUDE_ENV_FILE" ]; then
            echo "SIDSTACK_PROJECT_ID=$PROJECT_ID" >> "$CLAUDE_ENV_FILE"
        fi
    fi
    echo "SidStack already initialized."
    exit 0
fi

# Not initialized - run sidstack init
if command -v npx &>/dev/null; then
    echo "SidStack not initialized. Running auto-setup..."
    RESULT=$(npx -y @sidstack/cli@latest init --json --force "$PROJECT_DIR" 2>/dev/null)

    if [ $? -eq 0 ] && [ -n "$RESULT" ]; then
        # Extract projectId and export
        if command -v jq &>/dev/null && [ -n "$CLAUDE_ENV_FILE" ]; then
            PROJECT_ID=$(echo "$RESULT" | jq -r '.projectId // empty' 2>/dev/null)
            if [ -n "$PROJECT_ID" ]; then
                echo "SIDSTACK_PROJECT_ID=$PROJECT_ID" >> "$CLAUDE_ENV_FILE"
            fi
        fi
        echo "SidStack initialized successfully."
    else
        echo "SidStack auto-init failed. Run manually: npx @sidstack/cli init"
    fi
else
    echo "npx not found. Install Node.js to use SidStack auto-init."
fi

exit 0
