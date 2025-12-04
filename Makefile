.PHONY: setup build dev test lint clean doctor tauri-dev tauri-release tauri-build

# Default target
all: setup build

# Initial setup
setup:
	@echo "Setting up SidStack..."
	pnpm install
	@echo "Setup complete!"

# Build all packages
build:
	@echo "Building TypeScript packages..."
	pnpm build
	@echo "Build complete!"

# Development mode
dev:
	@echo "Starting development mode..."
	pnpm dev

# Tauri desktop app development (debug - slow)
tauri-dev:
	@echo "Starting Tauri desktop app (debug mode)..."
	cd apps/agent-manager && pnpm tauri dev

# Tauri desktop app development (release - fast, recommended)
tauri-release:
	@echo "Starting Tauri desktop app (release mode - faster)..."
	cd apps/agent-manager && pnpm tauri dev --release

# Tauri desktop app build
tauri-build:
	@echo "Building Tauri desktop app..."
	cd apps/agent-manager && pnpm tauri build

# Run tests
test:
	@echo "Running TypeScript tests..."
	pnpm test

# Lint code
lint:
	pnpm lint

# Clean build artifacts
clean:
	pnpm clean
	rm -rf node_modules
	rm -rf .turbo
	rm -rf apps/agent-manager/src-tauri/target

# Health check
doctor:
	@echo "Running diagnostics..."
	@command -v node >/dev/null 2>&1 && echo "✓ Node.js installed" || echo "✗ Node.js not found"
	@command -v pnpm >/dev/null 2>&1 && echo "✓ pnpm installed" || echo "✗ pnpm not found"
	@command -v cargo >/dev/null 2>&1 && echo "✓ Rust/Cargo installed" || echo "✗ Rust/Cargo not found"

# Help
help:
	@echo "SidStack Makefile Commands:"
	@echo "  make setup         - Install dependencies"
	@echo "  make build         - Build all packages"
	@echo "  make dev           - Start development mode"
	@echo "  make tauri-dev     - Start Tauri desktop app (debug - slow)"
	@echo "  make tauri-release - Start Tauri desktop app (release - RECOMMENDED)"
	@echo "  make tauri-build   - Build Tauri desktop app for distribution"
	@echo "  make test          - Run all tests"
	@echo "  make lint          - Lint code"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make doctor        - Run diagnostics"
