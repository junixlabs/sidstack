#!/bin/bash
# =============================================================================
# SidStack Quality Gate Hook
# Runs: PreToolUse for mcp__sidstack__task_complete
# Purpose: Block task completion if quality gates haven't been met
# Output: Warnings/blocks injected as context
# =============================================================================

# Read hook input from stdin
INPUT=$(cat 2>/dev/null || echo "")

if ! command -v jq &>/dev/null || [ -z "$INPUT" ]; then
    exit 0
fi

# Extract task ID from tool input
TASK_ID=$(echo "$INPUT" | jq -r '.tool_input.taskId // ""' 2>/dev/null || echo "")

if [ -z "$TASK_ID" ] || [ "$TASK_ID" = "null" ]; then
    exit 0
fi

# Project paths
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
API_BASE="http://localhost:19432"
PROJECT_ID=$(basename "$PROJECT_DIR")
API_TIMEOUT=3

WARNINGS=""
GATE_PASSED=true

# =============================================================================
# Gate 1: Check test results exist for this task
# =============================================================================
TEST_RESULTS_DIR="$PROJECT_DIR/.sidstack/test-results"
HAS_TEST_RESULT=false

if [ -d "$TEST_RESULTS_DIR" ]; then
    # Search for test result files that reference this task
    if command -v grep &>/dev/null; then
        MATCHING_FILES=$(grep -rl "\"taskId\":\"${TASK_ID}\"" "$TEST_RESULTS_DIR" 2>/dev/null | head -5)
        if [ -n "$MATCHING_FILES" ]; then
            # Check if any result has pass verdict
            for f in $MATCHING_FILES; do
                VERDICT=$(jq -r '.verdict // ""' "$f" 2>/dev/null || echo "")
                if [ "$VERDICT" = "pass" ] || [ "$VERDICT" = "partial" ]; then
                    HAS_TEST_RESULT=true
                    break
                fi
            done
        fi
    fi
fi

if [ "$HAS_TEST_RESULT" = false ]; then
    WARNINGS="${WARNINGS}[QUALITY GATE] No test results found for task ${TASK_ID}. Run tests and call mcp__sidstack__test_result_create before completing.\n"
    GATE_PASSED=false
fi

# =============================================================================
# Gate 2: Check task has progress >= 80%
# =============================================================================
if command -v curl &>/dev/null; then
    TASK_INFO=$(curl -s --connect-timeout 2 --max-time "$API_TIMEOUT" \
        "${API_BASE}/api/tasks/${TASK_ID}" 2>/dev/null || echo "")

    if [ -n "$TASK_INFO" ]; then
        PROGRESS=$(echo "$TASK_INFO" | jq -r '.progress // 0' 2>/dev/null || echo "0")
        TASK_TYPE=$(echo "$TASK_INFO" | jq -r '.taskType // ""' 2>/dev/null || echo "")

        if [ "$PROGRESS" -lt 80 ] 2>/dev/null; then
            WARNINGS="${WARNINGS}[QUALITY GATE] Task progress is ${PROGRESS}% (expected >= 80%). Update progress before completing.\n"
            GATE_PASSED=false
        fi

        # Gate 3: Check acceptance criteria (for feature/bugfix)
        if [ "$TASK_TYPE" = "feature" ] || [ "$TASK_TYPE" = "bugfix" ] || [ "$TASK_TYPE" = "security" ]; then
            AC_JSON=$(echo "$TASK_INFO" | jq -r '.acceptanceCriteria // "[]"' 2>/dev/null || echo "[]")
            # acceptanceCriteria may be a string (JSON encoded) or array
            if echo "$AC_JSON" | jq -e '.' &>/dev/null; then
                TOTAL_AC=$(echo "$AC_JSON" | jq 'if type == "string" then (. | fromjson | length) else length end' 2>/dev/null || echo "0")
                COMPLETED_AC=$(echo "$AC_JSON" | jq 'if type == "string" then [. | fromjson | .[] | select(.completed == true)] | length else [.[] | select(.completed == true)] | length end' 2>/dev/null || echo "0")

                if [ "$TOTAL_AC" -gt 0 ] && [ "$COMPLETED_AC" -lt "$TOTAL_AC" ]; then
                    WARNINGS="${WARNINGS}[QUALITY GATE] Acceptance criteria: ${COMPLETED_AC}/${TOTAL_AC} completed. Review uncompleted criteria before marking done.\n"
                fi
            fi
        fi
    fi
fi

# =============================================================================
# Gate 4: Check if quality commands were run (typecheck/test)
# =============================================================================
COMPLIANCE_FILE="$PROJECT_DIR/.claude/compliance-session.json"
if [ -f "$COMPLIANCE_FILE" ] && command -v jq &>/dev/null; then
    QUALITY_GATES_RUN=$(jq -r '.quality_gates_run // 0' "$COMPLIANCE_FILE" 2>/dev/null || echo "0")
    if [ "$QUALITY_GATES_RUN" -lt 1 ] 2>/dev/null; then
        WARNINGS="${WARNINGS}[QUALITY GATE] No quality gates run this session. Run: pnpm typecheck && pnpm test before completing.\n"
        GATE_PASSED=false
    fi
fi

# =============================================================================
# Output warnings (non-blocking — Claude sees warnings but can still proceed)
# =============================================================================
if [ -n "$WARNINGS" ]; then
    printf "$WARNINGS"
    if [ "$GATE_PASSED" = false ]; then
        echo "[ACTION REQUIRED] Address the quality gate warnings above before completing this task. If you've already verified quality manually, proceed with completion and note why in the implementSummary."
    fi
fi

exit 0
