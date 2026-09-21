/**
 * Agrupamento temático de capacidades do agente para configuração avançada.
 *
 * Permite ao usuário (dono de clínica, barbearia, consultório, imobiliária ou loja)
 * identificar com clareza imediata o que pertence a cada área — com destaque
 * especial para Agendamento & Calendário.
 *
 * Client-safe: zero import de zod, supabase ou next/headers.
 */

export type ToolGroupId =
  | "agendamento"
  | "atendimento"
  | "funil"
  | "comercio"
  | "escalacao"
  | "conhecimento"
  | "operacao"
  | "retencao"
  | "governanca";

export interface ToolGroupMeta {
  id: ToolGroupId;
  rotulo: string;
  emoji: string;
  explicacao: string;
  ordem: number;
}

export const GRUPOS_AVANCADOS: ReadonlyArray<ToolGroupMeta> = [
  {
    id: "agendamento",
    rotulo: "Agendamento & Calendário",
    emoji: "📅",
    explicacao:
      "Consultar horários livres, marcar consultas/sessões, reagendar, confirmar presença e cancelar compromissos.",
    ordem: 1,
  },
  {
    id: "atendimento",
    rotulo: "Atendimento & Conversas",
    emoji: "💬",
    explicacao:
      "Buscar contatos, ler histórico de mensagens, propor anotações na ficha e gerenciar o diálogo no WhatsApp.",
    ordem: 2,
  },
  {
    id: "funil",
    rotulo: "Vendas & Funis de Negócio",
    emoji: "💼",
    explicacao:
      "Ver funis e etapas, criar e atualizar oportunidades de venda, e mover contatos pelas fases comerciais.",
    ordem: 3,
  },
  {
    id: "comercio",
    rotulo: "Catálogo & Produtos",
    emoji: "🛍️",
    explicacao:
      "Pesquisar produtos, consultar catálogo e preços, e listar histórico de compras e pedidos do cliente.",
    ordem: 4,
  },
  {
    id: "escalacao",
    rotulo: "Passagem para Humano & Equipe",
    emoji: "👥",
    explicacao:
      "Verificar atendentes online, abrir chamados internos com notas da conversa e transferir atendimentos.",
    ordem: 5,
  },
  {
    id: "conhecimento",
    rotulo: "Conhecimento & Memória",
    emoji: "📚",
    explicacao:
      "Consultar documentos do acervo, regras e diretrizes da empresa e sugerir novos aprendizados contínuos.",
    ordem: 6,
  },
  {
    id: "operacao",
    rotulo: "Operação & Etiquetas",
    emoji: "🏷️",
    explicacao:
      "Gerenciar etiquetas (tags), consultar respostas rápidas, etapas operacionais e automações.",
    ordem: 7,
  },
  {
    id: "retencao",
    rotulo: "Retenção & Retorno",
    emoji: "🔄",
    explicacao:
      "Agendar retornos programados (follow-ups), monitorar clientes esfriando e propor reativações.",
    ordem: 8,
  },
  {
    id: "governanca",
    rotulo: "Privacidade & Governança",
    emoji: "🛡️",
    explicacao:
      "Consultar solicitações de privacidade e diretrizes de governança e proteção de dados (LGPD).",
    ordem: 9,
  },
] as const;

