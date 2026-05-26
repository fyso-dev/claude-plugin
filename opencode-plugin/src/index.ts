import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { createTracker } from "./tracking"
import { readConfig, readTeamConfig } from "./config"
import {
  listTeams,
  syncTeamById,
  autoSyncTeamIfNeeded,
} from "./tools/sync-team"
import { createAgent, createAgentGuide } from "./tools/create-agent"
import { listAgents, createTeam, assignAgents } from "./tools/create-team"

const HEARTBEAT_INTERVAL = 5 * 60 * 1000 // 5 minutes

export const FysoPlugin: Plugin = async (ctx) => {
  const tracker = createTracker()
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let currentSessionID: string | undefined
  let recentTools: string[] = []
  const modelBySession = new Map<string, string>()
  const usageSeenBySession = new Map<string, string>()
  const autoSyncStartedBySession = new Set<string>()

  function modelName(model?: { providerID?: string; modelID?: string; id?: string }) {
    if (!model) return undefined
    const id = model.modelID || model.id
    if (!id) return undefined
    if (/^(msg|prt|call)_/i.test(id)) return undefined
    return model.providerID ? `${model.providerID}/${id}` : id
  }

  function tokenValue(value: unknown): number {
    return typeof value === "number" && Number.isFinite(value) ? value : 0
  }

  async function trackStepTokens(event: unknown) {
    const typed = event as {
      type?: string
      properties?: {
        sessionID?: string
        part?: {
          type?: string
          id?: string
          tokens?: {
            input?: number
            output?: number
            reasoning?: number
            cache?: { read?: number; write?: number }
          }
        }
        tokens?: {
          input?: number
          output?: number
          reasoning?: number
          cache?: { read?: number; write?: number }
        }
      }
    }
    const sessionID = typed.properties?.sessionID
    const part = typed.properties?.part
    const tokens = part?.tokens || typed.properties?.tokens
    if (!sessionID || !tokens) return
    if (part && part.type && part.type !== "step-finish") return

    const input = tokenValue(tokens.input)
    const output = tokenValue(tokens.output) + tokenValue(tokens.reasoning)
    const cacheRead = tokenValue(tokens.cache?.read)
    const cacheWrite = tokenValue(tokens.cache?.write)
    const total = input + output + cacheRead + cacheWrite
    if (total <= 0) return

    const dedupeKey = `${input}:${output}:${cacheWrite}:${cacheRead}`
    if (usageSeenBySession.get(sessionID) === dedupeKey) return
    usageSeenBySession.set(sessionID, dedupeKey)

    await tracker.sessionUsage({
      sessionID,
      directory: ctx.directory,
      detail: "session usage",
      model: modelBySession.get(sessionID),
      input_tokens: input,
      output_tokens: output,
      cache_creation_tokens: cacheWrite,
      cache_read_tokens: cacheRead,
    })
  }

  async function autoSyncSavedTeam(sessionID?: string) {
    const config = await readConfig()
    if (!config) return
    try {
      const teamConfig = await readTeamConfig(ctx.directory)
      const result = await autoSyncTeamIfNeeded(config, teamConfig, ctx.directory)
      if (result.synced) {
        await tracker.toolExecuted({
          sessionID,
          directory: ctx.directory,
          tool: "fyso-auto-sync-team",
          agent: result.teamName,
        })
      }
    } catch {
      // Session startup must never fail because the team update check failed.
    }
  }

  async function startTrackingSession(sessionID?: string) {
    currentSessionID = sessionID
    recentTools = []

    await tracker.sessionStart({
      sessionID: currentSessionID,
      directory: ctx.directory,
    })

    await autoSyncSavedTeam(currentSessionID)

    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = setInterval(async () => {
      const detail =
        recentTools.length > 0
          ? `Tools: ${recentTools.slice(-5).join(", ")}`
          : "idle"
      await tracker.heartbeat({
        sessionID: currentSessionID,
        directory: ctx.directory,
        detail,
      })
    }, HEARTBEAT_INTERVAL)
  }

  async function endTrackingSession() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    await tracker.sessionEnd({
      sessionID: currentSessionID,
      directory: ctx.directory,
    })
  }

  return {
    event: async ({ event }) => {
      const typed = event as {
        type?: string
        properties?: {
          sessionID?: string
          session?: { id?: string }
          info?: {
            sessionID?: string
            role?: string
            modelID?: string
            providerID?: string
            tokens?: {
              input?: number
              output?: number
              reasoning?: number
              cache?: { read?: number; write?: number }
            }
          }
        }
      }
      if (typed.type === "session.created") {
        await startTrackingSession(typed.properties?.sessionID || typed.properties?.session?.id)
      }
      if (typed.type === "session.deleted") {
        await endTrackingSession()
      }
      if (typed.type === "message.updated") {
        const info = typed.properties?.info
        const sessionID = info?.sessionID
        const model = modelName(info)
        if (sessionID && model) modelBySession.set(sessionID, model)
        if (info?.role === "assistant" && sessionID && info.tokens) {
          await trackStepTokens({
            type: typed.type,
            properties: { sessionID, tokens: info.tokens },
          })
        }
      }
      if (typed.type === "message.part.updated") {
        await trackStepTokens(event)
      }
      if (typed.type === "session.next.model.switched") {
        const next = event as {
          properties?: {
            sessionID?: string
            model?: { providerID?: string; modelID?: string; id?: string }
          }
        }
        const sessionID = next.properties?.sessionID
        const model = modelName(next.properties?.model)
        if (sessionID && model) modelBySession.set(sessionID, model)
      }
      if (typed.type === "session.next.step.ended") {
        await trackStepTokens(event)
      }
    },

    "chat.message": async (input) => {
      if (input.sessionID && !autoSyncStartedBySession.has(input.sessionID)) {
        autoSyncStartedBySession.add(input.sessionID)
        void autoSyncSavedTeam(input.sessionID)
      }
      const model = modelName(input.model)
      if (model) modelBySession.set(input.sessionID, model)
    },

    tool: {
      "fyso-sync-team": tool({
        description:
          "Sync a Fyso agent team to local directories. Lists teams, lets user pick one, then downloads agent definitions and creates files for Claude Code (.claude/agents/) and OpenCode (.opencode/agents/).",
        args: {
          team_id: tool.schema
            .string()
            .optional()
            .describe(
              "Team ID to sync. If omitted, lists all teams and returns them for user selection.",
            ),
        },
        async execute(args, context) {
          const config = await readConfig()
          if (!config) {
            return "No Fyso credentials found. Run the sync-team skill first to configure credentials at ~/.fyso/config.json, or visit https://agent-ui-sites.fyso.dev/ to get your token."
          }

          const cwd = context.directory || process.cwd()

          // If no team_id, list teams for selection
          if (!args.team_id) {
            const teams = await listTeams(config)
            if (!teams.length) {
              return "No teams found in your Fyso account."
            }
            const list = teams.map((t, i) => `${i + 1}. **${t.name}** (ID: ${t.id})`).join("\n")
            return `Available teams:\n\n${list}\n\nCall this tool again with the team_id to sync.`
          }

          const synced = await syncTeamById(config, args.team_id, cwd)
          if (!synced.agents.length) {
            return `No agents found for team ${args.team_id}. Check the team configuration at https://agent-ui-sites.fyso.dev/`
          }

          const summary = [
            `Synced **${synced.agents.length}** agents for team "${synced.team?.name || args.team_id}":`,
            "",
            ...synced.agents.map((a) => `- **${a.display_name}** (${a.role})`),
            "",
            `Files created (${synced.files.length}):`,
            ...synced.files.map((f) => `- ${f}`),
            "",
            synced.skills.length
              ? `Synced **${synced.skills.length}** team skills.`
              : "No team skills configured.",
            "",
            synced.team?.prompt
              ? "Team prompt written to `.claude/CLAUDE.md` and `opencode.md`."
              : "No team prompt configured.",
            "",
            "Agents are now available as subagents:",
            "- **Claude Code**: via Agent tool",
            "- **OpenCode**: via @ mention",
          ]
          return summary.join("\n")
        },
      }),

      "fyso-create-team": tool({
        description:
          "Create a new Fyso agent team. Call with no args to list available agents for selection; call with name to create the team. Optionally assigns initial agents.",
        args: {
          name: tool.schema
            .string()
            .optional()
            .describe("Team name. If omitted, the tool lists available agents instead."),
          prompt: tool.schema
            .string()
            .optional()
            .describe("Team system prompt -- shared instructions for all agents on the team."),
          description: tool.schema
            .string()
            .optional()
            .describe("Short human-readable description of the team."),
          agent_ids: tool.schema
            .array(tool.schema.string())
            .optional()
            .describe("IDs of agents to assign to the team at creation."),
        },
        async execute(args) {
          const config = await readConfig()
          if (!config) {
            return "No Fyso credentials found. Run the sync-team skill first to configure credentials at ~/.fyso/config.json, or visit https://agent-ui-sites.fyso.dev/ to get your token."
          }

          if (!args.name) {
            const agents = await listAgents(config)
            if (!agents.length) {
              return "No agents found in your Fyso account. Create agents in the Fyso dashboard before assembling a team."
            }
            const list = agents
              .map((a, i) => `${i + 1}. **${a.display_name}** (${a.role}) -- ID: ${a.id}`)
              .join("\n")
            return `Available agents to assign:\n\n${list}\n\nCall this tool again with name, prompt, description, and agent_ids to create the team.`
          }

          const created = await createTeam(config, {
            name: args.name,
            prompt: args.prompt,
            description: args.description,
          })

          let assignedCount = 0
          let failedLines: string[] = []
          if (args.agent_ids?.length) {
            const result = await assignAgents(config, created.id, args.agent_ids)
            assignedCount = result.assigned_agent_ids.length
            if (result.failed.length) {
              failedLines = [
                `Failed to assign ${result.failed.length} agent(s):`,
                ...result.failed.map((f) => `- ${f.agent_id}: ${f.message}`),
              ]
            }
          }

          const summary = [
            `Team **${created.name}** created (ID: ${created.id}).`,
            created.description ? `Description: ${created.description}` : "",
            created.prompt ? "Team prompt saved." : "No team prompt set.",
            assignedCount
              ? `Assigned ${assignedCount} agent(s) to the team.`
              : "No agents assigned yet -- use the Fyso dashboard or call this tool again with agent_ids.",
            ...failedLines,
            "",
            "Run /fyso:sync-team (Claude Code) or the fyso-sync-team tool (OpenCode) to pull this team into the current project.",
          ]
          return summary.filter(Boolean).join("\n")
        },
      }),

      "fyso-create-agent": tool({
        description:
          "Guided Fyso agent creation. Call with no args to get the prompt-writing wizard; call with name, role, soul, and system_prompt to create the agent.",
        args: {
          name: tool.schema
            .string()
            .optional()
            .describe("Agent identifier or human name. If omitted, returns the guided wizard."),
          display_name: tool.schema
            .string()
            .optional()
            .describe("Human-readable agent name shown in Fyso Teams."),
          role: tool.schema
            .string()
            .optional()
            .describe("Short role label, e.g. developer, qa, reviewer, designer."),
          soul: tool.schema
            .string()
            .optional()
            .describe("Short identity/mission statement for the agent."),
          system_prompt: tool.schema
            .string()
            .optional()
            .describe("Operational system prompt with responsibilities, constraints, and output expectations."),
          status: tool.schema
            .string()
            .optional()
            .describe("Initial status: active, idle, sleeping, or offline. Defaults to active."),
        },
        async execute(args) {
          const config = await readConfig()
          if (!config) {
            return "No Fyso credentials found. Run the sync-team skill first to configure credentials at ~/.fyso/config.json, or visit https://agent-ui-sites.fyso.dev/ to get your token."
          }

          if (!args.name) {
            return createAgentGuide()
          }

          const created = await createAgent(config, {
            name: args.name,
            display_name: args.display_name,
            role: args.role,
            soul: args.soul,
            system_prompt: args.system_prompt,
            status: args.status,
          })

          return [
            `Agent **${created.display_name}** created (ID: ${created.id}).`,
            `Name: ${created.name}`,
            `Role: ${created.role}`,
            created.soul ? `Soul: ${created.soul}` : "No soul configured.",
            created.system_prompt ? "System prompt saved." : "No system prompt configured.",
            "",
            "Add it to a team from the Fyso dashboard or create a team with fyso-create-team, then run fyso-sync-team to pull it into the current project.",
          ].join("\n")
        },
      }),
    },

    "tool.execute.after": async (input, output) => {
      const toolName = input.tool || ""
      if (toolName) recentTools.push(toolName)
      if (input.sessionID && input.sessionID !== currentSessionID) {
        await startTrackingSession(input.sessionID)
      }

      const metadata = (output.metadata || {}) as Record<string, unknown>
      const args = (input.args || {}) as Record<string, unknown>

      await tracker.toolExecuted({
        sessionID: input.sessionID || currentSessionID,
        directory: ctx.directory,
        tool: toolName,
        agent: (args.agent as string) || (metadata.agent as string) || undefined,
        model: (metadata.model as string) || (args.model as string) || undefined,
        input_tokens: (metadata.input_tokens as number) || undefined,
        output_tokens: (metadata.output_tokens as number) || undefined,
        cache_creation_tokens: (metadata.cache_creation_tokens as number) || undefined,
        cache_read_tokens: (metadata.cache_read_tokens as number) || undefined,
      })
    },
  }
}

export default FysoPlugin
