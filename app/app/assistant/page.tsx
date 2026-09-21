import Link from "next/link";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { assistantConfigSchema, type AssistantConfig } from "@/lib/assistant/config-schema";
/**
 * /app/assistant — "Meu Assistente"
 *
 * Tela guiada para configuração da IA em linguagem simples.
 * Reutiliza a infraestrutura de agentes (ai_agents, ai_agent_versions)
 * sem expor prompts técnicos ao cliente.
 *
 * Fluxo: o agente padrão da organização é carregado.
 * Se não existir, o cliente pode criar usando um modelo.
 */
import { redirect } from "next/navigation";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { AssistantWizard } from "./_wizard";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app/onboarding");

  const db = await createClient();
  // Carrega o agente padrão da organização
  const { data: agent } = await db
    .from("ai_agents")
    .select("id, name, description, is_active, paused_at, config, system_prompt, operation_mode")
    .eq("organization_id", activeOrg.orgId)
    .eq("is_default", true)
    .is("archived_at", null)
    .maybeSingle();

  // Carrega a versão publicada para mostrar o histórico
  const agentId = agent?.id ?? null;
  const { data: publishedVersion } = agentId
    ? await db
        .from("ai_agent_versions")
        .select("id, version_number, status, created_at, published_at")
        .eq("organization_id", activeOrg.orgId)
        .eq("agent_id", agentId)
        .eq("status", "published")
        .order("version_number", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  let draft: { id: string; config: AssistantConfig } | null = null;
  let history: { id: string; version_number: number; config: AssistantConfig }[] = [];
  let historyUnavailable = false;
  if (agentId) {
    try {
      const { rows } = await getRequestPool().query<{ id: string; status: string; version_number: number; assistant_config: unknown }>(
        "select id,status,version_number,assistant_config from ai_agent_versions where organization_id=$1 and agent_id=$2 and assistant_config is not null order by version_number desc limit 20", [activeOrg.orgId, agentId]);
      history = rows.flatMap(row => {
        const parsed = assistantConfigSchema.safeParse(row.assistant_config);
        return parsed.success ? [{ id: row.id, version_number: row.version_number, config: parsed.data }] : [];
      });
      const latest = rows[0];
      const parsed = assistantConfigSchema.safeParse(latest?.assistant_config);
      if (latest?.status === "draft" && parsed.success) draft = { id: latest.id, config: parsed.data };
    } catch { historyUnavailable = true; }
  }

  const canAccessAdvanced = Boolean(
    user.is_platform_admin || ["admin", "owner", "manager"].includes(activeOrg.role)
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Meu Assistente</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure como o seu assistente vai se comunicar e quais assuntos ele pode responder.
        </p>
      </div>
      {!agentId && <p className="text-sm">Antes de configurar o atendimento, <Link className="underline" href="/app/ai/agents">configure o modelo e o canal do agente</Link>.</p>}
      {historyUnavailable && <p role="status">Não foi possível carregar os rascunhos e o histórico. Recarregue antes de editar.</p>}
      <AssistantWizard
        agentId={agentId}
        initialVersionId={draft?.id ?? null}
        history={history}
        isActive={agent ? (agent.paused_at === null && agent.is_active) : false}
        savedConfig={draft?.config ?? (agent?.config as Record<string, unknown> | null)?.assistant_config ?? null}
        publishedVersionNumber={publishedVersion?.version_number ?? null}
        publishedAt={publishedVersion?.published_at ?? null}
        canAccessAdvanced={canAccessAdvanced}
      />
    </main>
  );
}
