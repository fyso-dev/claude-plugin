#!/usr/bin/env bun

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CORE = join(ROOT, "core");
const BANNED = [
  /Claude/g,
  /Codex/g,
  /(^|[\s`(])\/fyso:/gm,
  /(^|[\s`(])\/fyso-/gm,
  /\.claude/g,
  /\.codex-plugin/g,
  /CLAUDE_PLUGIN_ROOT/g,
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

const failures: string[] = [];

for (const filePath of walk(CORE)) {
  if (!/\.(md|json)$/.test(filePath)) {
    continue;
  }

  const content = readFileSync(filePath, "utf8");
  for (const pattern of BANNED) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match) {
      failures.push(`${relative(ROOT, filePath)} contains banned token "${match[0]}"`);
    }
  }
}

if (failures.length > 0) {
  console.error("Core validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Core validation passed.");
