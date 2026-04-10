#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CORE = join(ROOT, "core");

const SKILL_META: Record<string, { title: string; hosts: string[]; category: string }> = {
  "add-entity": { title: "Add Entity", hosts: ["claude", "codex"], category: "portable" },
  api: { title: "API", hosts: ["claude", "codex"], category: "portable" },
  audit: { title: "Audit", hosts: ["claude", "codex"], category: "portable" },
  build: { title: "Build", hosts: ["claude", "codex"], category: "portable" },
  deploy: { title: "Deploy", hosts: ["claude", "codex"], category: "portable" },
  entity: { title: "Entity", hosts: ["claude", "codex"], category: "portable" },
  expose: { title: "Expose", hosts: ["claude", "codex"], category: "portable" },
  fields: { title: "Fields", hosts: ["claude", "codex"], category: "portable" },
  fyso: { title: "Fyso", hosts: ["claude", "codex"], category: "portable" },
  "new-app": { title: "New App", hosts: ["claude", "codex"], category: "portable" },
  plan: { title: "Plan", hosts: ["claude", "codex"], category: "portable" },
  publish: { title: "Publish", hosts: ["claude", "codex"], category: "portable" },
  rules: { title: "Rules", hosts: ["claude", "codex"], category: "portable" },
  scan: { title: "Scan", hosts: ["claude", "codex"], category: "portable" },
  status: { title: "Status", hosts: ["claude", "codex"], category: "portable" },
  test: { title: "Test", hosts: ["claude", "codex"], category: "portable" },
  ui: { title: "UI", hosts: ["claude", "codex"], category: "portable" },
  verify: { title: "Verify", hosts: ["claude", "codex"], category: "portable" },
  welcome: { title: "Welcome", hosts: ["claude", "codex"], category: "portable" },
};

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/`?\/fyso:ui build`?/g, "the UI build workflow"],
  [/`?\/fyso:ui infer`?/g, "the UI infer workflow"],
  [/`?\/fyso:ui plan`?/g, "the UI planning workflow"],
  [/`?\/fyso:ui mockup`?/g, "the UI mockup workflow"],
  [/`?\/fyso:ui contracts`?/g, "the UI contracts workflow"],
  [/`?\/fyso:ui audit`?/g, "the UI audit workflow"],
  [/`?\/fyso:ui all`?/g, "the UI end-to-end workflow"],
  [/`?\/fyso:ui`?/g, "the UI workflow"],
  [/`?\/fyso:plan discuss`?/g, "the phase discussion workflow"],
  [/`?\/fyso:plan phase`?/g, "the phase planning workflow"],
  [/`?\/fyso:plan new`?/g, "the new-app planning workflow"],
  [/`?\/fyso:plan`?/g, "the plan workflow"],
  [/`?\/fyso:build`?/g, "the build workflow"],
  [/`?\/fyso:verify`?/g, "the verification workflow"],
  [/`?\/fyso:scan`?/g, "the scan workflow"],
  [/`?\/fyso:status`?/g, "the status workflow"],
  [/`?\/fyso:expose`?/g, "the expose workflow"],
  [/`?\/fyso:add-entity`?/g, "the add-entity workflow"],
  [/`?\/fyso:rules`?/g, "the rules workflow"],
  [/`?\/fyso:deploy`?/g, "the deploy workflow"],
  [/`?\/fyso:audit`?/g, "the audit workflow"],
  [/`?\/fyso-api`?/g, "the API workflow"],
  [/`?\/fyso-ui`?/g, "the UI workflow"],
  [/`?\/fyso-add-entity`?/g, "the add-entity workflow"],
  [/`?\/fyso-deploy`?/g, "the deploy workflow"],
  [/`?\/fyso-rules`?/g, "the rules workflow"],
  [/`?\/fyso-test`?/g, "the test workflow"],
  [/`?\/fyso-entity`?/g, "the entity workflow"],
  [/`?\/fyso-fields`?/g, "the fields workflow"],
  [/`?\/fyso-new-app`?/g, "the new-app workflow"],
  [/`?\/fyso-init`?/g, "the project initialization workflow"],
  [/`?\/fyso-mcp`?/g, "the MCP setup workflow"],
  [/\bClaude Code\b/g, "the host agent"],
  [/\bClaude Desktop\b/g, "the host agent desktop client"],
  [/\bClaude\b/g, "the host agent"],
  [/\bCodex\b/g, "the host agent"],
  [/\bclaude-sonnet-4-6\b/g, "sonnet-4-6"],
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full, out);
      continue;
    }
    out.push(full);
  }
  return out;
}

function addSkillMetadata(filePath: string, skillId: string): string {
  const meta = SKILL_META[skillId];
  const content = readFileSync(filePath, "utf8");

  if (!content.startsWith("---\n")) {
    return content;
  }

  const end = content.indexOf("\n---\n", 4);
  if (end === -1) {
    return content;
  }

  const frontmatter = content.slice(4, end).trimEnd().split("\n");
  const body = content.slice(end + 5);
  const lines = frontmatter.filter((line) => !/^id: |^title: |^hosts: |^category: /.test(line));
  lines.push(`id: ${skillId}`);
  lines.push(`title: "${meta.title}"`);
  lines.push(`hosts: [${meta.hosts.map((host) => `"${host}"`).join(", ")}]`);
  lines.push(`category: ${meta.category}`);

  return `---\n${lines.join("\n")}\n---\n${body}`;
}

function normalizeContent(content: string): string {
  let next = content;
  for (const [pattern, replacement] of REPLACEMENTS) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

for (const filePath of walk(CORE)) {
  if (!/\.(md|json)$/.test(filePath)) {
    continue;
  }

  let content = readFileSync(filePath, "utf8");
  const relativePath = relative(CORE, filePath).replaceAll("\\", "/");
  const skillMatch = relativePath.match(/^skills\/([^/]+)\/SKILL\.md$/);

  if (skillMatch) {
    content = addSkillMetadata(filePath, skillMatch[1]);
  }

  content = normalizeContent(content);
  writeFileSync(filePath, content);
}
