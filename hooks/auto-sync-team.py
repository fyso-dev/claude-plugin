#!/usr/bin/env python3
"""Auto-sync a locally saved Fyso team when the remote version is newer."""

import json
import os
import re
import sys
import urllib.parse
import urllib.request


START = "<!-- FYSO TEAM START -->"
END = "<!-- FYSO TEAM END -->"
SAFE_NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$")


def load_json(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def find_project_dir(start):
    current = os.path.abspath(start or os.getcwd())
    while current and current != os.path.dirname(current):
        team_path = os.path.join(current, ".fyso", "team.json")
        if os.path.isfile(team_path):
            return current
        current = os.path.dirname(current)
    return ""


def safe_file_path(directory, name):
    if not isinstance(name, str) or not SAFE_NAME_RE.match(name):
        return None
    if os.path.basename(name) != name:
        return None
    path = os.path.abspath(os.path.join(directory, f"{name}.md"))
    root = os.path.abspath(directory) + os.sep
    if not path.startswith(root):
        return None
    return path


def request(config, method, path):
    api_url = (config.get("api_url") or "https://api.fyso.dev").rstrip("/")
    req = urllib.request.Request(
        f"{api_url}{path}",
        headers={
            "Authorization": f"Bearer {config.get('token', '')}",
            "X-Tenant-ID": config.get("tenant_id", ""),
            "Content-Type": "application/json",
        },
        method=method,
    )
    with urllib.request.urlopen(req, timeout=8) as response:
        raw = response.read().decode()
        return json.loads(raw) if raw else {}


def numeric_version(value):
    try:
        return int(value or 0)
    except Exception:
        return 0


def yaml_string(value):
    return (
        json.dumps(str(value), ensure_ascii=False)
        .replace("\\u2028", "\\\\u2028")
        .replace("\\u2029", "\\\\u2029")
    )


def sanitize_body(value):
    return re.sub(r"^---\s*$", "\u200B---", str(value or ""), flags=re.MULTILINE)


def first_line(text, fallback):
    for line in str(text or "").splitlines():
        stripped = line.strip()
        if stripped:
            return stripped
    return fallback


def color(role, opencode=False):
    lower = str(role or "").lower()
    if "developer" in lower:
        return "success" if opencode else "green"
    if "qa" in lower or "tester" in lower:
        return "warning" if opencode else "yellow"
    if "reviewer" in lower:
        return "accent" if opencode else "purple"
    if "coordinator" in lower:
        return "info" if opencode else "blue"
    if "writer" in lower:
        return "info" if opencode else "cyan"
    if "security" in lower:
        return "error" if opencode else "red"
    if "triage" in lower:
        return "warning" if opencode else "orange"
    return "secondary" if opencode else "gray"


def write_marker_section(path, content):
    section = f"{START}\n{content}\n{END}"
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    if os.path.exists(path):
        existing = open(path, encoding="utf-8").read()
        start = existing.find(START)
        end = existing.find(END)
        if start != -1 and end != -1 and end >= start:
            updated = existing[:start] + section + existing[end + len(END) :]
        else:
            updated = existing.rstrip() + "\n\n" + section + "\n"
    else:
        updated = section + "\n"
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(updated)


def normalize_agent(agent):
    return {
        "name": agent.get("name") or "unnamed",
        "display_name": agent.get("display_name") or agent.get("name") or "Unnamed Agent",
        "role": agent.get("role") or "assistant",
        "soul": agent.get("soul") or "",
        "system_prompt": agent.get("system_prompt") or "",
    }


def fetch_team_agents(config, team_id):
    encoded = urllib.parse.quote(team_id)
    resp = request(config, "GET", f"/api/entities/team_agents/records?resolve=true&filter.team={encoded}")
    items = ((resp.get("data") or {}).get("items") or [])
    agents = []
    missing = []
    for item in items:
        resolved = item.get("_agent") or (item.get("agent") if isinstance(item.get("agent"), dict) else None)
        if resolved:
            agents.append(normalize_agent(resolved))
        elif isinstance(item.get("agent"), str):
            missing.append(item["agent"])
    if missing:
        all_agents = ((request(config, "GET", "/api/entities/agents/records").get("data") or {}).get("items") or [])
        by_id = {agent.get("id"): agent for agent in all_agents}
        for agent_id in missing:
            if agent_id in by_id:
                agents.append(normalize_agent(by_id[agent_id]))
    return agents


def fetch_team_skills(config, team_id):
    encoded = urllib.parse.quote(team_id)
    try:
        resp = request(config, "GET", f"/api/entities/team_skills/records?resolve=true&filter.team={encoded}")
    except Exception:
        return []
    items = ((resp.get("data") or {}).get("items") or [])
    skills = []
    missing = []
    for item in items:
        resolved = item.get("_skill") or (item.get("skill") if isinstance(item.get("skill"), dict) else None)
        if not resolved and item.get("name"):
            resolved = item
        if resolved and resolved.get("name"):
            skills.append(
                {
                    "name": resolved.get("name"),
                    "description": resolved.get("description") or "",
                    "content": resolved.get("content") or "",
                }
            )
        elif isinstance(item.get("skill"), str):
            missing.append(item["skill"])
    if missing:
        all_skills = ((request(config, "GET", "/api/entities/skills/records").get("data") or {}).get("items") or [])
        by_id = {skill.get("id"): skill for skill in all_skills}
        for skill_id in missing:
            skill = by_id.get(skill_id)
            if skill and skill.get("name"):
                skills.append(
                    {
                        "name": skill.get("name"),
                        "description": skill.get("description") or "",
                        "content": skill.get("content") or "",
                    }
                )
    return skills


def write_agents(project_dir, agents, prompt):
    written = []
    claude_dir = os.path.join(project_dir, ".claude", "agents")
    opencode_dir = os.path.join(project_dir, ".opencode", "agents")
    os.makedirs(claude_dir, exist_ok=True)
    os.makedirs(opencode_dir, exist_ok=True)

    for agent in agents:
        name = agent["name"]
        claude_path = safe_file_path(claude_dir, name)
        opencode_path = safe_file_path(opencode_dir, name)
        if not claude_path or not opencode_path:
            continue
        display = sanitize_body(agent["display_name"])
        role = sanitize_body(agent["role"])
        soul = sanitize_body(agent["soul"])
        system_prompt = sanitize_body(agent["system_prompt"])
        description = f"{agent['role']} -- {agent['display_name']}. {first_line(agent['soul'], agent['display_name'])}"
        with open(claude_path, "w", encoding="utf-8") as handle:
            handle.write(
                f"---\n"
                f"name: {yaml_string(name)}\n"
                f"description: {yaml_string(description)}\n"
                f"tools: Read, Write, Edit, Bash, Grep, Glob\n"
                f"color: {yaml_string(color(agent['role']))}\n"
                f"---\n\n"
                f"# {display}\n\n"
                f"**Role:** {role}\n\n"
                f"## Soul\n{soul}\n\n"
                f"## System Prompt\n{system_prompt}\n"
            )
        with open(opencode_path, "w", encoding="utf-8") as handle:
            handle.write(
                f"---\n"
                f"description: {yaml_string(agent['role'] + ' -- ' + agent['display_name'])}\n"
                f"mode: subagent\n"
                f"color: {yaml_string(color(agent['role'], opencode=True))}\n"
                f"---\n\n"
                f"# {display}\n\n"
                f"You are **{display}**, a specialized agent with the role of **{role}**.\n\n"
                f"## Soul\n{soul}\n\n"
                f"## System Prompt\n{system_prompt}\n"
            )
        written.extend([claude_path, opencode_path])

    if prompt:
        write_marker_section(os.path.join(project_dir, ".claude", "CLAUDE.md"), prompt)
        write_marker_section(os.path.join(project_dir, "opencode.md"), prompt)
        written.extend([os.path.join(project_dir, ".claude", "CLAUDE.md"), os.path.join(project_dir, "opencode.md")])
    return written


def write_skills(project_dir, skills):
    written = []
    claude_dir = os.path.join(project_dir, ".claude", "skills")
    opencode_dir = os.path.join(project_dir, ".opencode", "skills")
    os.makedirs(claude_dir, exist_ok=True)
    os.makedirs(opencode_dir, exist_ok=True)
    for skill in skills:
        claude_path = safe_file_path(claude_dir, skill["name"])
        opencode_path = safe_file_path(opencode_dir, skill["name"])
        if not claude_path or not opencode_path:
            continue
        with open(claude_path, "w", encoding="utf-8") as handle:
            handle.write(
                f"---\n"
                f"name: {yaml_string(skill['name'])}\n"
                f"description: {yaml_string(skill.get('description') or '')}\n"
                f"---\n\n"
                f"{sanitize_body(skill.get('content') or '')}\n"
            )
        with open(opencode_path, "w", encoding="utf-8") as handle:
            handle.write(sanitize_body(skill.get("content") or "") + "\n")
        written.extend([claude_path, opencode_path])
    return written


def main():
    config_path = os.path.expanduser("~/.fyso/config.json")
    if not os.path.isfile(config_path):
        return 0
    config = load_json(config_path)
    if not config.get("token") or not config.get("tenant_id"):
        return 0

    hook = {}
    raw = sys.stdin.read().strip()
    if raw:
        try:
            hook = json.loads(raw)
        except Exception:
            hook = {}

    project_dir = find_project_dir(hook.get("cwd") or os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd())
    if not project_dir:
        return 0
    team_path = os.path.join(project_dir, ".fyso", "team.json")
    team_config = load_json(team_path)
    team_id = team_config.get("team_id")
    if not team_id:
        return 0

    local_version = numeric_version(team_config.get("version"))
    team_resp = request(config, "GET", f"/api/entities/teams/records/{urllib.parse.quote(team_id)}")
    team = team_resp.get("data") or team_resp
    remote_version = numeric_version(team.get("version"))
    if remote_version <= local_version:
        return 0

    agents = fetch_team_agents(config, team_id)
    skills = fetch_team_skills(config, team_id)
    written = write_agents(project_dir, agents, team.get("prompt") or "")
    written.extend(write_skills(project_dir, skills))

    os.makedirs(os.path.dirname(team_path), exist_ok=True)
    with open(team_path, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "team_id": team_id,
                "team_name": team.get("name") or team_config.get("team_name") or team_id,
                "version": remote_version,
                "synced_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
                .isoformat()
                .replace("+00:00", "Z"),
            },
            handle,
            indent=2,
        )
        handle.write("\n")

    print(
        f"[fyso] Equipo \"{team.get('name') or team_id}\" actualizado automaticamente "
        f"de v{local_version} a v{remote_version}; {len(agents)} agentes, "
        f"{len(skills)} skills, {len(written)} archivos sincronizados."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        raise SystemExit(0)
