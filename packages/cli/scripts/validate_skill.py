#!/usr/bin/env python3
"""
SidStack Skill Validator - Validates skill format and structure

Usage:
    validate_skill.py <skill_directory>
    validate_skill.py --all <skills_root_directory>

Examples:
    validate_skill.py templates/skills/sidstack/sidstack-aware
    validate_skill.py --all templates/skills/sidstack
"""

import sys
import re
from pathlib import Path

# Allowed frontmatter properties (per skill-creator spec)
ALLOWED_PROPERTIES = {'name', 'description', 'license', 'allowed-tools', 'metadata'}


def parse_simple_yaml(text: str) -> dict:
    """
    Simple YAML parser for skill frontmatter.
    Handles basic key: value and multiline strings (>).
    """
    result = {}
    lines = text.split('\n')
    current_key = None
    current_value = []
    is_multiline = False

    for line in lines:
        # Check for new key
        key_match = re.match(r'^([a-z-]+):\s*(.*)', line)
        if key_match and not line.startswith('  '):
            # Save previous key if exists
            if current_key:
                if is_multiline:
                    result[current_key] = ' '.join(current_value).strip()
                else:
                    result[current_key] = current_value[0] if current_value else ''

            current_key = key_match.group(1)
            value = key_match.group(2).strip()

            if value == '>' or value == '|':
                is_multiline = True
                current_value = []
            else:
                is_multiline = False
                current_value = [value]
        elif current_key and line.startswith('  '):
            # Continuation of multiline value
            current_value.append(line.strip())

    # Save last key
    if current_key:
        if is_multiline:
            result[current_key] = ' '.join(current_value).strip()
        else:
            result[current_key] = current_value[0] if current_value else ''

    return result


def validate_skill(skill_path: Path) -> tuple[bool, list[str]]:
    """
    Validate a skill directory.

    Args:
        skill_path: Path to skill directory

    Returns:
        Tuple of (is_valid, list of error messages)
    """
    errors = []
    warnings = []

    # Check directory exists
    if not skill_path.exists():
        return False, [f"Directory not found: {skill_path}"]

    if not skill_path.is_dir():
        return False, [f"Not a directory: {skill_path}"]

    # Check SKILL.md exists
    skill_md = skill_path / 'SKILL.md'
    if not skill_md.exists():
        return False, ["SKILL.md not found"]

    # Read content
    content = skill_md.read_text()

    # Check frontmatter exists
    if not content.startswith('---'):
        return False, ["No YAML frontmatter found (must start with ---)"]

    # Extract frontmatter
    match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
    if not match:
        return False, ["Invalid frontmatter format (must end with ---)"]

    frontmatter_text = match.group(1)

    # Parse YAML (simple parser for frontmatter)
    try:
        frontmatter = parse_simple_yaml(frontmatter_text)
        if not isinstance(frontmatter, dict):
            return False, ["Frontmatter must be a YAML dictionary"]
    except Exception as e:
        return False, [f"Invalid YAML in frontmatter: {e}"]

    # Check for unexpected properties
    unexpected_keys = set(frontmatter.keys()) - ALLOWED_PROPERTIES
    if unexpected_keys:
        errors.append(
            f"Unexpected key(s) in frontmatter: {', '.join(sorted(unexpected_keys))}. "
            f"Allowed: {', '.join(sorted(ALLOWED_PROPERTIES))}"
        )

    # Check required fields
    if 'name' not in frontmatter:
        errors.append("Missing 'name' in frontmatter")
    if 'description' not in frontmatter:
        errors.append("Missing 'description' in frontmatter")

    # Validate name
    name = frontmatter.get('name', '')
    if isinstance(name, str):
        name = name.strip()
        if name:
            # Check naming convention (hyphen-case)
            if not re.match(r'^[a-z0-9-]+$', name):
                errors.append(f"Name '{name}' should be hyphen-case (lowercase letters, digits, hyphens only)")
            if name.startswith('-') or name.endswith('-') or '--' in name:
                errors.append(f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens")
            if len(name) > 64:
                errors.append(f"Name too long ({len(name)} chars). Maximum is 64.")

            # Check name matches directory
            if name != skill_path.name:
                warnings.append(f"Name '{name}' doesn't match directory '{skill_path.name}'")
    else:
        errors.append(f"Name must be a string, got {type(name).__name__}")

    # Validate description
    description = frontmatter.get('description', '')
    if isinstance(description, str):
        description = description.strip()
        if description:
            if '<' in description or '>' in description:
                errors.append("Description cannot contain angle brackets (< or >)")
            if len(description) > 1024:
                errors.append(f"Description too long ({len(description)} chars). Maximum is 1024.")
            if len(description) < 50:
                warnings.append("Description is short. Include WHEN to trigger this skill.")
            if '[TODO' in description:
                errors.append("Description contains [TODO] placeholder - please complete it")
    else:
        errors.append(f"Description must be a string, got {type(description).__name__}")

    # Check body content
    body = content[match.end():].strip()
    if not body:
        warnings.append("SKILL.md body is empty")
    else:
        line_count = len(body.split('\n'))
        if line_count > 500:
            warnings.append(f"Body has {line_count} lines. Consider moving details to references/")

    # Print warnings
    for w in warnings:
        print(f"  ⚠️  {w}")

    if errors:
        return False, errors
    return True, []


def validate_all(root_path: Path) -> tuple[int, int]:
    """
    Validate all skills in a directory.

    Returns:
        Tuple of (passed_count, failed_count)
    """
    passed = 0
    failed = 0

    # Find all skill directories (contain SKILL.md)
    for skill_md in root_path.rglob('SKILL.md'):
        skill_dir = skill_md.parent
        print(f"\n📁 {skill_dir.name}")

        valid, errors = validate_skill(skill_dir)
        if valid:
            print("  ✅ Valid")
            passed += 1
        else:
            print("  ❌ Invalid:")
            for e in errors:
                print(f"     - {e}")
            failed += 1

    return passed, failed


def main():
    if len(sys.argv) < 2:
        print("Usage: validate_skill.py <skill_directory>")
        print("       validate_skill.py --all <skills_root_directory>")
        sys.exit(1)

    if sys.argv[1] == '--all':
        if len(sys.argv) < 3:
            print("Error: --all requires a root directory")
            sys.exit(1)

        root_path = Path(sys.argv[2])
        print(f"🔍 Validating all skills in: {root_path}")

        passed, failed = validate_all(root_path)

        print(f"\n{'='*50}")
        print(f"Results: {passed} passed, {failed} failed")

        sys.exit(0 if failed == 0 else 1)
    else:
        skill_path = Path(sys.argv[1])
        print(f"🔍 Validating skill: {skill_path}")

        valid, errors = validate_skill(skill_path)

        if valid:
            print("✅ Skill is valid!")
            sys.exit(0)
        else:
            print("❌ Validation failed:")
            for e in errors:
                print(f"   - {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
