/**
 * Schema de configuração estruturada do assistente ("Meu Assistente").
 *
 * O cliente nunca edita o prompt técnico diretamente.
 * O servidor compila estas configurações em system_prompt
 * usando promptFromConfig(), antes de criar/publicar a versão do agente.
 *
 * A configuração é armazenada em ai_agents.config->assistant_config (jsonb).
 * Os campos técnicos (system_prompt, model, etc.) continuam na tabela de versões.
 */
import { z } from "zod";

export const TONES = ["professional", "friendly", "welcoming", "objective", "custom"] as const;
export type Tone = (typeof TONES)[number];

export const TONE_LABELS: Record<Tone, string> = {
  professional: "Profissional",
  friendly: "Amigável",
  welcoming: "Acolhedor",
  objective: "Objetivo e direto",
  custom: "Personalizado",
};

export const BUSINESS_TYPES = [
  "clinic", "salon", "office", "service_provider",
  "restaurant", "real_estate", "general", "sales",
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  clinic: "Clínica ou consultório",
  salon: "Salão e estética",
  office: "Escritório profissional",
  service_provider: "Prestador de serviços",
  restaurant: "Restaurante",
  real_estate: "Imobiliária",
  general: "Atendimento geral",
  sales: "Empresa de vendas",
};

export const AUTONOMY_LEVELS = ["suggest_only", "automatic", "hybrid"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  suggest_only: "Somente sugerir respostas — um agente humano aprova antes de enviar",
  automatic: "Responder automaticamente dentro das regras definidas",
  hybrid: "Híbrido — responde assuntos simples e transfere situações sensíveis para humano",
};

export const RESPONSE_LENGTH = ["short", "medium", "long"] as const;
export type ResponseLength = (typeof RESPONSE_LENGTH)[number];

export const serviceItemSchema = z.object({
  id: z.string().default(() => Math.random().toString(36).slice(2, 9)),
  name: z.string().min(1, "O nome do item é obrigatório").max(120),
  price: z.string().max(80).default(""),
  description: z.string().max(300).default(""),
});
export type ServiceItem = z.infer<typeof serviceItemSchema>;

export const assistantConfigSchema = z.object({
  /** Metadados do assistente */
  assistant_name: z.string().min(1).max(80).default("Assistente"),
  presentation: z.string().max(300).default(""),
  objective: z.string().max(500).default(""),
  business_type: z.enum(BUSINESS_TYPES).nullable().default(null),
  template_id: z.string().nullable().default(null),

  /** Tom e comunicação */
  tone: z.enum(TONES).default("professional"),
  custom_tone: z.string().max(200).default(""),
  formality: z.enum(["formal", "informal"]).default("formal"),
  use_emojis: z.boolean().default(false),
  response_length: z.enum(RESPONSE_LENGTH).default("medium"),

  /** Conhecimento estruturado e regras */
  services: z.string().max(2000).default(""),
  service_items: z.array(serviceItemSchema).default([]),
  faq: z.string().max(3000).default(""),
  knowledge_notes: z.string().max(3000).default(""),
  forbidden_topics: z.string().max(1000).default(""),
  escalation_triggers: z.string().max(1000).default(""),

  /** Agenda */
  can_schedule: z.boolean().default(false),

  /** Horários */
  business_hours: z.string().max(500).default(""),
  out_of_hours_message: z.string().max(500).default(""),

  /** Autonomia */
  autonomy: z.enum(AUTONOMY_LEVELS).default("hybrid"),
}).strict();

export type AssistantConfig = z.infer<typeof assistantConfigSchema>;

/** Modelos de configuração por segmento de negócio */
export const BUSINESS_TEMPLATES: Record<BusinessType, Partial<AssistantConfig>> = {
  clinic: {
    assistant_name: "Assistente da Clínica",
    objective: "Auxiliar pacientes com informações, agendamentos e dúvidas sobre consultas.",
    tone: "welcoming",
    formality: "formal",
    can_schedule: true,
    services: "Consultas médicas, retornos, exames e procedimentos.",
    escalation_triggers: "Urgências, sintomas graves, solicitações de receitas.",
    forbidden_topics: "Diagnósticos, prescrições, informações de outros pacientes.",
  },
  salon: {
    assistant_name: "Assistente do Salão",
    objective: "Ajudar clientes a agendar serviços de beleza e responder dúvidas.",
    tone: "friendly",
    formality: "informal",
    use_emojis: true,
    can_schedule: true,
    services: "Corte, coloração, tratamentos capilares, manicure, pedicure.",
    escalation_triggers: "Reclamações, situações inusitadas, solicitações especiais.",
  },
  office: {
    assistant_name: "Assistente do Escritório",
    objective: "Atender clientes, agendar reuniões e responder dúvidas sobre serviços profissionais.",
    tone: "professional",
    formality: "formal",
    can_schedule: true,
    services: "Consultas, orientações e atendimento especializado.",
    forbidden_topics: "Opiniões pessoais, informações confidenciais de outros clientes.",
  },
  service_provider: {
    assistant_name: "Assistente de Atendimento",
    objective: "Responder dúvidas, orçamentos e agendamentos de serviços.",
    tone: "friendly",
    formality: "informal",
    can_schedule: true,
    escalation_triggers: "Reclamações, garantias, situações fora do padrão.",
  },
  restaurant: {
    assistant_name: "Assistente do Restaurante",
    objective: "Informar sobre cardápio, horários, reservas e promoções.",
    tone: "welcoming",
    formality: "informal",
    use_emojis: true,
    can_schedule: true,
    services: "Cardápio, reservas, delivery, eventos.",
    forbidden_topics: "Preços de concorrentes, reclamações de clientes específicos.",
  },
  real_estate: {
    assistant_name: "Assistente Imobiliário",
    objective: "Apresentar imóveis, agendar visitas e qualificar interessados.",
    tone: "professional",
    formality: "formal",
    can_schedule: true,
    services: "Imóveis à venda e para locação, visitas, financiamento.",
    escalation_triggers: "Negociações, documentação, condições especiais.",
  },
  general: {
    assistant_name: "Assistente de Atendimento",
    objective: "Atender clientes e responder dúvidas sobre os serviços.",
    tone: "friendly",
    formality: "informal",
    autonomy: "hybrid",
  },
  sales: {
    assistant_name: "Assistente Comercial",
    objective: "Qualificar leads, apresentar produtos e serviços, e apoiar o processo de vendas.",
    tone: "professional",
    formality: "formal",
    services: "Produtos, serviços, propostas e condições comerciais.",
    escalation_triggers: "Negociações avançadas, condições especiais, reclamações.",
    forbidden_topics: "Informações confidenciais de concorrentes.",
  },
};

