import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("./config", () => ({
  readConfig: vi.fn(),
  readTeamConfig: vi.fn(),
  apiRequest: vi.fn(),
  debugLog: vi.fn(),
}))

import { calculateCost, inferModelFamily, PRICING, createTracker } from "./tracking"
import { readConfig, readTeamConfig, apiRequest, debugLog } from "./config"

describe("inferModelFamily", () => {
  it("returns opus for opus model strings", () => {
    expect(inferModelFamily("claude-opus-4-6")).toBe("opus")
    expect(inferModelFamily("claude-3-opus-20240229")).toBe("opus")
  })

  it("returns sonnet for sonnet model strings", () => {
    expect(inferModelFamily("claude-sonnet-4-6")).toBe("sonnet")
    expect(inferModelFamily("claude-3-5-sonnet-20241022")).toBe("sonnet")
  })

  it("returns haiku for haiku model strings", () => {
    expect(inferModelFamily("claude-haiku-4-5-20251001")).toBe("haiku")
    expect(inferModelFamily("claude-3-haiku-20240307")).toBe("haiku")
  })

  it("defaults to opus for unknown model strings", () => {
    expect(inferModelFamily("gpt-4")).toBe("opus")
    expect(inferModelFamily("gemini-pro")).toBe("opus")
    expect(inferModelFamily("")).toBe("opus")
  })
})

describe("calculateCost", () => {
  it("returns 0 for an unknown family", () => {
    expect(calculateCost("unknown", 1000, 1000, 1000, 1000)).toBe(0)
    expect(calculateCost("", 0, 0, 0, 0)).toBe(0)
  })

  it("returns 0 for zero tokens on a known family", () => {
    expect(calculateCost("opus", 0, 0, 0, 0)).toBe(0)
  })

  it("computes opus cost matching the PRICING table", () => {
    const p = PRICING.opus
    const expected = p.input + p.output + p.cache_write + p.cache_read
    expect(calculateCost("opus", 1_000_000, 1_000_000, 1_000_000, 1_000_000)).toBeCloseTo(
      expected,
      6,
    )
  })

  it("computes sonnet cost matching the PRICING table", () => {
    const p = PRICING.sonnet
    const expected = p.input + p.output + p.cache_write + p.cache_read
    expect(calculateCost("sonnet", 1_000_000, 1_000_000, 1_000_000, 1_000_000)).toBeCloseTo(
      expected,
      6,
    )
  })

  it("computes haiku cost matching the PRICING table", () => {
    const p = PRICING.haiku
    const expected = p.input + p.output + p.cache_write + p.cache_read
    expect(calculateCost("haiku", 1_000_000, 1_000_000, 1_000_000, 1_000_000)).toBeCloseTo(
      expected,
      6,
    )
  })

  it("computes GPT-5.5 cost matching the OpenAI pricing table", () => {
    const p = PRICING["gpt-5.5"]
    const expected = p.input + p.output + p.cache_write + p.cache_read
    expect(calculateCost("gpt-5.5", 1_000_000, 1_000_000, 1_000_000, 1_000_000)).toBeCloseTo(
      expected,
      6,
    )
  })

  it("scales linearly per token across each component", () => {
    expect(calculateCost("opus", 500_000, 0, 0, 0)).toBeCloseTo(7.5, 6)
    expect(calculateCost("sonnet", 0, 100_000, 0, 0)).toBeCloseTo(1.5, 6)
    expect(calculateCost("haiku", 0, 0, 200_000, 0)).toBeCloseTo(0.2, 6)
    expect(calculateCost("opus", 0, 0, 0, 2_000_000)).toBeCloseTo(0.75, 6)
  })

  it("sums each component independently", () => {
    const result = calculateCost("sonnet", 100, 200, 300, 400)
    const p = PRICING.sonnet
    const expected =
      (100 / 1e6) * p.input +
      (200 / 1e6) * p.output +
      (300 / 1e6) * p.cache_write +
      (400 / 1e6) * p.cache_read
    expect(result).toBeCloseTo(expected, 12)
  })
})

