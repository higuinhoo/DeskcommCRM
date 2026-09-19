import { z } from "zod";
import { type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { mfaEmDivida } from "@/lib/auth/server";
import { authenticatedSessionId, requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { productPolicySchema, readProductPolicy } from "@/lib/product/policy";
import { resolveCapabilities } from "@/lib/product/capabilities";
import { contextFromSettings } from "@/lib/product/request";
import { audit } from "@/lib/audit";
import { ok, fail } from "@/lib/api/wrappers";
import { env } from "@/lib/env";
type Context = { params: Promise<{ id: string }> };
const inputSchema = z
  .object({ expected_revision: z.number().int().nonnegative(), policy: productPolicySchema })
  .strict();
export async function GET(_request: NextRequest, { params }: Context) {
  const requestId = crypto.randomUUID();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", "Organização inválida.", 422, { requestId });
  try {
    await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Administração da plataforma necessária.", 403, { requestId });
  }
  const { data, error } = await createAdminClient()
    .from("organizations")
    .select("settings")
    .eq("id", id)
    .maybeSingle();
  if (error)
    return fail("upstream_unavailable", "Não foi possível consultar a organização.", 503, {
      requestId,
    });
  if (!data) return fail("not_found", "Organização não encontrada.", 404, { requestId });
  try {
    const policy = readProductPolicy(data.settings);
    return ok(
      {
        policy,
        global_enabled: env.PRODUCT_PROFILES_ENABLED,
        decisions: resolveCapabilities(contextFromSettings(id, data.settings, "admin", false)),
      },
      { requestId },
    );
  } catch {
    return fail("invalid_state", "A política de produto precisa de revisão administrativa.", 409, {
      requestId,
    });
  }
}
export async function PATCH(request: NextRequest, { params }: Context) {
  const requestId = crypto.randomUUID();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success)
    return fail("validation_failed", "Organização inválida.", 422, { requestId });
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return fail("validation_failed", "Revise a configuração de produto.", 422, { requestId });
  const denied = await requireSupportWrite();
  if (denied) return denied;
  let actor;
  try {
    actor = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Administração da plataforma necessária.", 403, { requestId });
  }
  if (actor.platformAdmin.scope !== "full")
    return fail("forbidden", "Esta conta possui acesso administrativo somente leitura.", 403, {
      requestId,
    });
  if (await mfaEmDivida())
    return fail("mfa_required", "Confirme a verificação em duas etapas.", 403, { requestId });
  try {
    const session = await authenticatedSessionId();
    const { rows } = await getRequestPool().query<{ policy: unknown }>(
      "select public.fn_set_product_policy($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::jsonb) as policy",
      [
        actor.user.id,
        session,
        id,
        parsed.data.expected_revision,
        JSON.stringify(parsed.data.policy),
      ],
    );
    const policy = productPolicySchema.parse(rows[0]?.policy);
    await audit({
      action: "product.policy_updated",
      actorUserId: actor.user.id,
      organizationId: id,
      actingAsPlatformAdmin: true,
      bypassedRls: true,
      resourceType: "organization",
      resourceId: id,
      requestId,
      metadata: {
        revision: policy.revision,
        profile: policy.product.profile,
        enabled: policy.product.enabled,
      },
    });
    return ok({ policy }, { requestId });
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "40001")
      return fail("state_conflict", "A configuração mudou. Recarregue antes de salvar.", 409, {
        requestId,
      });
    if (code === "42501")
      return fail(
        "forbidden",
        "Encerre o acompanhamento e confirme sua sessão administrativa antes de alterar o produto.",
        403,
        { requestId },
      );
    return fail(
      "upstream_unavailable",
      "Não foi possível salvar. Recarregue para conferir o estado antes de tentar novamente.",
      503,
      { requestId },
    );
  }
}
