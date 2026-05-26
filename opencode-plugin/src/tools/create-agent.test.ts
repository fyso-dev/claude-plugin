import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ApiRequestError, type FysoConfig } from "../config"
import { agentSlug, buildAgentBody, createAgent, createAgentGuide } from "./create-agent"

const config: FysoConfig = {
  token: "t",
  tenant_id: "tenant",
  api_url: "https://api.test",
}

function mockJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("agentSlug", () => {
  it("normalizes human names into safe Fyso identifiers", () => {
    expect(agentSlug("Revisora QA Senior")).toBe("revisora_qa_senior")
    expect(agentSlug("  Diseñador UX / UI  ")).toBe("disenador_ux_ui")
    expect(agentSlug("")).toBe("agent")
  })
})

describe("buildAgentBody", () => {
  it("builds a complete agent payload with safe defaults", () => {
    expect(
      buildAgentBody({
        name: "Revisora QA",
        role: "qa",
        soul: "Encuentra riesgos",
        system_prompt: "Revisa cambios",
      }),
    ).toEqual({
      name: "revisora_qa",
      display_name: "Revisora QA",
      role: "qa",
      soul: "Encuentra riesgos",
      system_prompt: "Revisa cambios",
      status: "active",
    })
  })

  it("drops empty optional fields and rejects unknown statuses", () => {
    expect(
      buildAgentBody({
        name: "Builder",
        display_name: "  ",
        role: "",
        soul: " ",
        system_prompt: "",
        status: "paused",
      }),
    ).toEqual({
      name: "builder",
      display_name: "Builder",
      role: "assistant",
      status: "active",
    })
  })
})

describe("createAgent", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch")
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("POSTs the generated payload and returns the created agent", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      mockJson({ data: { id: "agent_1", name: "qa", display_name: "QA", role: "qa" } }),
    )

    const agent = await createAgent(config, {
      name: "QA",
      role: "qa",
      system_prompt: "Validar releases",
    })

    expect(agent).toMatchObject({ id: "agent_1", name: "qa", display_name: "QA", role: "qa" })
    const call = vi.mocked(globalThis.fetch).mock.calls[0]!
    const init = call[1] as RequestInit
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body as string)).toEqual({
      name: "qa",
      display_name: "QA",
      role: "qa",
      status: "active",
      system_prompt: "Validar releases",
    })
  })

  it("requires a name before calling the API", async () => {
    await expect(createAgent(config, { name: " " })).rejects.toThrow(/name is required/)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it("throws when the API response is missing the agent id", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(mockJson({ data: {} }))
    await expect(createAgent(config, { name: "x" })).rejects.toThrow(/missing agent id/)
  })

  it("surfaces ApiRequestError from the underlying request", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(new Response("bad", { status: 422 }))
    await expect(createAgent(config, { name: "x" })).rejects.toBeInstanceOf(ApiRequestError)
  })
})

describe("createAgentGuide", () => {
  it("returns wizard instructions for tool discovery", () => {
    expect(createAgentGuide()).toContain("Wizard para crear agente Fyso")
    expect(createAgentGuide()).toContain("system_prompt")
  })
})
