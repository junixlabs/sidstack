# Training Room

Learn from mistakes and build institutional knowledge through the Incident-Lesson-Skill-Rule pipeline.

## Pipeline

```
Incident → Lesson → Skill → Rule
```

Each stage builds on the previous:

1. **Incident** - Something went wrong (bug, outage, misunderstanding)
2. **Lesson** - What we learned from the incident
3. **Skill** - A reusable capability extracted from the lesson
4. **Rule** - An enforceable governance rule

## Creating an Incident

When a bug or problem is resolved:

```
Create an incident report for the login timeout bug
```

Or via API:
```bash
curl -X POST http://localhost:19432/api/training/incidents \
  -H "Content-Type: application/json" \
  -d '{
    "projectPath": "/path/to/project",
    "title": "Login timeout on slow connections",
    "severity": "medium",
    "moduleId": "auth",
    "description": "Users with >500ms latency experienced timeouts"
  }'
```

## Creating a Lesson

Extract a lesson from an incident:

```
Create a lesson: always configure timeouts for external API calls
```

Lessons require:
- **Title** - Short description
- **Category** - Module or topic
- **Description** - Detailed explanation
- **Severity** - low/medium/high

Lessons need approval before becoming active:
```
Approve lesson les-001
```

## Creating Skills

Extract reusable skills from lessons:

```
Create a skill for timeout configuration patterns
```

Skills are capability documents that agents can reference.

## Creating Rules

Create enforcement rules from skills:

```
Create a rule: require timeout configuration for all HTTP clients
```

Rules have enforcement levels:
- **strict** - Must pass, blocks completion
- **warn** - Shows warning, does not block

## Viewing the Pipeline

In the desktop app, open **Training Room** to see:
- Total incidents, lessons, skills, and rules
- Recent lessons with approval status
- Active rules with enforcement levels
- Overall governance compliance percentage
