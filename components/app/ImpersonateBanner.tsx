"use client";
import { useT } from "@/hooks/i18n/useT";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useOrganizationTransition } from "@/components/shell/OrganizationTransitionProvider";
import type { PreviewContext } from "@/lib/impersonate/preview";

export interface ImpersonatingInfo {
  tenantId: string;
  tenantName: string;
  expiresAt: string;
  accessMode?: "full" | "support_readonly";
  previewContext?: PreviewContext | null;
}
export function notifySupportTransition() {
  localStorage.setItem("support-context-transition", String(Date.now()));
}

const PROFILE_LABELS: Record<string, string> = {
  essential: "Essential",
  assistant_agenda: "Assistente + Agenda",
  sales: "Sales (completo)",
};
const ROLE_LABELS: Record<string, string> = {
  viewer: "Visualizador", agent: "Agente", manager: "Gerente", admin: "Admin",
};

export function ImpersonateBanner({ impersonating, ended = false }: {
  impersonating: ImpersonatingInfo | null; ended?: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const transition = useOrganizationTransition();
  useEffect(() => {
    if (!impersonating || ended) return;
    const timer = setTimeout(() => {
      transition.begin("Acompanhamento encerrado. Confirmando acesso…");
      window.location.assign("/support-ended");
    }, Math.max(0, new Date(impersonating.expiresAt).getTime()-Date.now()));
    return () => clearTimeout(timer);
  }, [impersonating, ended, transition]);
  if (!impersonating) return null;
  async function handleEnd() {
    flushSync(() => { setBusy(true); transition.begin("Encerrando acompanhamento…"); });
    try {
      const res = await fetch("/api/v1/admin/impersonate/end", { method: "POST" });
      if (!res.ok) throw new Error("Não foi possível encerrar o acompanhamento. Tente novamente.");
      notifySupportTransition();
      window.location.assign("/app/inbox");
    } catch (error) {
      transition.cancel(); setBusy(false);
      toast.error(error instanceof Error ? error.message : "Falha de conexão.");
    }
  }
  const pc = impersonating.previewContext;
  const previewParts: string[] = [];
  if (pc?.profile) previewParts.push(PROFILE_LABELS[pc.profile] ?? pc.profile);
  if (pc?.role) previewParts.push(ROLE_LABELS[pc.role] ?? pc.role);
  if (pc?.interface_mode) previewParts.push(pc.interface_mode === "simple" ? "Interface simples" : "Interface avançada");
  const isPreview = previewParts.length > 0;

  return (
    <div role="alert" aria-live="polite" className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-sm text-amber-950">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {ended ? t("Acompanhamento encerrado") : t("Suporte à organização")}{" "}
        <strong>{impersonating.tenantName}</strong>
        {!ended && (
          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-xs font-medium">
            {impersonating.accessMode === "support_readonly" ? t("Somente leitura") : t("Edição permitida")}
          </span>
        )}
        {isPreview && !ended && (
          <span className="rounded bg-blue-100 border border-blue-300 px-1.5 py-0.5 text-xs font-medium text-blue-800">
            {t("Simulando:")} {previewParts.join(" · ")}
          </span>
        )}
      </span>
      <div className="flex items-center gap-2">
        {!ended && (
          <Button size="sm" variant="outline" asChild>
            <a href="/admin/preview">Trocar simulação</a>
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={handleEnd} disabled={busy}>{t("Sair do acompanhamento")}</Button>
      </div>
    </div>
  );
}
