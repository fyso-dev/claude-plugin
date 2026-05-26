import { readConfig, readTeamConfig, apiRequest } from "../config"
import { readFile, writeFile, mkdir, rm } from "fs/promises"
import { existsSync } from "fs"
import { basename, join, resolve, sep } from "path"

interface Agent {
  name: string
  display_name: string
  role: string
  soul: string
  system_prompt: string
}

export interface Team {
  id: string
  name: string
  prompt?: string
  version?: number
}

interface TeamSkill {
  name: string
  description?: string
  content: string
}

interface AgentRelation {
  _agent?: Agent
  agent?: Agent | string
}

interface SkillRelation extends TeamSkill {
  _skill?: TeamSkill
  skill?: TeamSkill | string
}

const ROLE_COLORS: Record<string, string> = {
  developer: "green",
  qa: "yellow",
  tester: "yellow",
  reviewer: "purple",
  coordinator: "blue",
  writer: "cyan",
  security: "red",
  triage: "orange",
}

const OPENCODE_ROLE_COLORS: Record<string, string> = {
  developer: "success",
  qa: "warning",
  tester: "warning",
  reviewer: "accent",
  coordinator: "info",
  writer: "info",
  security: "error",
  triage: "warning",
}

const SAFE_AGENT_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/

export function isSafeAgentName(name: string): boolean {
  return typeof name === "string" && SAFE_AGENT_NAME_RE.test(name)
}

export function resolveAgentFilePath(dir: string, name: string): string | null {
  if (!isSafeAgentName(name)) return null
  // Defense-in-depth: strip any directory component the regex might have missed
  // and require the basename to round-trip identically.
  const safe = basename(name)
  if (safe !== name) return null
  const filePath = join(dir, `${safe}.md`)
  const dirResolved = resolve(dir) + sep
  const fileResolved = resolve(filePath)
  if (!fileResolved.startsWith(dirResolved)) return null
  return filePath
}

export function resolveSkillFilePath(dir: string, name: string): string | null {
  return resolveAgentFilePath(dir, name)
}

// YAML double-quoted scalar with escaping. Safe against newline / quote / colon
// injection, so untrusted strings cannot inject extra frontmatter fields.
export function yamlString(value: string): string {
  const escaped = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t")
  return `"${escaped}"`
}

// Defensive: prevent untrusted body content from containing a line that is
// exactly `---`, which a lenient parser could mistake for a frontmatter fence.
export function sanitizeMarkdownBody(value: string): string {
  return String(value).replace(/^---\s*$/gm, "\u200B---")
}

function getColor(role: string): string {
  const lower = role.toLowerCase()
  for (const [key, color] of Object.entries(ROLE_COLORS)) {
    if (lower.includes(key)) return color
  }
  return "gray"
}

function getOpencodeColor(role: string): string {
  const lower = role.toLowerCase()
  for (const [key, color] of Object.entries(OPENCODE_ROLE_COLORS)) {
    if (lower.includes(key)) return color
  }
  return "secondary"
}

function firstLineOf(text: string, fallback: string): string {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  return line || fallback
}

async function writeMarkerSection(filePath: string, content: string): Promise<void> {
  const START = "<!-- FYSO TEAM START -->"
  const END = "<!-- FYSO TEAM END -->"
  const section = `${START}\n${content}\n${END}`

  if (existsSync(filePath)) {
    const existing = await readFile(filePath, "utf-8")
    const startIdx = existing.indexOf(START)
    const endIdx = existing.indexOf(END)
    if (startIdx !== -1 && endIdx !== -1) {
      const updated = existing.slice(0, startIdx) + section + existing.slice(endIdx + END.length)
      await writeFile(filePath, updated)
      return
    }
    await writeFile(filePath, existing + "\n\n" + section + "\n")
    return
  }
  await writeFile(filePath, section + "\n")
}

export async function listTeams(config: NonNullable<Awaited<ReturnType<typeof readConfig>>>) {
  const resp = (await apiRequest(config, "GET", "/api/entities/teams/records")) as {
    data?: { items?: Team[] }
  }
  return resp?.data?.items || []
}

export async function fetchTeamAgents(
  config: NonNullable<Awaited<ReturnType<typeof readConfig>>>,
  teamId: string,
) {
  const resp = (await apiRequest(
    config,
    "GET",
    `/api/entities/team_agents/records?resolve=true&filter.team=${teamId}`,
  )) as {
    data?: { items?: AgentRelation[] }
  }
  const items = resp?.data?.items || []
  const resolved = items
    .map((item) => item._agent || (typeof item.agent === "object" ? item.agent : undefined))
    .filter((a): a is Agent => !!a)
  const missingIds = items
    .map((item) => (typeof item.agent === "string" ? item.agent : undefined))
    .filter((id): id is string => !!id)

  if (missingIds.length) {
    const agentsResp = (await apiRequest(config, "GET", "/api/entities/agents/records")) as {
      data?: { items?: Array<Agent & { id?: string }> }
    }
    const agentsById = new Map((agentsResp?.data?.items || []).map((agent) => [agent.id, agent]))
    for (const id of missingIds) {
      const agent = agentsById.get(id)
      if (agent) resolved.push(agent)
    }
  }

  return resolved.map((a) => ({
    name: a.name || "unnamed",
    display_name: a.display_name || a.name || "Unnamed Agent",
    role: a.role || "assistant",
    soul: a.soul || "",
    system_prompt: a.system_prompt || "",
  }))
}