/**
 * Compila a configuração estruturada em um system_prompt técnico.
 * Chamado exclusivamente no servidor, antes de criar/publicar a versão do agente.
 * O cliente nunca recebe nem edita este prompt diretamente.
 */
export function promptFromConfig(config: AssistantConfig): string {
  const parts: string[] = [];
  const toneMap: Record<Tone, string> = {
    professional: "profissional e respeitoso",
    friendly: "amigável e próximo",
    welcoming: "acolhedor e empático",
    objective: "objetivo e direto ao ponto",
    custom: config.custom_tone || "adequado ao contexto",
  };
  const lengthMap: Record<ResponseLength, string> = {
    short: "curtas e diretas (máximo 2-3 frases quando possível)",
    medium: "equilibradas, com detalhes suficientes sem ser excessivo",
    long: "completas e detalhadas quando necessário",
  };
  const autonomyMap: Record<AutonomyLevel, string> = {
    suggest_only: "Você opera em modo de sugestão. Nunca envie mensagens diretamente — apenas sugira respostas para o agente humano revisar e aprovar.",
    automatic: "Você responde automaticamente dentro das regras definidas. Transfira para humano apenas nas situações indicadas.",
    hybrid: "Você responde automaticamente assuntos rotineiros e simples. Para situações sensíveis, negociações ou dúvidas fora do padrão, transfira para um agente humano.",
  };

  parts.push(`Você é ${config.assistant_name}.`);
  if (config.presentation) parts.push(config.presentation);
  if (config.objective) parts.push(`\nSeu objetivo: ${config.objective}`);
  parts.push(`\nSeu tom de comunicação é ${toneMap[config.tone]}.`);
  parts.push(`Use linguagem ${config.formality === "formal" ? "formal" : "informal"}.`);
  if (config.use_emojis) parts.push("Você pode usar emojis ocasionalmente para tornar a conversa mais amigável.");
  else parts.push("Não use emojis.");
  if (config.service_items && config.service_items.length > 0) {
    const itemsText = config.service_items
      .filter(item => item.name && item.name.trim().length > 0)
      .map(item => {
        let line = `• ${item.name}`;
        if (item.price) line += ` — Preço: ${item.price}`;
        if (item.description) line += ` (${item.description})`;
        return line;
      })
      .join("\n");
    if (itemsText) {
      parts.push(`\nCatálogo de Serviços / Produtos e Valores Oficiais:\n${itemsText}`);
    }
  }
  if (config.services) parts.push(`\nInformações adicionais sobre serviços e produtos:\n${config.services}`);
  if (config.faq) parts.push(`\nPerguntas frequentes e respostas:\n${config.faq}`);
  if (config.knowledge_notes) parts.push(`\nInformações importantes que você deve conhecer:\n${config.knowledge_notes}`);
  if (config.forbidden_topics) parts.push(`\nAssuntos que você NÃO deve responder:\n${config.forbidden_topics}\nQuando solicitado sobre esses assuntos, informe educadamente que não pode ajudar e ofereça alternativas.`);
  if (config.escalation_triggers) parts.push(`\nSituações em que você DEVE transferir para um agente humano:\n${config.escalation_triggers}`);
  if (config.can_schedule) {
    parts.push("\nVocê pode consultar disponibilidade e propor horários para agendamentos. Antes de criar ou alterar qualquer agendamento, confirme a identidade do contato, a disponibilidade real e as permissões.");
  }
  if (config.business_hours) parts.push(`\nHorários de atendimento:\n${config.business_hours}`);
  if (config.out_of_hours_message) parts.push(`Fora do horário de atendimento, responda: "${config.out_of_hours_message}"`);
  parts.push(`\n${autonomyMap[config.autonomy]}`);
  parts.push("\nSempre seja honesto sobre o que você pode e não pode fazer. Nunca invente informações.");
  return parts.join("\n");
}
