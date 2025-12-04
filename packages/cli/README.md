# @sidstack/cli

Command-line interface for SidStack project intelligence.

## Installation

```bash
npx @sidstack/cli init
```

## Commands

```bash
# Initialize project
sidstack init                    # Basic setup
sidstack init --scan             # AI-powered knowledge generation
sidstack init --governance       # With governance templates

# Governance
sidstack governance show         # Show governance overview
sidstack governance check        # Check compliance

# Knowledge
sidstack knowledge init          # Initialize knowledge structure
sidstack knowledge create        # Create from template

# System
sidstack doctor                  # Health check
sidstack update                  # Check for updates
```

## Development

```bash
# Build
pnpm build

# Link globally
pnpm link --global

# Run in dev mode
./bin/run.js <command>
```

## Configuration

Config stored in `.sidstack/` after `sidstack init`.
