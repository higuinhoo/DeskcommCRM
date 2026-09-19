"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MODULES, PROFILES, type Decision } from "@/lib/product/capabilities";
import { productPolicySchema, type ProductPolicy } from "@/lib/product/policy";
export function ProductPolicyEditor({
  organizationId,
  initialPolicy,
  initialDecisions,
  globalEnabled,
}: {
  organizationId: string;
  initialPolicy: ProductPolicy;
  initialDecisions: Record<string, Decision>;
  globalEnabled: boolean;
}) {
  const [policy, setPolicy] = useState<ProductPolicy | null>(initialPolicy);
  const [enabled, setEnabled] = useState(globalEnabled);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [decisions, setDecisions] = useState<Record<string, Decision>>(initialDecisions);
  const url = `/api/v1/admin/tenants/${organizationId}/product`;
  async function load() {
    setBusy(true);
    try {
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível carregar.");
      setPolicy(productPolicySchema.parse(body.data.policy));
      setEnabled(body.data.global_enabled);
      setDecisions(body.data.decisions);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar.");
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!policy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expected_revision: policy.revision, policy }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível salvar.");
      await load();
      setMessage("Configuração salva. Os dados existentes foram preservados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  if (!policy)
    return (
      <section>
        <h1 className="text-2xl font-semibold">Perfil e módulos</h1>
        <p role="status">{message || "Carregando…"}</p>
        <Button onClick={() => void load()} disabled={busy}>
          Tentar novamente
        </Button>
      </section>
    );
  return (
    <section className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Perfil e módulos</h1>
        <p className="text-sm text-muted-foreground">
          O perfil define o produto. Os papéis continuam definindo as permissões das pessoas.
          Nenhuma troca apaga dados.
        </p>
      </div>
      {!enabled && (
        <p className="rounded-lg border p-4">
          Liberação global desligada. A experiência atual continua ativa até a validação e liberação
          da implantação.
        </p>
      )}
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={policy.product.enabled}
            onChange={(e) =>
              setPolicy({ ...policy, product: { ...policy.product, enabled: e.target.checked } })
            }
          />
          Ativar os perfis para esta organização
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-2">
            Perfil de produto
            <select
              className="rounded-md border bg-background p-2"
              value={policy.product.profile}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  product: {
                    ...policy.product,
                    profile: e.target.value as ProductPolicy["product"]["profile"],
                  },
                })
              }
            >
              {PROFILES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-2">
            Complexidade da interface
            <select
              className="rounded-md border bg-background p-2"
              value={policy.product.interface_mode}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  product: {
                    ...policy.product,
                    interface_mode: e.target.value as "simple" | "advanced",
                  },
                })
              }
            >
              <option value="simple">Simples</option>
              <option value="advanced">Avançada</option>
            </select>
          </label>
          <label className="grid gap-2">
            Plano
            <input
              className="rounded-md border bg-background p-2"
              maxLength={80}
              value={policy.plan}
              onChange={(e) => setPolicy({ ...policy, plan: e.target.value })}
            />
          </label>
          <label className="grid gap-2">
            Vocabulário
            <select
              className="rounded-md border bg-background p-2"
              value={policy.product.vocabulary}
              onChange={(e) =>
                setPolicy({
                  ...policy,
                  product: {
                    ...policy.product,
                    vocabulary: e.target.value as ProductPolicy["product"]["vocabulary"],
                  },
                })
              }
            >
              <option value="neutral">Neutro</option>
              <option value="commercial">Comercial</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
        </div>
        <fieldset className="space-y-3">
          <legend className="font-medium">Módulos e limites do plano</legend>
          {MODULES.map((m) => (
            <div key={m} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
              <span>{m}</span>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={policy.plan_modules.includes(m)}
                  onChange={(e) =>
                    setPolicy({
                      ...policy,
                      plan_modules: e.target.checked
                        ? [...policy.plan_modules, m]
                        : policy.plan_modules.filter((x) => x !== m),
                    })
                  }
                />
                Incluído no plano
              </label>
              <label>
                Organização{" "}
                <select
                  aria-label={`Módulo ${m}`}
                  className="rounded-md border bg-background p-1"
                  value={
                    policy.product.modules[m] === undefined
                      ? "profile"
                      : String(policy.product.modules[m])
                  }
                  onChange={(e) => {
                    const modules = { ...policy.product.modules };
                    if (e.target.value === "profile") delete modules[m];
                    else modules[m] = e.target.value === "true";
                    setPolicy({ ...policy, product: { ...policy.product, modules } });
                  }}
                >
                  <option value="profile">Usar perfil</option>
                  <option value="true">Ativar</option>
                  <option value="false">Desativar</option>
                </select>
              </label>
              <p className="text-sm text-muted-foreground sm:col-span-3">
                {decisions[m]?.reason} Origem salva: {decisions[m]?.source}
              </p>
            </div>
          ))}
        </fieldset>
        <p role="status">{message}</p>
        <Button type="submit" disabled={busy}>
          {busy ? "Salvando…" : "Salvar perfil e módulos"}
        </Button>
      </form>
    </section>
  );
}
