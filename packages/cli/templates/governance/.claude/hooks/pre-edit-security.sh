#!/bin/bash
# =============================================================================
# SidStack Pre-Edit Security Check Hook
# Runs: Before Edit, Write, MultiEdit tool calls
# Purpose: Warn about security patterns in file edits (never blocks)
# Output: plain text context (auto-added by Claude Code for PreToolUse)
# =============================================================================

# Read hook input from stdin (JSON: {tool_name, tool_input})
INPUT=$(cat 2>/dev/null || echo "")

# Extract file path and content from stdin JSON
FILE_PATH=""
NEW_CONTENT=""
if command -v jq &>/dev/null && [ -n "$INPUT" ]; then
    FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.filePath // ""' 2>/dev/null || echo "")
    # For Edit: new_string; For Write: content
    NEW_CONTENT=$(echo "$INPUT" | jq -r '.tool_input.new_string // .tool_input.content // ""' 2>/dev/null || echo "")
fi

# No file path = nothing to check
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Security-sensitive path patterns
is_sensitive_path() {
    local path="$1"
    case "$path" in
        */auth/*|*/login/*|*/session/*|*/middleware/*|*/security/*) return 0 ;;
        */.env*|*/config/*|*/secrets/*) return 0 ;;
        *) return 1 ;;
    esac
}

# Check content for security patterns
WARNINGS=""
if [ -n "$NEW_CONTENT" ]; then
    echo "$NEW_CONTENT" | grep -qE "password.*=.*['\"]|secret.*=.*['\"]|api_key.*=.*['\"]" 2>/dev/null && \
        WARNINGS="${WARNINGS}Possible hardcoded credential. "
    echo "$NEW_CONTENT" | grep -qE "eval\(|exec\(" 2>/dev/null && \
        WARNINGS="${WARNINGS}Code execution function detected. "
    echo "$NEW_CONTENT" | grep -qE "innerHTML.*=|dangerouslySetInnerHTML" 2>/dev/null && \
        WARNINGS="${WARNINGS}Potential XSS vulnerability. "
fi

# Build context message and output as plain text
CONTEXT=""
if is_sensitive_path "$FILE_PATH"; then
    CONTEXT="Security-sensitive path: ${FILE_PATH}. Ensure no hardcoded credentials, input validation present. "
fi
if [ -n "$WARNINGS" ]; then
    CONTEXT="${CONTEXT}Security warnings: ${WARNINGS}"
fi

# Plain text stdout = auto-added as context by Claude Code
if [ -n "$CONTEXT" ]; then
    echo "$CONTEXT"
fi

exit 0
