"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PROFILES, type ProductProfile } from "@/lib/product/capabilities";
import type { PreviewContext } from "@/lib/impersonate/preview";

const PROFILE_LABELS: Record<ProductProfile, string> = {
  essential: "Essential — Só conversas e configurações básicas",
  assistant_agenda: "Assistente + Agenda — IA e agendamentos",
  sales: "Sales — Todos os recursos (CRM, funis, relatórios)",
};

type Role = "viewer" | "agent" | "manager" | "admin";
const ROLE_LABELS: Record<Role, string> = {
  viewer: "Visualizador (somente leitura)",
  agent: "Agente (atendimento)",
  manager: "Gerente",
  admin: "Administrador",
};

export function PreviewSelector({
  organizationId,
  tenantName,
  initialPreview,
}: {
  organizationId: string;
  tenantName: string;
  initialPreview: PreviewContext | null;
}) {
  const [profile, setProfile] = useState<ProductProfile | "">(initialPreview?.profile ?? "");
  const [role, setRole] = useState<Role | "">(initialPreview?.role ?? "");
  const [interfaceMode, setInterfaceMode] = useState<"simple" | "advanced" | "">(
    initialPreview?.interface_mode ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function apply(preview: PreviewContext | null) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/v1/admin/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ preview }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message ?? "Não foi possível aplicar.");
      setMessage(preview ? "Simulação aplicada. O banner foi atualizado." : "Simulação limpa.");
      // Recarrega a página do app para refletir o preview.
      window.location.assign("/app");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  function handleApply() {
    const preview: PreviewContext = {
      profile: profile || null,
      role: role || null,
      interface_mode: interfaceMode || null,
      is_lab: false,
    };
    void apply(preview);
  }

  function handleClear() {
    setProfile(""); setRole(""); setInterfaceMode("");
    void apply(null);
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
        <span className="font-medium">Organização:</span> {tenantName}
        <span className="ml-3 text-muted-foreground text-xs">({organizationId})</span>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => { e.preventDefault(); handleApply(); }}
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Perfil de produto simulado</span>
          <select
            className="rounded-md border bg-background p-2 text-sm"
            value={profile}
            onChange={(e) => setProfile(e.target.value as ProductProfile | "")}
          >
            <option value="">— Usar perfil real da organização —</option>
            {PROFILES.map((p) => (
              <option key={p} value={p}>{PROFILE_LABELS[p]}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Papel simulado</span>
          <select
            className="rounded-md border bg-background p-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as Role | "")}
          >
            <option value="">— Usar papel real do admin —</option>
            {(Object.entries(ROLE_LABELS) as [Role, string][]).map(([r, label]) => (
              <option key={r} value={r}>{label}</option>
            ))}
          </select>
        </label>

        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Interface simulada</span>
          <select
            className="rounded-md border bg-background p-2 text-sm"
            value={interfaceMode}
            onChange={(e) => setInterfaceMode(e.target.value as "simple" | "advanced" | "")}
          >
            <option value="">— Usar interface real da organização —</option>
            <option value="simple">Simples — Máximo 5 áreas, sem termos técnicos</option>
            <option value="advanced">Avançada — Todos os recursos visíveis</option>
          </select>
        </label>

        <div className="flex gap-3">
          <Button type="submit" disabled={busy}>{busy ? "Aplicando…" : "Abrir simulação"}</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={handleClear}>
            Limpar simulação
          </Button>
        </div>
      </form>

      {message && (
        <p role="status" className="rounded-md border px-3 py-2 text-sm">{message}</p>
      )}

      <div className="rounded-lg border p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Como funciona</p>
        <p>• O preview é gravado no banco, vinculado à sua sessão de acompanhamento.</p>
        <p>• Você verá a interface com o perfil, papel e complexidade visual selecionados.</p>
        <p>• Nenhuma configuração da organização é alterada.</p>
        <p>• Workers e automações continuam usando somente as configurações reais.</p>
        <p>• A simulação permite somente leitura. Para editar dados, encerre o acompanhamento e inicie uma sessão de suporte com edição.</p>
        <p>• Sair do acompanhamento limpa completamente o contexto de simulação.</p>
      </div>
    </div>
  );
}
