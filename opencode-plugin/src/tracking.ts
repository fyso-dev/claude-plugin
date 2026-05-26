import { readConfig, readTeamConfig, apiRequest, debugLog } from "./config"
import { createHash } from "crypto"
import { userInfo } from "os"
import { readFileSync } from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

const pricingData = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "pricing.json"), "utf8"),
) as {
  default_family: string
  pricing: Record<string, Record<string, number>>
}

const DEFAULT_FAMILY = pricingData.default_family

interface TrackingEvent {
  event: string
  tool?: string
  agent?: string
  detail?: string
  team_name?: string
  user?: string
  source?: string
  session_id?: string
  model?: string
  model_family?: string
  message_id?: string
  tokens?: number
  input_tokens?: number
  output_tokens?: number
  cache_creation_tokens?: number
  cache_read_tokens?: number
  session_tokens?: number
  session_input_tokens?: number
  session_output_tokens?: number
  session_cache_creation_tokens?: number
  session_cache_read_tokens?: number
  cost_usd?: number
  session_cost_usd?: number
  cwd?: string
  timestamp: string
}

export function inferModelFamily(model: string): string {
  if (model.includes("opus")) return "opus"
  if (model.includes("sonnet")) return "sonnet"
  if (model.includes("haiku")) return "haiku"
  return DEFAULT_FAMILY
}

export const PRICING = pricingData.pricing
const KNOWN_FAMILIES = new Set(Object.keys(PRICING))

export interface SessionTokens {
  input: number
  output: number
  cache_creation: number
  cache_read: number
}

export function totalSessionTokens(t: SessionTokens): number {
  return t.input + t.output + t.cache_creation + t.cache_read
}

export function calculateCost(
  family: string,
  input: number,
  output: number,
  cacheWrite: number,
  cacheRead: number,
): number {
  const p = PRICING[family]
  if (!p) return 0
  return (
    (input / 1e6) * p.input +
    (output / 1e6) * p.output +
    (cacheWrite / 1e6) * p.cache_write +
    (cacheRead / 1e6) * p.cache_read
  )
}