describe("createTracker token accumulation", () => {
  beforeEach(() => {
    vi.mocked(readConfig).mockReset()
    vi.mocked(readTeamConfig).mockReset()
    vi.mocked(apiRequest).mockReset()

    vi.mocked(readConfig).mockResolvedValue({
      token: "test-token",
      tenant_id: "test-tenant",
      api_url: "https://example.test",
      user_email: "test@example.com",
    })
    vi.mocked(readTeamConfig).mockResolvedValue(null)
    vi.mocked(apiRequest).mockResolvedValue(undefined as never)
  })

  it("sums tokens across multiple toolExecuted calls", async () => {
    const tracker = createTracker()

    await tracker.toolExecuted({
      model: "claude-sonnet-4-6",
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_tokens: 10,
      cache_read_tokens: 5,
    })
    await tracker.toolExecuted({
      input_tokens: 200,
      output_tokens: 80,
      cache_creation_tokens: 20,
      cache_read_tokens: 7,
    })
    await tracker.toolExecuted({
      input_tokens: 1,
      output_tokens: 2,
      cache_creation_tokens: 3,
      cache_read_tokens: 4,
    })

    const calls = vi.mocked(apiRequest).mock.calls
    expect(calls.length).toBe(3)

    const last = calls[2][3] as Record<string, number>
    expect(last.input_tokens).toBe(1)
    expect(last.output_tokens).toBe(2)
    expect(last.session_input_tokens).toBe(301)
    expect(last.session_output_tokens).toBe(132)
    expect(last.session_cache_creation_tokens).toBe(33)
    expect(last.session_cache_read_tokens).toBe(16)
    expect(last.session_tokens).toBe(301 + 132 + 33 + 16)
    expect(last.cost_usd).toBeGreaterThan(0)
    expect(last.source).toBe("opencode")
  })

  it("sends session_cost_usd for session-level events", async () => {
    const tracker = createTracker()

    await tracker.toolExecuted({
      model: "claude-sonnet-4-6",
      input_tokens: 1000,
      output_tokens: 2000,
      cache_creation_tokens: 3000,
      cache_read_tokens: 4000,
    })
    await tracker.sessionEnd({ sessionID: "session-1", directory: "/tmp/fyso-e2e" })
    await tracker.heartbeat({
      sessionID: "session-1",
      directory: "/tmp/fyso-e2e",
      detail: "still active",
    })

    const calls = vi.mocked(apiRequest).mock.calls
    const sessionEnd = calls[1][3] as Record<string, any>
    const heartbeat = calls[2][3] as Record<string, any>

    expect(sessionEnd.event).toBe("session_update")
    expect(sessionEnd.source).toBe("opencode")
    expect(sessionEnd.cost_usd).toBeGreaterThan(0)
    expect(sessionEnd.session_cost_usd).toBe(sessionEnd.cost_usd)
    expect(heartbeat.event).toBe("heartbeat")
    expect(heartbeat.source).toBe("opencode")
    expect(heartbeat.session_cost_usd).toBe(heartbeat.cost_usd)
  })

  it("marks session_start as opencode source", async () => {
    const tracker = createTracker()

    await tracker.sessionStart({ sessionID: "session-1", directory: "/tmp/fyso-e2e" })

    const payload = vi.mocked(apiRequest).mock.calls[0][3] as Record<string, string>
    expect(payload.event).toBe("session_start")
    expect(payload.source).toBe("opencode")
    expect(payload.model).toBeUndefined()
    expect(payload.model_family).toBeUndefined()
  })

  it("does not invent opus model or zero token fields when OpenCode omits usage metadata", async () => {
    const tracker = createTracker()

    await tracker.toolExecuted({
      sessionID: "session-1",
      directory: "/tmp/fyso-e2e",
      tool: "fyso-sync-team",
    })

    const payload = vi.mocked(apiRequest).mock.calls[0][3] as Record<string, unknown>
    expect(payload.event).toBe("agent_dispatch")
    expect(payload.source).toBe("opencode")
    expect(payload.model).toBeUndefined()
    expect(payload.model_family).toBeUndefined()
    expect(payload.tokens).toBeUndefined()
    expect(payload.input_tokens).toBeUndefined()
    expect(payload.output_tokens).toBeUndefined()
  })

  it("tracks session usage with real model and tokens from OpenCode step metadata", async () => {
    const tracker = createTracker()

    await tracker.sessionUsage({
      sessionID: "session-1",
      directory: "/tmp/fyso-e2e",
      model: "openai/gpt-5.5",
      input_tokens: 100,
      output_tokens: 20,
      cache_read_tokens: 300,
    })

    const payload = vi.mocked(apiRequest).mock.calls[0][3] as Record<string, unknown>
    expect(payload.event).toBe("session_update")
    expect(payload.source).toBe("opencode")
    expect(payload.model).toBe("openai/gpt-5.5")
    expect(payload.model_family).toBe("gpt-5.5")
    expect(payload.session_tokens).toBe(420)
    expect(payload.session_input_tokens).toBe(100)
    expect(payload.session_output_tokens).toBe(20)
    expect(payload.session_cache_read_tokens).toBe(300)
    expect(payload.cost_usd).toBeGreaterThan(0)
    expect(payload.session_cost_usd).toBe(payload.cost_usd)
  })

  it("treats missing token fields as zero", async () => {
    const tracker = createTracker()

    await tracker.toolExecuted({})
    await tracker.toolExecuted({ input_tokens: 50 })

    const calls = vi.mocked(apiRequest).mock.calls
    const last = calls[1][3] as Record<string, number>
    expect(last.session_input_tokens).toBe(50)
    expect(last.session_output_tokens).toBe(0)
    expect(last.session_cache_creation_tokens).toBe(0)
    expect(last.session_cache_read_tokens).toBe(0)
    expect(last.session_tokens).toBe(50)
  })

  it("keeps independent state across tracker instances", async () => {
    const a = createTracker()
    const b = createTracker()

    await a.toolExecuted({ input_tokens: 100 })
    await b.toolExecuted({ input_tokens: 7 })

    const calls = vi.mocked(apiRequest).mock.calls
    const aPayload = calls[0][3] as Record<string, number>
    const bPayload = calls[1][3] as Record<string, number>
    expect(aPayload.session_input_tokens).toBe(100)
    expect(bPayload.session_input_tokens).toBe(7)
  })

  it("logs the error via debugLog when apiRequest rejects on HTTP 500", async () => {
    vi.mocked(apiRequest).mockRejectedValueOnce(
      new Error("apiRequest POST /api/entities/tracking/records failed with HTTP 500: boom"),
    )

    const tracker = createTracker()
    await expect(tracker.toolExecuted({ input_tokens: 10 })).resolves.toBeUndefined()

    const debugCalls = vi.mocked(debugLog).mock.calls.map((c) => c[0])
    const errorLog = debugCalls.find((m) => m.startsWith("TRACKING_ERROR:"))
    expect(errorLog).toBeDefined()
    expect(errorLog).toContain("HTTP 500")
  })
})
