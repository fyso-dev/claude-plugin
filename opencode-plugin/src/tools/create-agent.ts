import { apiRequest, type FysoConfig } from "../config"

const VALID_STATUSES = new Set(["active", "idle", "sleeping", "offline"])

export interface CreateAgentInput {
  name: string
  display_name?: string
  role?: string
  soul?: string
  system_prompt?: string
  status?: string
}

export interface CreatedAgent {
  id: string
  name: string
  display_name: string
  role: string
  soul?: string
  system_prompt?: string
  status: string
}

export function agentSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64)
  return slug || "agent"
}

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function buildAgentBody(input: CreateAgentInput): Record<string, unknown> {
  const displayName = cleanOptional(input.display_name) || input.name.trim()
  const status = VALID_STATUSES.has(input.status || "") ? input.status! : "active"
  const body: Record<string, unknown> = {
    name: agentSlug(input.name),
    display_name: displayName,
    role: cleanOptional(input.role) || "assistant",
    status,
  }

  const soul = cleanOptional(input.soul)
  const systemPrompt = cleanOptional(input.system_prompt)
  if (soul) body.soul = soul
  if (systemPrompt) body.system_prompt = systemPrompt
  return body
}

export async function createAgent(
  config: FysoConfig,
  input: CreateAgentInput,
): Promise<CreatedAgent> {
  if (!input.name.trim()) {
    throw new Error("createAgent: name is required")
  }

  const body = buildAgentBody(input)
  const resp = (await apiRequest(config, "POST", "/api/entities/agents/records", body)) as {
    data?: Partial<CreatedAgent> & { id?: string }
    id?: string
  }
  const record = resp?.data ?? resp
  const id = (record as { id?: string })?.id
  if (!id) {
    throw new Error("createAgent: API response missing agent id")
  }

  return {
    id,
    name: String((record as CreatedAgent).name ?? body.name),
    display_name: String((record as CreatedAgent).display_name ?? body.display_name),
    role: String((record as CreatedAgent).role ?? body.role),
    soul: (record as CreatedAgent).soul ?? (body.soul as string | undefined),
    system_prompt:
      (record as CreatedAgent).system_prompt ?? (body.system_prompt as string | undefined),
    status: String((record as CreatedAgent).status ?? body.status),
  }
}

export function createAgentGuide(): string {
  return [
    "Wizard para crear agente Fyso:",
    "",
    "1. Defini el trabajo principal del agente en una frase.",
    "2. Elegi un nombre visible y un identificador simple.",
    "3. Especifica rol, responsabilidades, limites, entradas esperadas y entregables.",
    "4. Redacta un system_prompt operativo, con criterios de calidad y cuando pedir ayuda.",
    "5. Llama esta tool otra vez con name, display_name, role, soul y system_prompt.",
    "",
    "Template recomendado:",
    "- Nombre visible: Revisora QA",
    "- name: revisora_qa",
    "- role: qa",
    "- soul: Especialista en encontrar regresiones, riesgos y casos borde antes de release.",
    "- system_prompt: Sos Revisora QA. Validás cambios con foco en comportamiento observable, regresiones y pruebas faltantes. Respondé con hallazgos accionables, severidad y evidencia concreta.",
  ].join("\n")
}
