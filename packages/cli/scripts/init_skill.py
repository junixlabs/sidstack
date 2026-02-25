#!/usr/bin/env python3
"""
SidStack Skill Initializer - Creates a new skill from template

Usage:
    init_skill.py <skill-name> --path <path>

Examples:
    init_skill.py my-workflow --path templates/skills/custom
    init_skill.py sidstack-review --path templates/skills/sidstack
"""

import sys
from pathlib import Path


SKILL_TEMPLATE = """---
name: {skill_name}
description: >
  [TODO: Write a clear description of what this skill does and WHEN to trigger it.
  Example: "Enforce task workflow. Trigger when: (1) user says implement/fix/add,
  (2) before any file edit, (3) work complete - call task_complete."]
---

# {skill_title}

## When to Use

- [TODO: List specific trigger conditions]
- [TODO: What user actions should activate this skill]

## Process

### Step 1: [Action Name]

```
[TODO: Add MCP tool call or code example]
```

### Step 2: [Action Name]

| Input | Output |
|-------|--------|
| [TODO] | [TODO] |

## Quick Reference

| Tool | When |
|------|------|
| `tool_name` | [When to use] |
"""


def title_case_skill_name(skill_name: str) -> str:
    """Convert hyphenated skill name to Title Case for display."""
    return ' '.join(word.capitalize() for word in skill_name.split('-'))


def validate_skill_name(name: str) -> tuple[bool, str]:
    """Validate skill name follows conventions."""
    import re

    if not name:
        return False, "Skill name cannot be empty"

    if not re.match(r'^[a-z0-9-]+$', name):
        return False, f"Name '{name}' should be hyphen-case (lowercase letters, digits, and hyphens only)"

    if name.startswith('-') or name.endswith('-') or '--' in name:
        return False, f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens"

    if len(name) > 64:
        return False, f"Name is too long ({len(name)} chars). Maximum is 64 characters."

    return True, ""


def init_skill(skill_name: str, path: str) -> Path | None:
    """
    Initialize a new skill directory with template SKILL.md.

    Args:
        skill_name: Name of the skill (hyphen-case)
        path: Path where the skill directory should be created

    Returns:
        Path to created skill directory, or None if error
    """
    # Validate skill name
    valid, error = validate_skill_name(skill_name)
    if not valid:
        print(f"❌ Error: {error}")
        return None

    # Determine skill directory path
    skill_dir = Path(path).resolve() / skill_name

    # Check if directory already exists
    if skill_dir.exists():
        print(f"❌ Error: Skill directory already exists: {skill_dir}")
        return None

    # Create skill directory
    try:
        skill_dir.mkdir(parents=True, exist_ok=False)
        print(f"✅ Created skill directory: {skill_dir}")
    except Exception as e:
        print(f"❌ Error creating directory: {e}")
        return None

    # Create SKILL.md from template
    skill_title = title_case_skill_name(skill_name)
    skill_content = SKILL_TEMPLATE.format(
        skill_name=skill_name,
        skill_title=skill_title
    )

    skill_md_path = skill_dir / 'SKILL.md'
    try:
        skill_md_path.write_text(skill_content)
        print("✅ Created SKILL.md")
    except Exception as e:
        print(f"❌ Error creating SKILL.md: {e}")
        return None

    # Print next steps
    print(f"\n✅ Skill '{skill_name}' initialized successfully at {skill_dir}")
    print("\nNext steps:")
    print("1. Edit SKILL.md - update description with WHEN to trigger")
    print("2. Add process steps and MCP tool examples")
    print("3. Run validate_skill.py to check the skill structure")
    print("4. Optionally add references/ for detailed docs")

    return skill_dir


def main():
    if len(sys.argv) < 4 or sys.argv[2] != '--path':
        print("Usage: init_skill.py <skill-name> --path <path>")
        print("\nSkill name requirements:")
        print("  - Hyphen-case identifier (e.g., 'sidstack-review')")
        print("  - Lowercase letters, digits, and hyphens only")
        print("  - Max 64 characters")
        print("\nExamples:")
        print("  init_skill.py my-workflow --path templates/skills/custom")
        print("  init_skill.py sidstack-review --path templates/skills/sidstack")
        sys.exit(1)

    skill_name = sys.argv[1]
    path = sys.argv[3]

    print(f"🚀 Initializing SidStack skill: {skill_name}")
    print(f"   Location: {path}")
    print()

    result = init_skill(skill_name, path)

    if result:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
