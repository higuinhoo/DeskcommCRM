/**
 * Definições canônicas dos 6 Templates de Negócio para o DeskcommCRM.
 * Adapta nomenclaturas das telas, funis e assistente de IA por segmento.
 */

export interface ServiceItem {
  id: string;
  name: string;
  price: string;
  description: string;
}

export interface BusinessVocabulary {
  contacts: string;
  contact_singular: string;
  products: string;
  product_singular: string;
  deals: string;
  deal_singular: string;
  pipeline_name: string;
  won_label: string;
  lost_label: string;
}

export interface BusinessTemplateDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  vocabulary: BusinessVocabulary;
  defaultServices: ServiceItem[];
  assistant: {
    name: string;
    presentation: string;
    objective: string;
    tone: "professional" | "friendly" | "welcoming" | "objective";
    formality: "formal" | "informal";
    use_emojis: boolean;
    can_schedule: boolean;
    escalation_triggers: string;
    forbidden_topics: string;
    knowledge_notes: string;
    faq: string;
  };
}

export const BUSINESS_TEMPLATES: Record<string, BusinessTemplateDef> = {
  clinica: {
    id: "clinica",
    label: "Clínica & Consultório",
    icon: "🏥",
    description: "Para clínicas médicas, consultórios odontológicos, psicologia, estética avançada e fisioterapia.",
    vocabulary: {
      contacts: "Pacientes",
      contact_singular: "Paciente",
      products: "Procedimentos & Consultas",
      product_singular: "Procedimento / Consulta",
      deals: "Consultas Agendadas",
      deal_singular: "Consulta",
      pipeline_name: "Fluxo de Atendimento Clínico",
      won_label: "Consulta Realizada",
      lost_label: "Faltou / Cancelou",
    },
    defaultServices: [
      { id: "1", name: "Consulta Inicial / Avaliação", price: "R$ 200,00", description: "Avaliação clínica completa, anamnese e direcionamento terapêutico." },
      { id: "2", name: "Consulta de Retorno", price: "Incluso em até 30 dias", description: "Acompanhamento do tratamento e análise de exames." },
      { id: "3", name: "Procedimento Especializado", price: "A partir de R$ 350,00", description: "Execução de procedimentos e aplicação de protocolos específicos." },
    ],
    assistant: {
      name: "Secretária Virtual da Clínica",
      presentation: "Olá! Sou a secretária virtual da clínica e estou aqui para tirar suas dúvidas e agendar sua consulta.",
      objective: "Auxiliar pacientes com informações sobre procedimentos, agendamento de consultas e horários disponíveis.",
      tone: "welcoming",
      formality: "formal",
      use_emojis: true,
      can_schedule: true,
      escalation_triggers: "Sintomas graves, emergências, pedidos de receitas médicas ou laudos urgentes.",
      forbidden_topics: "Diagnósticos médicos, prescrição de remédios, opinar sobre tratamentos de outros médicos.",
      knowledge_notes: "Aceitamos cartões de crédito/débito e PIX. Estacionamento conveniado no subsolo do edifício.",
      faq: "Pergunta: Atendem por plano de saúde?\nResposta: Trabalhamos no formato particular com emissão de nota fiscal para reembolso integral junto ao seu plano.\n\nPergunta: Preciso levar exames anteriores?\nResposta: Sim, traga todos os exames recentes na primeira consulta para melhor avaliação.",
    },
  },

  barbearia: {
    id: "barbearia",
    label: "Barbearia & Salão de Beleza",
    icon: "💈",
    description: "Para barbearias, salões de beleza, estúdios de manicure, sobrancelhas e cuidados estéticos.",
    vocabulary: {
      contacts: "Clientes",
      contact_singular: "Cliente",
      products: "Cortes & Serviços",
      product_singular: "Corte / Serviço",
      deals: "Agendamentos",
      deal_singular: "Horário Agendado",
      pipeline_name: "Fila de Atendimento & Horários",
      won_label: "Atendimento Concluído",
      lost_label: "Cancelou / Não compareceu",
    },
    defaultServices: [
      { id: "1", name: "Corte de Cabelo (Degradê / Tesoura)", price: "R$ 50,00", description: "Corte personalizado, lavagem e finalização com pomada modeladora." },
      { id: "2", name: "Barba Completa (Terapia & Navalha)", price: "R$ 40,00", description: "Toalha quente, hidratação com óleo essencial e alinhamento com navalha." },
      { id: "3", name: "Combo Cabelo + Barba", price: "R$ 80,00", description: "Experiência completa com desconto especial no combo." },
      { id: "4", name: "Sobrancelha na Navalha / Pinça", price: "R$ 20,00", description: "Alinhamento e limpeza rápida do desenho da sobrancelha." },
    ],
    assistant: {
      name: "Atendente da Barbearia",
      presentation: "E aí, tudo bem? Sou o assistente virtual da barbearia. Quer marcar um horário para dar um trato no visual?",
      objective: "Ajudar clientes a escolher serviços, verificar horários disponíveis com os barbeiros e confirmar agendamentos.",
      tone: "friendly",
      formality: "informal",
      use_emojis: true,
      can_schedule: true,
      escalation_triggers: "Reclamações sobre atendimento, pedidos especiais de eventos ou noivos.",
      forbidden_topics: "Preços de outras barbearias, assuntos políticos ou polêmicos.",
      knowledge_notes: "Cerveja gelada e café de cortesia durante a espera. Aceitamos PIX e cartões.",
      faq: "Pergunta: Precisa marcar horário ou atendem por ordem de chegada?\nResposta: Atendemos com horário marcado para você não esperar, mas também encaixamos se houver vaga!\n\nPergunta: Tem estacionamento?\nResposta: Sim, vagas rotativas na frente da loja.",
    },
  },

  escritorio: {
    id: "escritorio",
    label: "Escritório & Advocacia",
    icon: "⚖️",
    description: "Para escritórios de advocacia, consultorias, contabilidade, perícia e serviços intelectuais.",
    vocabulary: {
      contacts: "Clientes & Partes",
      contact_singular: "Cliente / Parte",
      products: "Honorários & Serviços",
      product_singular: "Serviço / Atuação",
      deals: "Casos / Demandas",
      deal_singular: "Caso / Processo",
      pipeline_name: "Jornada de Contratação",
      won_label: "Contrato Fechado",
      lost_label: "Não Contratou",
    },
    defaultServices: [
      { id: "1", name: "Consulta Jurídica Especializada", price: "R$ 350,00", description: "Análise prévia de documentos, parecer técnico e definição de estratégia." },
      { id: "2", name: "Assessoria Jurídica Mensal", price: "A partir de R$ 1.500,00/mês", description: "Consultoria preventiva e contenciosa contínua para empresas." },
      { id: "3", name: "Elaboração e Revisão Contratual", price: "A partir de R$ 800,00", description: "Redação de minutas personalizadas com blindagem jurídica completa." },
    ],
    assistant: {
      name: "Assistente Jurídico do Escritório",
      presentation: "Olá. Seja bem-vindo ao nosso escritório. Como posso auxiliá-lo com suas questões jurídicas ou agendamento de consulta?",
      objective: "Qualificar novos clientes, entender a área jurídica da demanda e agendar reuniões com os especialistas.",
      tone: "professional",
      formality: "formal",
      use_emojis: false,
      can_schedule: true,
      escalation_triggers: "Prazos processuais iminentes, prisões, intimações urgentes recebidas no dia.",
      forbidden_topics: "Prometer vitória em causas judiciais, divulgar segredo de justiça de clientes.",
      knowledge_notes: "Reuniões presenciais ou por videoconferência (Google Meet). Atendimento de segunda a sexta das 9h às 18h.",
      faq: "Pergunta: Vocês cobram a primeira consulta?\nResposta: Sim, nossa consulta inicial inclui estudo aprofundado dos documentos e parecer detalhado sobre a viabilidade.\n\nPergunta: O atendimento pode ser 100% online?\nResposta: Sim, atendemos clientes em todo o Brasil por videoconferência com assinatura digital de contratos.",
    },
  },

  imobiliaria: {
    id: "imobiliaria",
    label: "Imobiliária & Corretores",
    icon: "🏠",
    description: "Para imobiliárias, corretores autônomos, loteadoras e administradoras de locação.",
    vocabulary: {
      contacts: "Interessados & Proprietários",
      contact_singular: "Interessado",
      products: "Imóveis & Empreendimentos",
      product_singular: "Imóvel / Unidade",
      deals: "Propostas & Visitas",
      deal_singular: "Proposta / Visita",
      pipeline_name: "Funil de Locação & Venda",
      won_label: "Negócio Fechado",
      lost_label: "Desistiu / Perdeu",
    },
    defaultServices: [
      { id: "1", name: "Apartamento 2 Quartos (Locação)", price: "R$ 2.200,00/mês", description: "Imóvel semi-mobiliado, com vaga de garagem e área de lazer completa." },
      { id: "2", name: "Casa em Condomínio Fechado (Venda)", price: "R$ 750.000,00", description: "3 suítes, piscina privativa e segurança 24 horas." },
      { id: "3", name: "Avaliação Mercadológica de Imóvel", price: "Sob consulta", description: "Laudo completo para precificação precisa de venda ou locação." },
    ],
    assistant: {
      name: "Consultor Imobiliário Virtual",
      presentation: "Olá! Sou o assistente da imobiliária. Está procurando um imóvel para comprar, alugar ou deseja anunciar o seu?",
      objective: "Coletar o perfil do imóvel desejado (bairro, quartos, faixa de preço) e agendar visitas com um corretor.",
      tone: "professional",
      formality: "formal",
      use_emojis: true,
      can_schedule: true,
      escalation_triggers: "Propostas formais de compra, solicitações de desconto agressivo, urgência de mudança.",
      forbidden_topics: "Endereço exato ou dados pessoais de proprietários de imóveis desocupados.",
      knowledge_notes: "Financiamento bancário facilitado pela Caixa, Itaú, Santander e Bradesco.",
      faq: "Pergunta: O que preciso para alugar um imóvel?\nResposta: Comprovante de renda (3x o valor do aluguel), documento com foto e garantia (seguro-fiança, fiador ou caução).\n\nPergunta: Aceitam financiamento na compra?\nResposta: Sim! Aprovamos sua carta de crédito e cuidamos de todo o processo bancário.",
    },
  },

  servicos: {
    id: "servicos",
    label: "Prestador de Serviços & Manutenção",
    icon: "🔧",
    description: "Para oficinas mecânicas, assistência técnica, ar-condicionado, reformas e prestadores autônomos.",
    vocabulary: {
      contacts: "Clientes",
      contact_singular: "Cliente",
      products: "Serviços & Peças",
      product_singular: "Serviço / Peça",
      deals: "Ordens de Serviço (OS)",
      deal_singular: "Ordem de Serviço",
      pipeline_name: "Fluxo de Ordens de Serviço",
      won_label: "OS Concluída e Paga",
      lost_label: "Orçamento Recusado",
    },
    defaultServices: [
      { id: "1", name: "Visita Técnica & Diagnóstico", price: "R$ 90,00", description: "Avaliação técnica no local com teste de bancada e orçamento detalhado." },
      { id: "2", name: "Manutenção Preventiva / Higienização", price: "R$ 180,00", description: "Limpeza completa, lubrificação e reaperto dos componentes." },
      { id: "3", name: "Reparo e Troca de Componentes", price: "Sob orçamento", description: "Substituição de peças com garantia de 90 dias e nota fiscal." },
    ],
    assistant: {
      name: "Atendente de Serviços e Suporte",
      presentation: "Olá! Sou o assistente da nossa central de serviços. Qual equipamento ou serviço você precisa de ajuda hoje?",
      objective: "Identificar o problema do cliente, repassar faixas estimadas de preço e agendar a visita técnica.",
      tone: "friendly",
      formality: "informal",
      use_emojis: true,
      can_schedule: true,
      escalation_triggers: "Garantias, reclamações de serviço anterior, clientes com pane urgente.",
      forbidden_topics: "Prometer conserto garantido sem avaliação física das peças.",
      knowledge_notes: "Garantia legal de 90 dias em peças e mão de obra. Pagamento facilitado em até 6x.",
      faq: "Pergunta: O orçamento é gratuito?\nResposta: O orçamento em loja é sem custo. Para visita domiciliar há uma pequena taxa que é abatida se o serviço for aprovado!\n\nPergunta: Quanto tempo demora o conserto?\nResposta: A maioria dos serviços é concluída entre 24h e 48h após a aprovação das peças.",
    },
  },

  vendas: {
    id: "vendas",
    label: "Vendas & Comércio Geral",
    icon: "🛍️",
    description: "Para distribuidoras, lojas virtuais, atacado, varejo e empresas comerciais B2B.",
    vocabulary: {
      contacts: "Leads & Clientes",
      contact_singular: "Lead / Cliente",
      products: "Produtos do Catálogo",
      product_singular: "Produto",
      deals: "Pedidos & Oportunidades",
      deal_singular: "Pedido / Oportunidade",
      pipeline_name: "Funil de Vendas Comercial",
      won_label: "Venda Fechada",
      lost_label: "Negócio Perdido",
    },
    defaultServices: [
      { id: "1", name: "Kit Promocional Mais Vendido", price: "R$ 149,90", description: "Pacote completo com nossos itens mais procurados e frete reduzido." },
      { id: "2", name: "Produto Premium / Edição Especial", price: "R$ 289,00", description: "Acabamento de alta durabilidade com garantia estendida de 1 ano." },
      { id: "3", name: "Plano Corporativo / Atacado", price: "Consulte tabela de quantidade", description: "Descontos progressivos a partir de 10 unidades com faturamento para PJ." },
    ],
    assistant: {
      name: "Assistente Comercial e Vendas",
      presentation: "Olá! Seja bem-vindo! Como posso te ajudar a encontrar o melhor produto ou fechar seu pedido hoje?",
      objective: "Tirar dúvidas sobre os produtos, formas de envio, parcelamento e direcionar para o link de compra.",
      tone: "professional",
      formality: "formal",
      use_emojis: true,
      can_schedule: false,
      escalation_triggers: "Negociações de grandes volumes, solicitações de desconto acima de 10%, reclamações de entrega.",
      forbidden_topics: "Informações sigilosas de fornecedores ou margem de lucro interna.",
      knowledge_notes: "Entregamos para todo o Brasil via Correios e Transportadora. Parcelamos em até 10x sem juros.",
      faq: "Pergunta: Qual o prazo de entrega?\nResposta: O prazo varia conforme seu CEP, geralmente entre 3 e 7 dias úteis após a confirmação do pagamento.\n\nPergunta: Tem frete grátis?\nResposta: Sim! Compras acima de R$ 199,00 têm frete grátis para todo o estado.",
    },
  },
};

export const TEMPLATE_KEYS = Object.keys(BUSINESS_TEMPLATES) as Array<keyof typeof BUSINESS_TEMPLATES>;

export function getTemplate(id: string | null | undefined): BusinessTemplateDef {
  if (id && id in BUSINESS_TEMPLATES) {
    const found = BUSINESS_TEMPLATES[id as keyof typeof BUSINESS_TEMPLATES];
    if (found) return found;
  }
  return BUSINESS_TEMPLATES.vendas;
}

