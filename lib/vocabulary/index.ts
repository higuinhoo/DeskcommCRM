/**
 * Camada central de vocabulário por organização.
 *
 * O vocabulário determina como termos-chave aparecem em menus, títulos,
 * botões, estados vazios, filtros, mensagens e atributos de acessibilidade.
 *
 * Vocabulários disponíveis:
 * - "neutral":     Linguagem neutra (Contato, Atendimento, Etapas, Concluído, Encerrado)
 * - "commercial":  Linguagem comercial/CRM (Lead, Oportunidade, Funil, Ganho, Perdido)
 * - "custom":      Termos definidos pela própria organização (com fallback para neutro)
 *
 * O perfil de produto determina o padrão: essential/assistant_agenda usam neutro;
 * sales usa comercial. A organização pode sobrescrever.
 */

import type { ProductProfile } from "@/lib/product/capabilities";

export type VocabularyMode = "neutral" | "commercial" | "custom";

export interface VocabularyTerms {
  /** Entidade de atendimento principal */
  contact: string;
  /** Lista de contatos */
  contacts: string;
  /** Nova entidade */
  new_contact: string;
  /** Contatos recentes */
  recent_contacts: string;
  /** Processo/oportunidade */
  deal: string;
  /** Processos/oportunidades */
  deals: string;
  /** Funil de processos */
  pipeline: string;
  /** Estado: concluído positivo */
  won: string;
  /** Estado: encerrado negativo */
  lost: string;
  /** Responsável pelo atendimento */
  assignee: string;
  /** Novo atendimento / Novo processo */
  new_deal: string;
  /** Área de negociação/oportunidades */
  sales_area: string;
  /** Área de atendimento */
  inbox_area: string;
}

export const NEUTRAL_VOCABULARY: VocabularyTerms = {
  contact: "Contato",
  contacts: "Contatos",
  new_contact: "Novo contato",
  recent_contacts: "Contatos recentes",
  deal: "Atendimento",
  deals: "Atendimentos",
  pipeline: "Etapas",
  won: "Concluído",
  lost: "Encerrado",
  assignee: "Responsável",
  new_deal: "Novo atendimento",
  sales_area: "Processos",
  inbox_area: "Conversas",
};

export const COMMERCIAL_VOCABULARY: VocabularyTerms = {
  contact: "Lead",
  contacts: "Leads",
  new_contact: "Novo lead",
  recent_contacts: "Leads recentes",
  deal: "Oportunidade",
  deals: "Oportunidades",
  pipeline: "Funil",
  won: "Ganho",
  lost: "Perdido",
  assignee: "Vendedor",
  new_deal: "Nova oportunidade",
  sales_area: "CRM",
  inbox_area: "Inbox",
};

/** Resolve o vocabulário para uma organização.
 * @param mode      Modo configurado na organização
 * @param custom    Termos personalizados (sobrescrevem apenas o que estiver definido)
 * @param profile   Perfil de produto — define o padrão quando mode não está definido
 */
export function resolveVocabulary(
  mode: VocabularyMode | null | undefined,
  custom: Partial<VocabularyTerms> | null | undefined,
  profile: ProductProfile | null | undefined,
): VocabularyTerms {
  const effectiveMode = mode ?? (profile === "sales" ? "commercial" : "neutral");
  const base = effectiveMode === "commercial" ? COMMERCIAL_VOCABULARY : NEUTRAL_VOCABULARY;
  if (effectiveMode === "custom" && custom) {
    return { ...base, ...Object.fromEntries(Object.entries(custom).filter(([, v]) => v)) } as VocabularyTerms;
  }
  return base;
}

/** Hook de vocabulário para ser usado via contexto/prop.
 *  Use resolveVocabulary() no servidor e passe os termos resolvidos para o cliente. */
export type { VocabularyTerms as Vocabulary };
