import { redirect } from "next/navigation";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";
import { TemplateSelectorClient } from "./_client";

export const dynamic = "force-dynamic";

export default async function SettingsTemplatePage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  if (!(user.is_platform_admin && !user.support) && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", activeOrg.orgId)
    .single();

  const settings = (org?.settings as Record<string, unknown>) || {};
  const currentTemplateId = (settings.business_template as string) || "vendas";

  return (
    <div className="flex h-full flex-col gap-6 p-6 max-w-5xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Segmento & Nomenclaturas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Escolha o template ideal para o seu negócio para adaptar automaticamente termos como Pacientes, Cortes, Consultas ou Produtos em todo o sistema.
        </p>
      </header>
      <TemplateSelectorClient currentTemplateId={currentTemplateId} />
    </div>
  );
}