export async function fetchTeamSkills(
  config: NonNullable<Awaited<ReturnType<typeof readConfig>>>,
  teamId: string,
) {
  let resp: {
    data?: { items?: SkillRelation[] }
  }
  try {
    resp = (await apiRequest(
      config,
      "GET",
      `/api/entities/team_skills/records?resolve=true&filter.team=${teamId}`,
    )) as typeof resp
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes("Entity 'team_skills' not found")) {
      return []
    }
    throw err
  }
  const items = resp?.data?.items || []
  const resolved = items
    .map((item) => item._skill || (typeof item.skill === "object" ? item.skill : undefined) || item)
    .filter((skill): skill is TeamSkill => !!skill && !!skill.name)

  const missingIds = items
    .map((item) => (typeof item.skill === "string" ? item.skill : undefined))
    .filter((id): id is string => !!id)
  if (missingIds.length) {
    const skillsResp = (await apiRequest(config, "GET", "/api/entities/skills/records")) as {
      data?: { items?: Array<TeamSkill & { id?: string }> }
    }
    const skillsById = new Map((skillsResp?.data?.items || []).map((skill) => [skill.id, skill]))
    for (const id of missingIds) {
      const skill = skillsById.get(id)
      if (skill) resolved.push(skill)
    }
  }

  return resolved
    .map((skill) => ({
      name: skill.name,
      description: skill.description || "",
      content: skill.content || "",
    }))
}

interface SafeAgentFields {
  name: string
  display: string
  role: string
  soul: string
  systemPrompt: string
  color: string
}

function sanitizeAgent(agent: Agent): SafeAgentFields {
  return {
    name: agent.name,
    display: sanitizeMarkdownBody(agent.display_name),
    role: sanitizeMarkdownBody(agent.role),
    soul: sanitizeMarkdownBody(agent.soul),
    systemPrompt: sanitizeMarkdownBody(agent.system_prompt),
    color: getColor(agent.role),
  }
}

function renderClaudeAgent(agent: Agent, safe: SafeAgentFields): string {
  const firstLine = firstLineOf(agent.soul, agent.display_name)
  const description = `${agent.role} -- ${agent.display_name}. ${firstLine}`
  return `---
name: ${yamlString(agent.name)}
description: ${yamlString(description)}
tools: Read, Write, Edit, Bash, Grep, Glob
color: ${yamlString(safe.color)}
---

# ${safe.display}

**Role:** ${safe.role}

## Soul
${safe.soul}

## System Prompt
${safe.systemPrompt}
`
}

function renderOpencodeAgent(agent: Agent, safe: SafeAgentFields): string {
  const description = `${agent.role} -- ${agent.display_name}`
  return `---
description: ${yamlString(description)}
mode: subagent
color: ${yamlString(getOpencodeColor(agent.role))}
---

# ${safe.display}

You are **${safe.display}**, a specialized agent with the role of **${safe.role}**.

## Soul
${safe.soul}

## System Prompt
${safe.systemPrompt}
`
}

async function writeAgentsTo(
  agents: Agent[],
  dir: string,
  render: (agent: Agent, safe: SafeAgentFields) => string,
  created: string[],
): Promise<void> {
  await mkdir(dir, { recursive: true })
  for (const agent of agents) {
    const filePath = resolveAgentFilePath(dir, agent.name)
    if (!filePath) {
      console.warn(`[fyso] skipping agent with unsafe name: ${JSON.stringify(agent.name)}`)
      continue
    }
    if (existsSync(filePath)) await rm(filePath)
    await writeFile(filePath, render(agent, sanitizeAgent(agent)))
    created.push(filePath)
  }
}

function renderClaudeSkill(skill: TeamSkill): string {
  return `---
name: ${yamlString(skill.name)}
description: ${yamlString(skill.description || "")}
---

${sanitizeMarkdownBody(skill.content || "")}
`
}

function renderOpencodeSkill(skill: TeamSkill): string {
  return sanitizeMarkdownBody(skill.content || "") + "\n"
}

async function writeSkillsTo(
  skills: TeamSkill[],
  dir: string,
  render: (skill: TeamSkill) => string,
  created: string[],
): Promise<void> {
  await mkdir(dir, { recursive: true })
  for (const skill of skills) {
    const filePath = resolveSkillFilePath(dir, skill.name)
    if (!filePath) {
      console.warn(`[fyso] skipping skill with unsafe name: ${JSON.stringify(skill.name)}`)
      continue
    }
    if (existsSync(filePath)) await rm(filePath)
    await writeFile(filePath, render(skill))
    created.push(filePath)
  }
}

export async function syncAgentsToDirectory(
  agents: Agent[],
  cwd: string,
  teamPrompt?: string,
): Promise<string[]> {
  const created: string[] = []

  await writeAgentsTo(agents, join(cwd, ".claude", "agents"), renderClaudeAgent, created)
  await writeAgentsTo(agents, join(cwd, ".opencode", "agents"), renderOpencodeAgent, created)

  if (teamPrompt) {
    const claudeMd = join(cwd, ".claude", "CLAUDE.md")
    await mkdir(join(cwd, ".claude"), { recursive: true })
    await writeMarkerSection(claudeMd, teamPrompt)
    created.push(claudeMd)

    const opencodeMd = join(cwd, "opencode.md")
    await writeMarkerSection(opencodeMd, teamPrompt)
    created.push(opencodeMd)
  }

  return created
}

export async function syncSkillsToDirectory(skills: TeamSkill[], cwd: string): Promise<string[]> {
  const created: string[] = []
  await writeSkillsTo(skills, join(cwd, ".claude", "skills"), renderClaudeSkill, created)
  await writeSkillsTo(skills, join(cwd, ".opencode", "skills"), renderOpencodeSkill, created)
  return created
}
