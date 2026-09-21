import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { COLUNAS_DO_PRODUTO, type Produto } from "@/lib/schemas/produtos";
import { createClient } from "@/lib/supabase/server";

import { getTemplate } from "@/lib/templates/business-templates";
import { ProdutosClient } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Produtos & Serviços" };

/**
 * O CATÁLOGO DA EMPRESA — adaptado ao nicho do template selecionado.
 */
export default async function ProdutosPage() {
  const user = await requireAuth();
  const t = (texto: string) => traduzir(texto, user.idioma);
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");

  const podeEditar = (user.is_platform_admin && !user.support) || ROLE_RANK[activeOrg.role] >= ROLE_RANK.manager;

  const settings = (activeOrg.interface_settings as Record<string, unknown> | undefined) ||
                   (activeOrg as unknown as { settings?: Record<string, unknown> })?.settings || {};
  const templateId = (settings.business_template as string) || "vendas";
  const tpl = getTemplate(templateId);

  const supabase = await createClient();
  const { data } = await supabase
    .from("catalog_products")
    .select(COLUNAS_DO_PRODUTO)
    .eq("organization_id", activeOrg.orgId)
    .order("ativo", { ascending: false })
    .order("nome")
    .limit(500);

  return (
    <ProdutosClient
      inicial={(data ?? []) as unknown as Produto[]}
      podeEditar={podeEditar}
      textos={{
        titulo: t(tpl.vocabulary.products),
        subtitulo: t(
          `Catálogo de ${tpl.vocabulary.products.toLowerCase()}. É daqui que o assistente de IA consulta valores e detalhes para informar os clientes.`,
        ),
        vazio: t(`Nenhum item em ${tpl.vocabulary.products.toLowerCase()} cadastrado ainda`),
        vazioDica: t(
          "Cadastre seus serviços ou produtos para que o assistente possa informar valores e detalhes automaticamente.",
        ),
      }}
    />
  );
}