function roundCost(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

function knownModelFamily(model: string): string | undefined {
  const normalized = model.toLowerCase()
  if (/opus|sonnet|haiku/i.test(model)) {
    const family = inferModelFamily(model)
    return KNOWN_FAMILIES.has(family) ? family : undefined
  }

  const openaiFamily = [
    "gpt-5.5",
    "gpt-5.4-mini",
    "gpt-5.4",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5",
  ].find((family) => normalized.includes(family))
  return openaiFamily && KNOWN_FAMILIES.has(openaiFamily) ? openaiFamily : undefined
}

export function createTracker() {
  let sessionTokens: SessionTokens = {
    input: 0,
    output: 0,
    cache_creation: 0,
    cache_read: 0,
  }
  let lastModel = ""

  async function send(
    config: NonNullable<Awaited<ReturnType<typeof readConfig>>>,
    event: Partial<TrackingEvent> & { event: string },
  ) {
    try {
      const payload: Record<string, unknown> = {
        ...event,
        timestamp: new Date().toISOString(),
      }
      // Remove null/undefined
      for (const key of Object.keys(payload)) {
        if (payload[key] == null) delete payload[key]
      }

      await debugLog(`TRACKING: ${JSON.stringify(payload)}`)
      await apiRequest(config, "POST", "/api/entities/tracking/records", payload)
    } catch (e) {
      await debugLog(`TRACKING_ERROR: ${e}`)
    }
  }

  async function resolveContext(
    directory: string | undefined,
    modelOverride?: string,
    fallbackModel?: string,
  ) {
    const config = await readConfig()
    if (!config) return null
    const team = await readTeamConfig(directory || process.cwd())
    const model = modelOverride || lastModel || fallbackModel || ""
    const family = model ? knownModelFamily(model) : undefined
    const user = config.user_email || userInfo().username
    return { config, team, user, model, family }
  }

  return {
    async sessionStart(ctx: { sessionID?: string; directory?: string }) {
      const resolved = await resolveContext(ctx.directory)
      if (!resolved) return
      const { config, team, user, model, family } = resolved
      const sessionId =
        ctx.sessionID ||
        createHash("md5")
          .update(`${process.ppid}-${new Date().toISOString().split("T")[0]}`)
          .digest("hex")
          .slice(0, 12)

      await send(config, {
        event: "session_start",
        detail: "session start",
        team_name: team?.team_name,
        user,
        source: "opencode",
        session_id: sessionId,
        model: model || undefined,
        model_family: family,
        cwd: ctx.directory,
      })
    },

    async toolExecuted(ctx: {
      sessionID?: string
      directory?: string
      tool?: string
      agent?: string
      model?: string
      input_tokens?: number
      output_tokens?: number
      cache_creation_tokens?: number
      cache_read_tokens?: number
    }) {
      const resolved = await resolveContext(ctx.directory, ctx.model)
      if (!resolved) return
      const { config, team, user, model, family } = resolved
      if (ctx.model) lastModel = ctx.model

      const inputTokens = ctx.input_tokens || 0
      const outputTokens = ctx.output_tokens || 0
      const cacheCreation = ctx.cache_creation_tokens || 0
      const cacheRead = ctx.cache_read_tokens || 0
      const tokens = inputTokens + outputTokens + cacheCreation + cacheRead

      sessionTokens.input += inputTokens
      sessionTokens.output += outputTokens
      sessionTokens.cache_creation += cacheCreation
      sessionTokens.cache_read += cacheRead

      await send(config, {
        event: "agent_dispatch",
        tool: ctx.tool,
        agent: ctx.agent,
        team_name: team?.team_name,
        user,
        source: "opencode",
        session_id: ctx.sessionID,
        model: model || undefined,
        model_family: family,
        tokens: tokens > 0 ? tokens : undefined,
        input_tokens: inputTokens > 0 ? inputTokens : undefined,
        output_tokens: outputTokens > 0 ? outputTokens : undefined,
        cache_creation_tokens: cacheCreation > 0 ? cacheCreation : undefined,
        cache_read_tokens: cacheRead > 0 ? cacheRead : undefined,
        session_tokens: totalSessionTokens(sessionTokens) > 0 ? totalSessionTokens(sessionTokens) : undefined,
        session_input_tokens: sessionTokens.input,
        session_output_tokens: sessionTokens.output,
        session_cache_creation_tokens: sessionTokens.cache_creation,
        session_cache_read_tokens: sessionTokens.cache_read,
        cost_usd:
          family && tokens > 0
            ? Math.round(
                calculateCost(family, inputTokens, outputTokens, cacheCreation, cacheRead) * 1e6,
              ) / 1e6
            : undefined,
        cwd: ctx.directory,
      })
    },

    async sessionEnd(ctx: { sessionID?: string; directory?: string }) {
      const resolved = await resolveContext(ctx.directory)
      if (!resolved) return
      const { config, team, user, model, family } = resolved
      const totalTokens = totalSessionTokens(sessionTokens)
      const sessionCost =
        family && totalTokens > 0
          ? roundCost(
              calculateCost(
                family,
                sessionTokens.input,
                sessionTokens.output,
                sessionTokens.cache_creation,
                sessionTokens.cache_read,
              ),
            )
          : undefined

      await send(config, {
        event: "session_update",
        detail: "session end",
        team_name: team?.team_name,
        user,
        source: "opencode",
        session_id: ctx.sessionID,
        model: model || undefined,
        model_family: family,
        session_tokens: totalTokens > 0 ? totalTokens : undefined,
        session_input_tokens: sessionTokens.input > 0 ? sessionTokens.input : undefined,
        session_output_tokens: sessionTokens.output > 0 ? sessionTokens.output : undefined,
        session_cache_creation_tokens:
          sessionTokens.cache_creation > 0 ? sessionTokens.cache_creation : undefined,
        session_cache_read_tokens: sessionTokens.cache_read > 0 ? sessionTokens.cache_read : undefined,
        cost_usd: sessionCost,
        session_cost_usd: sessionCost,
        cwd: ctx.directory,
      })
    },

    async heartbeat(ctx: { sessionID?: string; directory?: string; detail?: string }) {
      const resolved = await resolveContext(ctx.directory)
      if (!resolved) return
      const { config, team, user, model, family } = resolved
      const totalTokens = totalSessionTokens(sessionTokens)
      const sessionCost =
        family && totalTokens > 0
          ? roundCost(
              calculateCost(
                family,
                sessionTokens.input,
                sessionTokens.output,
                sessionTokens.cache_creation,
                sessionTokens.cache_read,
              ),
            )
          : undefined

      await send(config, {
        event: "heartbeat",
        detail: ctx.detail || "idle",
        team_name: team?.team_name,
        user,
        source: "opencode",
        session_id: ctx.sessionID,
        model: model || undefined,
        model_family: family,
        tokens: totalTokens > 0 ? totalTokens : undefined,
        input_tokens: sessionTokens.input > 0 ? sessionTokens.input : undefined,
        output_tokens: sessionTokens.output > 0 ? sessionTokens.output : undefined,
        cache_creation_tokens:
          sessionTokens.cache_creation > 0 ? sessionTokens.cache_creation : undefined,
        cache_read_tokens: sessionTokens.cache_read > 0 ? sessionTokens.cache_read : undefined,
        cost_usd: sessionCost,
        session_cost_usd: sessionCost,
        cwd: ctx.directory,
      })
    },

    async sessionUsage(ctx: {
      sessionID?: string
      directory?: string
      detail?: string
      model?: string
      input_tokens?: number
      output_tokens?: number
      cache_creation_tokens?: number
      cache_read_tokens?: number
    }) {
      const resolved = await resolveContext(ctx.directory, ctx.model)
      if (!resolved) return
      const { config, team, user, model, family } = resolved
      if (ctx.model) lastModel = ctx.model

      const inputTokens = ctx.input_tokens || 0
      const outputTokens = ctx.output_tokens || 0
      const cacheCreation = ctx.cache_creation_tokens || 0
      const cacheRead = ctx.cache_read_tokens || 0
      const tokens = inputTokens + outputTokens + cacheCreation + cacheRead
      if (tokens <= 0) return

      sessionTokens.input = inputTokens
      sessionTokens.output = outputTokens
      sessionTokens.cache_creation = cacheCreation
      sessionTokens.cache_read = cacheRead

      const sessionCost =
        family && tokens > 0
          ? roundCost(calculateCost(family, inputTokens, outputTokens, cacheCreation, cacheRead))
          : undefined

      await send(config, {
        event: "session_update",
        detail: ctx.detail || "session usage",
        team_name: team?.team_name,
        user,
        source: "opencode",
        session_id: ctx.sessionID,
        model: model || undefined,
        model_family: family,
        session_tokens: tokens,
        session_input_tokens: inputTokens,
        session_output_tokens: outputTokens,
        session_cache_creation_tokens: cacheCreation,
        session_cache_read_tokens: cacheRead,
        cost_usd: sessionCost,
        session_cost_usd: sessionCost,
        cwd: ctx.directory,
      })
    },
  }
}
