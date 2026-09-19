import Link from "next/link";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { readProductPolicy } from "@/lib/product/policy";
import { contextFromSettings } from "@/lib/product/request";
import { resolveCapabilities } from "@/lib/product/capabilities";
import { env } from "@/lib/env";

const MODULE_LABELS = { inbox: "Conversas", ai_assistant: "Assistente", calendar: "Agenda", knowledge: "Conhecimento",
  sales: "Vendas", reports: "Relatórios", automations: "Automações", integrations: "Integrações" };
const date = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "UTC" }) + " UTC";

export async function TenantDiagnostics({ id }: { id: string }) {
  await requirePlatformAdmin();
  if (!z.string().uuid().safeParse(id).success) return null;
  const db = createAdminClient();
  const [org, timeline, hooks, usage] = await Promise.allSettled([
    db.from("organizations").select("settings").eq("id", id).maybeSingle(),
    db.from("api_audit_log").select("id,action,created_at,request_id").eq("organization_id", id)
      .order("created_at", { ascending: false }).limit(20),
    db.from("webhook_events_log").select("id,status,received_at,processed_at").eq("organization_id", id)
      .is("archived_at", null).order("received_at", { ascending: false }).limit(20),
    Promise.resolve().then(() => getRequestPool().query<{ calls: string; failures: string; cost: string; unpriced: string; tokens: string; latency: number | null }>(
      `select count(*)::text calls,count(*) filter(where error_code is not null)::text failures,
       public.fn_gasto_de_ia_do_mes($1)::text cost,count(*) filter(where cost_cents is null)::text unpriced,
       coalesce(sum(input_tokens+output_tokens),0)::text tokens,
       percentile_cont(0.95) within group(order by latency_ms) latency
       from llm_calls where organization_id=$1 and created_at>=date_trunc('month',now())`, [id])),
  ]);
  let decisions: ReturnType<typeof resolveCapabilities> | null = null;
  let profile: string | null = null;
  if (org.status === "fulfilled" && !org.value.error && org.value.data) {
    try {
      const policy = readProductPolicy(org.value.data.settings);
      profile = policy.product.profile;
      decisions = resolveCapabilities(contextFromSettings(id, org.value.data.settings, "admin", false));
    } catch { /* Política inválida aparece como indisponível. */ }
  }
  const events = timeline.status === "fulfilled" && !timeline.value.error ? timeline.value.data : null;
  const deliveries = hooks.status === "fulfilled" && !hooks.value.error ? hooks.value.data : null;
  const total = usage.status === "fulfilled" ? usage.value.rows[0] : null;
  return <section className="space-y-6" aria-label="Diagnóstico da organização">
    <div className="rounded-lg border p-4 space-y-3">
      <h2 className="font-semibold">Perfil e recursos disponíveis</h2>
      <p className="text-sm">Perfil configurado: {profile ?? "Indisponível"}. Liberação na instalação: {env.PRODUCT_PROFILES_ENABLED ? "ligada" : "desligada; experiência anterior preservada"}.</p>
      {decisions ? <ul className="grid gap-2 sm:grid-cols-2">{Object.entries(decisions).map(([key, value]) =>
        <li key={key} className="text-sm"><strong>{MODULE_LABELS[key as keyof typeof MODULE_LABELS]}</strong>: {value.allowed ? "Disponível" : "Indisponível"} — {value.reason}</li>)}</ul>
        : <p role="status">Não foi possível resolver a política de recursos.</p>}
      <Link className="text-sm underline" href={`/admin/tenants/${id}/product`}>Revisar perfil e módulos</Link>
    </div>
    <div className="rounded-lg border p-4 space-y-2">
      <h2 className="font-semibold">Uso de IA neste mês</h2>
      {total ? <><p className="text-sm">{total.calls} chamadas · {total.failures} falhas registradas · {Number(total.tokens).toLocaleString("pt-BR")} tokens</p>
        <p className="text-sm">Custo registrado: {(Number(total.cost)/100).toLocaleString("pt-BR", { style: "currency", currency: "USD" })} · {total.unpriced} chamadas sem preço registrado</p>
        <p className="text-sm">Latência de 95% das chamadas: {total.latency === null ? "sem medição" : `${Math.round(total.latency)} ms`}</p></>
        : <p role="status">Consumo indisponível. Recarregue para consultar novamente.</p>}
      <Link className="text-sm underline" href={`/admin/tenants/${id}/health`}>Ver conexões e orçamento</Link>
    </div>
    <div className="rounded-lg border p-4 space-y-2">
      <h2 className="font-semibold">Últimos recebimentos de integrações</h2>
      {deliveries === null ? <p role="status">Não foi possível consultar os recebimentos.</p>
        : !deliveries.length ? <p className="text-sm">Nenhum recebimento registrado.</p>
        : <ul className="space-y-2 text-sm">{deliveries.map(item => <li key={item.id}>{date(item.received_at)} — {item.status}{item.processed_at ? " · Processado" : " · Sem confirmação de processamento"}</li>)}</ul>}
    </div>
    <div className="rounded-lg border p-4 space-y-2">
      <h2 className="font-semibold">Últimas operações</h2>
      {events === null ? <p role="status">Não foi possível consultar a auditoria.</p>
        : !events.length ? <p className="text-sm">Nenhuma operação registrada. Ausência de atividade não indica falha.</p>
        : <ol className="space-y-3 text-sm">{events.map(event => <li key={event.id}><p>{date(event.created_at)} — {event.action}</p>{event.request_id && <p className="break-all text-xs text-muted-foreground">Referência: {event.request_id}</p>}</li>)}</ol>}
    </div>
  </section>;
}