const MAPA_TOOL_GRUPO: Record<string, ToolGroupId> = {
  // Agendamento & Calendário
  crm_list_event_types: "agendamento",
  crm_find_free_slots: "agendamento",
  crm_list_appointments: "agendamento",
  crm_find_and_book_appointment: "agendamento",
  crm_book_appointment: "agendamento",
  crm_reschedule_appointment: "agendamento",
  crm_confirm_appointment: "agendamento",
  crm_set_appointment_outcome: "agendamento",
  crm_cancel_appointment: "agendamento",

  // Atendimento & Conversas
  crm_search_contacts: "atendimento",
  crm_get_contact: "atendimento",
  crm_propose_contact_field: "atendimento",
  crm_list_conversations: "atendimento",
  crm_get_conversation: "atendimento",
  crm_get_conversation_history: "atendimento",
  crm_send_whatsapp_message: "atendimento",
  crm_start_conversation_and_send: "atendimento",

  // Vendas & Funil
  crm_list_leads: "funil",
  crm_get_lead: "funil",
  crm_list_pipelines: "funil",
  crm_create_lead: "funil",
  crm_update_lead: "funil",
  crm_move_lead_stage: "funil",
  crm_archive_lead: "funil",

  // Catálogo & Produtos
  crm_search_products: "comercio",
  crm_list_contact_orders: "comercio",

  // Passagem para Humano
  crm_list_available_attendants: "escalacao",
  crm_list_human_cases: "escalacao",
  crm_get_human_case: "escalacao",
  crm_add_case_note: "escalacao",
  crm_close_human_case: "escalacao",
  crm_resume_ai_attendance: "escalacao",
  crm_assign_conversation: "escalacao",
  crm_request_human_handoff: "escalacao",

  // Conhecimento & Memória
  crm_search_knowledge: "conhecimento",
  crm_list_knowledge_sources: "conhecimento",
  crm_list_improvement_proposals: "conhecimento",
  crm_get_org_memory: "conhecimento",
  crm_save_org_memory: "conhecimento",

  // Operação & Etiquetas
  crm_list_stages: "operacao",
  crm_create_stage: "operacao",
  crm_update_stage: "operacao",
  crm_archive_stage: "operacao",
  crm_list_tags: "operacao",
  crm_manage_tags: "operacao",
  crm_list_message_templates: "operacao",
  crm_render_message_template: "operacao",
  crm_list_webhook_sources: "operacao",
  crm_list_webhook_source_events: "operacao",
  crm_create_webhook_source: "operacao",
  crm_set_webhook_source_active: "operacao",
  crm_list_automation_rules: "operacao",
  crm_list_automation_runs: "operacao",
  crm_set_automation_rule_active: "operacao",
  crm_list_team_members: "operacao",
  crm_get_queue_status: "operacao",

  // Retenção & Follow-up
  crm_schedule_followup: "retencao",
  crm_enroll_followup_flow: "retencao",
  crm_cancel_followup: "retencao",
  crm_list_followups: "retencao",
  crm_list_at_risk_leads: "retencao",
  crm_close_demand: "retencao",
  crm_propose_reactivation: "retencao",

  // Governança & Privacidade
  crm_list_privacy_requests: "governanca",
};

/**
 * Classifica uma tool em seu grupo temático por nome ou pelo recurso que ela toca.
 */
export function classificarToolNoGrupo(name: string, oQueToca?: string): ToolGroupId {
  const direto = MAPA_TOOL_GRUPO[name];
  if (direto) return direto;

  const toca = (oQueToca ?? "").toLowerCase();
  const n = name.toLowerCase();

  if (
    toca.includes("agenda") ||
    n.includes("appointment") ||
    n.includes("event_type") ||
    n.includes("slot")
  ) {
    return "agendamento";
  }

  if (
    toca.includes("cliente") ||
    toca.includes("atendimento") ||
    n.includes("contact") ||
    n.includes("conversation") ||
    n.includes("message")
  ) {
    return "atendimento";
  }

  if (toca.includes("funil") || n.includes("lead") || n.includes("pipeline")) {
    return "funil";
  }

  if (toca.includes("catálogo") || toca.includes("compra") || n.includes("product") || n.includes("order")) {
    return "comercio";
  }

  if (toca.includes("humano") || toca.includes("chamado") || n.includes("handoff") || n.includes("case")) {
    return "escalacao";
  }

  if (toca.includes("conhecimento") || toca.includes("memória") || toca.includes("aprendizado") || n.includes("memory") || n.includes("knowledge")) {
    return "conhecimento";
  }

  if (toca.includes("retorno") || toca.includes("acompanhamento") || n.includes("followup")) {
    return "retencao";
  }

  if (toca.includes("privacidade") || toca.includes("lgpd") || n.includes("privacy")) {
    return "governanca";
  }

  return "operacao";
}

export function grupoMeta(id: ToolGroupId): ToolGroupMeta {
  const encontrado = GRUPOS_AVANCADOS.find((g) => g.id === id);
  return (
    encontrado ?? {
      id,
      rotulo: id,
      emoji: "⚙️",
      explicacao: "",
      ordem: 99,
    }
  );
}
