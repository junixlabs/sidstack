#!/bin/bash
# =============================================================================
# Open Claude Code Session in Default Terminal
# Auto-detects: iTerm2, Terminal.app, Warp, Alacritty, Kitty, Ghostty, Hyper
# =============================================================================

PROJECT_DIR="${1:-$(pwd)}"
COMMAND="${2:-claude}"

# Detect terminal app
detect_terminal() {
    # Method 1: Check TERM_PROGRAM (most reliable if run from terminal)
    if [[ -n "$TERM_PROGRAM" ]]; then
        echo "$TERM_PROGRAM"
        return
    fi

    # Method 2: Check running terminal processes
    local terminals=("iTerm" "Terminal" "Warp" "Alacritty" "kitty" "ghostty" "Hyper")
    for term in "${terminals[@]}"; do
        if pgrep -x "$term" > /dev/null 2>&1 || pgrep -f "$term.app" > /dev/null 2>&1; then
            echo "$term"
            return
        fi
    done

    # Method 3: Check installed apps (fallback)
    if [[ -d "/Applications/iTerm.app" ]]; then
        echo "iTerm"
    elif [[ -d "/Applications/Warp.app" ]]; then
        echo "Warp"
    elif [[ -d "/Applications/Alacritty.app" ]]; then
        echo "Alacritty"
    elif [[ -d "/Applications/kitty.app" ]]; then
        echo "kitty"
    elif [[ -d "/Applications/Ghostty.app" ]]; then
        echo "ghostty"
    else
        echo "Terminal"  # macOS default
    fi
}

TERMINAL=$(detect_terminal)
echo "Detected terminal: $TERMINAL"

case "$TERMINAL" in
    *iTerm*|*iterm*)
        osascript << EOF
tell application "iTerm"
    activate
    set newWindow to (create window with default profile)
    tell current session of newWindow
        write text "cd '$PROJECT_DIR' && $COMMAND"
    end tell
end tell
EOF
        ;;

    *Warp*)
        osascript << EOF
tell application "Warp"
    activate
    tell application "System Events" to keystroke "t" using command down
    delay 0.5
    tell application "System Events" to keystroke "cd '$PROJECT_DIR' && $COMMAND"
    tell application "System Events" to key code 36
end tell
EOF
        ;;

    *Alacritty*|*alacritty*)
        # Alacritty doesn't have AppleScript support, use open command
        open -a Alacritty --args -e /bin/bash -c "cd '$PROJECT_DIR' && $COMMAND; exec bash"
        ;;

    *kitty*)
        # Kitty remote control
        if command -v kitty &>/dev/null; then
            kitty @ launch --type=os-window --cwd="$PROJECT_DIR" bash -c "$COMMAND; exec bash"
        else
            open -a kitty --args -d "$PROJECT_DIR" bash -c "$COMMAND; exec bash"
        fi
        ;;

    *ghostty*)
        open -a Ghostty --args -e "cd '$PROJECT_DIR' && $COMMAND"
        ;;

    *Hyper*)
        osascript << EOF
tell application "Hyper"
    activate
    tell application "System Events"
        keystroke "t" using command down
        delay 0.3
        keystroke "cd '$PROJECT_DIR' && $COMMAND"
        key code 36
    end tell
end tell
EOF
        ;;

    *Terminal*|*)
        # macOS Terminal.app (default fallback)
        osascript << EOF
tell application "Terminal"
    activate
    do script "cd '$PROJECT_DIR' && $COMMAND"
end tell
EOF
        ;;
esac

echo "Opened $TERMINAL with command: cd '$PROJECT_DIR' && $COMMAND"
