import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function dateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function SimpleHomePage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app/onboarding");

  const db = await createClient();
  const now = new Date().toISOString();
  const [agent, attention, appointments, channel, calendar] = await Promise.all([
    db
      .from("ai_agents")
      .select("id, name, is_active, paused_at, published_version_id")
      .eq("organization_id", activeOrg.orgId)
      .is("archived_at", null)
      .not("published_version_id", "is", null)
      .limit(1)
      .maybeSingle(),
    db
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", activeOrg.orgId)
      .in("status", ["open", "pending", "claimed"]),
    db
      .from("calendar_appointments")
      .select("id, title, starts_at, status")
      .eq("organization_id", activeOrg.orgId)
      .gte("starts_at", now)
      .in("status", ["pending", "confirmed"])
      .order("starts_at", { ascending: true })
      .limit(3),
    db
      .from("channel_sessions")
      .select("id")
      .eq("organization_id", activeOrg.orgId)
      .eq("status", "WORKING")
      .limit(1)
      .maybeSingle(),
    db
      .from("calendar_connections")
      .select("id")
      .eq("organization_id", activeOrg.orgId)
      .eq("status", "healthy")
      .limit(1)
      .maybeSingle(),
  ]);

  const assistantReady =
    !!agent.data?.published_version_id && agent.data.is_active && !agent.data.paused_at;
  const pending = [
    !agent.data?.published_version_id && { label: "Publicar o assistente", href: "/app/assistant" },
    !channel.data && { label: "Conectar o WhatsApp", href: "/app/connections" },
    !calendar.data && { label: "Conectar o Google Agenda", href: "/app/agenda" },
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Início</h1>
        <p className="mt-1 text-sm text-muted-foreground">O que precisa da sua atenção agora.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border p-5">
          <p className="text-sm text-muted-foreground">Assistente</p>
          <p className="mt-2 text-xl font-semibold">
            {assistantReady ? "Ativo" : "Precisa de ajuste"}
          </p>
          <p className="mt-1 text-sm">{agent.data?.name ?? "Nenhum assistente publicado"}</p>
          <Link className="mt-4 inline-block text-sm font-medium underline" href="/app/assistant">
            {assistantReady ? "Testar assistente" : "Configurar assistente"}
          </Link>
        </section>

        <section className="rounded-xl border p-5">
          <p className="text-sm text-muted-foreground">Conversas para atender</p>
          <p className="mt-2 text-3xl font-semibold">{attention.count ?? 0}</p>
          <Link className="mt-4 inline-block text-sm font-medium underline" href="/app/inbox">
            Abrir Inbox
          </Link>
        </section>

        <section className="rounded-xl border p-5">
          <p className="text-sm text-muted-foreground">Configuração pendente</p>
          <p className="mt-2 text-3xl font-semibold">{pending.length}</p>
          {pending[0] ? (
            <Link
              className="mt-4 inline-block text-sm font-medium underline"
              href={pending[0].href}
            >
              {pending[0].label}
            </Link>
          ) : (
            <p className="mt-4 text-sm">Tudo pronto.</p>
          )}
        </section>
      </div>

      <section className="rounded-xl border p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">Próximos compromissos</h2>
          <Link className="text-sm underline" href="/app/agenda">
            Ver agenda
          </Link>
        </div>
        <div className="mt-4 divide-y">
          {(appointments.data ?? []).map((item) => (
            <div className="flex items-center justify-between gap-4 py-3" key={item.id}>
              <span>{item.title}</span>
              <time className="text-sm text-muted-foreground" dateTime={item.starts_at}>
                {dateTime(item.starts_at)}
              </time>
            </div>
          ))}
          {!appointments.data?.length && (
            <p className="py-3 text-sm text-muted-foreground">Nada marcado.</p>
          )}
        </div>
      </section>
    </main>
  );
}
