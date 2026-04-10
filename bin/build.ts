#!/usr/bin/env bun

import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const CORE = join(ROOT, "core");
const ADAPTERS = join(ROOT, "adapters");
const DIST = join(ROOT, "dist");

const hostArgIndex = process.argv.indexOf("--host");
const requestedHost = hostArgIndex >= 0 ? process.argv[hostArgIndex + 1] : "all";
const hosts = requestedHost === "all" ? ["claude", "codex"] : [requestedHost];

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

function parseHosts(filePath: string): string[] {
  const content = readFileSync(filePath, "utf8");
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    return ["claude", "codex"];
  }
  const hostsMatch = match[1].match(/^hosts:\s*\[(.*?)\]$/m);
  if (!hostsMatch) {
    return ["claude", "codex"];
  }
  return hostsMatch[1]
    .split(",")
    .map((item) => item.trim().replace(/^"|"$/g, ""))
    .filter(Boolean);
}

function copyCore(host: string, targetDir: string) {
  mkdirSync(targetDir, { recursive: true });

  copyFileSync(join(CORE, ".mcp.json"), join(targetDir, ".mcp.json"));
  copyFileSync(join(CORE, "FYSO-REFERENCE.md"), join(targetDir, "FYSO-REFERENCE.md"));
  mkdirSync(join(targetDir, "bin"), { recursive: true });
  copyFileSync(join(ROOT, "bin", "sync-reference.ts"), join(targetDir, "bin", "sync-reference.ts"));

  for (const filePath of walk(join(CORE, "skills"))) {
    const relativePath = relative(join(CORE, "skills"), filePath);
    if (relativePath.endsWith("SKILL.md")) {
      const supportedHosts = parseHosts(filePath);
      if (!supportedHosts.includes(host)) {
        continue;
      }
    }

    const targetPath = join(targetDir, "skills", relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(filePath, targetPath);
  }
}

function copyAdapter(host: string, targetDir: string) {
  const adapterDir = join(ADAPTERS, host);
  if (!existsSync(adapterDir)) {
    throw new Error(`Missing adapter: ${host}`);
  }

  for (const entry of readdirSync(adapterDir)) {
    const sourcePath = join(adapterDir, entry);
    const targetPath = join(targetDir, entry);
    const stats = statSync(sourcePath);

    if (entry === "skills") {
      for (const filePath of walk(sourcePath)) {
        const relativePath = relative(sourcePath, filePath);
        const finalPath = join(targetDir, "skills", relativePath);
        mkdirSync(dirname(finalPath), { recursive: true });
        copyFileSync(filePath, finalPath);
      }
      continue;
    }

    if (entry === "README.md") {
      copyFileSync(sourcePath, targetPath);
      continue;
    }

    if (stats.isDirectory()) {
      cpSync(sourcePath, targetPath, { recursive: true });
      continue;
    }

    copyFileSync(sourcePath, targetPath);
  }
}

for (const host of hosts) {
  const targetDir = join(DIST, host);
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  copyCore(host, targetDir);
  copyAdapter(host, targetDir);
  writeFileSync(join(targetDir, ".build-host"), `${host}\n`);
}

console.log(`Built: ${hosts.join(", ")}`);
