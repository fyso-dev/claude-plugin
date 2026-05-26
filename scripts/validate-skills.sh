#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

python3 - "$REPO_ROOT" <<'PYEOF'
import os
import re
import sys

repo = sys.argv[1]
skills_dir = os.path.join(repo, "skills")
opencode_skills_dir = os.path.join(repo, ".opencode", "skills")

errors = []

skills = []
for name in sorted(os.listdir(skills_dir)):
    path = os.path.join(skills_dir, name)
    skill_file = os.path.join(path, "SKILL.md")
    if os.path.isdir(path) and os.path.isfile(skill_file):
        skills.append(name)

opencode_entries = sorted(os.listdir(opencode_skills_dir)) if os.path.isdir(opencode_skills_dir) else []

missing = sorted(set(skills) - set(opencode_entries))
extra = sorted(set(opencode_entries) - set(skills))
if missing:
    errors.append(f"missing .opencode/skills entries: {', '.join(missing)}")
if extra:
    errors.append(f"extra .opencode/skills entries without matching skills/: {', '.join(extra)}")

for name in opencode_entries:
    link_path = os.path.join(opencode_skills_dir, name)
    if not os.path.islink(link_path):
        errors.append(f".opencode/skills/{name} must be a symlink to ../../skills/{name}")
        continue
    target = os.readlink(link_path)
    expected = f"../../skills/{name}"
    if target != expected:
        errors.append(f".opencode/skills/{name} points to {target!r}, expected {expected!r}")
    if not os.path.exists(link_path):
        errors.append(f".opencode/skills/{name} is a broken symlink")

required_frontmatter = ("name", "description")
for name in skills:
    skill_file = os.path.join(skills_dir, name, "SKILL.md")
    text = open(skill_file, encoding="utf-8").read()
    if not text.startswith("---\n"):
        errors.append(f"skills/{name}/SKILL.md missing frontmatter")
        continue
    end = text.find("\n---", 4)
    if end == -1:
        errors.append(f"skills/{name}/SKILL.md has unterminated frontmatter")
        continue
    frontmatter = text[4:end]
    keys = set()
    for line in frontmatter.splitlines():
        match = re.match(r"^([A-Za-z0-9_-]+):", line)
        if match:
            keys.add(match.group(1))
    for key in required_frontmatter:
        if key not in keys:
            errors.append(f"skills/{name}/SKILL.md missing frontmatter key: {key}")

legacy_patterns = {
    "fyso-marketplace": "use fyso-plugins",
    "/sync-team": "use /fyso:sync-team",
}
for rel in ["README.md"] + [f"skills/{name}/SKILL.md" for name in skills]:
    text = open(os.path.join(repo, rel), encoding="utf-8").read()
    for pattern, replacement in legacy_patterns.items():
        if pattern in text:
            errors.append(f"{rel} contains legacy reference {pattern!r}; {replacement}")

readme = open(os.path.join(repo, "README.md"), encoding="utf-8").read()
expected_count = len(skills)
if f"**Skills** | {expected_count} " not in readme:
    errors.append(f"README.md skill count does not match skills/ count ({expected_count})")
if f"All {expected_count} skills" not in readme:
    errors.append(f"README.md 'All N skills' text does not match skills/ count ({expected_count})")
if f"({expected_count} skills)" not in readme:
    errors.append(f"README.md OpenCode setup skill count does not match skills/ count ({expected_count})")

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print(f"Validated {len(skills)} skills and {len(opencode_entries)} OpenCode skill links.")
PYEOF
