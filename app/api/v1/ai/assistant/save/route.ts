import { z } from "zod";
import { type NextRequest } from "next/server";
import { requireRole } from "@/lib/auth/require-role";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { assistantConfigSchema } from "@/lib/assistant/config-schema";
import { saveAssistantDraft } from "@/lib/assistant/save-draft";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";

const inputSchema = z.object({ agent_id: z.string().uuid().nullable(), assistant_config: assistantConfigSchema }).strict();
export async function POST(req: NextRequest): Promise<Response> {
  const requestId = crypto.randomUUID();
  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Configuração inválida.", 422, { requestId });
  const denied = await requireSupportWrite();
  if (denied) return denied;
  const authz = await requireRole("admin", { requestId, resource: "ai_agents" });
  if (!authz.ok) return authz.response;
  try {
    const result = await saveAssistantDraft(getRequestPool(), authz.org.orgId, authz.user.id, parsed.data.agent_id, parsed.data.assistant_config);
    void audit({ action: "ai_agent.version_created", actorUserId: authz.user.id, organizationId: authz.org.orgId,
      resourceType: "ai_agent_version", resourceId: result.version_id, requestId,
      metadata: { agent_id: result.agent_id, version_number: result.version_number, source: "assistant_wizard" } });
    return ok(result, { status: 201, requestId });
  } catch (error) {
    if (error instanceof Error && error.message === "assistant_calendar_setup_required")
      return fail("invalid_state", "Ative as capacidades de agenda no agente antes de permitir agendamentos.", 409, { requestId });
    if (error instanceof Error && error.message === "assistant_setup_required")
      return fail("invalid_state", "Configure primeiro o modelo e o canal do assistente em Agente de IA › Agentes.", 409, { requestId });
    return fail("upstream_unavailable", "Não foi possível salvar o rascunho. Tente novamente.", 503, { requestId });
  }
}
