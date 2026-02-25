# Incidents

Incident reports, root cause analysis, prevention rules.

Created via MCP tool `incident_create` or manually.

## What Belongs Here

Each incident includes:
- What happened (symptoms, impact, timeline)
- Root cause (why it happened)
- Prevention (enforceable rules to avoid recurrence)
- Agent impact (behavioral rules for agents)

## Naming Convention

Date-prefixed (event docs): `YYYY-MM-DD-slug.md`

```
2026-02-05-agent-deleted-production-data.md
2026-02-08-login-timeout-slow-connections.md
```

## Escalation

When the same root cause appears twice, promote prevention rules to `03-standards/`.
