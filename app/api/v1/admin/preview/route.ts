/**
 * POST /api/v1/admin/preview — define ou limpa o preview context da sessão de suporte ativa.
 * GET /api/v1/admin/preview — retorna o preview context atual.
 *
 * Requer: sessão de suporte ativa (fn_support_context) + platform_admin.
 * O preview altera apenas a resolução visual e de acesso do admin.
 * Workers, automações e processamento de mensagens nunca leem este contexto.
 */
import { z } from "zod";
import { type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { readSupportContext } from "@/lib/impersonate/support";
import { authenticatedSessionId } from "@/lib/impersonate/support";
import { previewContextSchema } from "@/lib/impersonate/preview";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { createClient } from "@/lib/supabase/server";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";

export async function GET(_request: NextRequest) {
  const requestId = crypto.randomUUID();
  try { await requirePlatformAdmin(); }
  catch { return fail("forbidden", "Administração da plataforma necessária.", 403, { requestId }); }
  const db = await createClient();
  const support = await readSupportContext(db);
  if (!support || support.status !== "active") {
    return fail("state_conflict", "Sem sessão de acompanhamento ativa.", 409, { requestId });
  }
  const preview = support.preview_context ? previewContextSchema.safeParse(support.preview_context) : null;
  return ok({ preview: preview?.success ? preview.data : null, organization_id: support.organization_id, tenant_name: support.name }, { requestId });
}

const inputSchema = z.object({
  preview: previewContextSchema.nullable(),
}).strict();

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  let actor;
  try { actor = await requirePlatformAdmin(); }
  catch { return fail("forbidden", "Administração da plataforma necessária.", 403, { requestId }); }
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("validation_failed", "Configuração de preview inválida.", 422, { requestId });
  const db = await createClient();
  const support = await readSupportContext(db);
  if (!support || support.status !== "active") {
    return fail("state_conflict", "Sem sessão de acompanhamento ativa.", 409, { requestId });
  }
  try {
    const sessionId = await authenticatedSessionId();
    await getRequestPool().query(
      "select public.fn_set_preview_context($1::uuid, $2::uuid, $3::jsonb)",
      [actor.user.id, sessionId, parsed.data.preview ? JSON.stringify(parsed.data.preview) : null],
    );
    await audit({
      action: "platform_admin.preview_context_changed",
      actorUserId: actor.user.id,
      organizationId: support.organization_id,
      actingAsPlatformAdmin: true,
      bypassedRls: true,
      resourceType: "organization",
      resourceId: support.organization_id,
      requestId,
      metadata: { preview: parsed.data.preview },
    });
    return ok({ preview: parsed.data.preview }, { requestId });
  } catch (error) {
    const msg = (error as { message?: string }).message ?? "";
    if (msg.includes("preview_session_not_found")) {
      return fail("state_conflict", "Sessão de acompanhamento não encontrada ou expirada.", 409, { requestId });
    }
    return fail("upstream_unavailable", "Não foi possível atualizar o preview. Tente novamente.", 503, { requestId });
  }
}
