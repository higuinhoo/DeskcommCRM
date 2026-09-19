import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { readSupportContext } from "@/lib/impersonate/support";
import { createClient } from "@/lib/supabase/server";
import { PreviewSelector } from "./preview-selector";

export default async function PreviewPage() {
  await requirePlatformAdmin();
  const db = await createClient();
  const support = await readSupportContext(db).catch(() => null);
  return (
    <section className="max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Central de Simulação</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualize a interface exatamente como o cliente a vê. Nenhuma alteração é salva na organização real.
          Workers, automações e processamento de mensagens continuam usando somente as configurações persistidas.
        </p>
      </div>
      {!support || support.status !== "active" ? (
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">Nenhuma sessão de acompanhamento ativa.</p>
          <p className="text-muted-foreground mt-1">
            Inicie uma sessão de acompanhamento em uma organização antes de usar a simulação.
          </p>
          <a href="/admin/tenants" className="mt-3 inline-block text-primary underline underline-offset-2 text-sm">
            Ir para organizações →
          </a>
        </div>
      ) : (
        <PreviewSelector
          organizationId={support.organization_id}
          tenantName={support.name}
          initialPreview={support.preview_context ?? null}
        />
      )}
    </section>
  );
}
