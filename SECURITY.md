# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.3.x   | Yes       |
| < 0.3.0 | No        |

## Reporting a Vulnerability

If you discover a security vulnerability in SidStack, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

### How to Report

1. Email: meartlee03@gmail.com
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- Acknowledgment within 48 hours
- Status update within 7 days
- Fix timeline communicated once assessed

### Scope

The following are in scope:
- SidStack desktop application (Tauri)
- API server (`packages/api-server`)
- MCP server (`packages/mcp-server`)
- CLI tool (`packages/cli`)

The following are out of scope:
- Third-party dependencies (report to upstream maintainers)
- Social engineering attacks
- Denial of service attacks

## Security Architecture

SidStack is a **local-first desktop application**:
- All data stored locally in SQLite
- API server binds to `localhost` only
- CORS restricted to localhost origins
- No cloud services or external data transmission
- No user authentication (single-user desktop app)
