/**
 * Classificador de intenção do Intent Router (Fase 3 — Task 3). Roda um modelo
 * BARATO (router.classifierModel, config da org via ai_routers) pelo MESMO seam
 * agnóstico (runModelCall, purpose 'intent_router') pra decidir pra qual agente
 * do router o turno deve ir. Mesmo padrão de stage-classifier.ts: o classificador
 * SUGERE, nunca escreve estado — quem decide o roteamento é o chamador (Task 4).
 *
 * Defesa contra saída de modelo (não-confiável): parseIntentVerdict NUNCA lança —
 * JSON malformado, campo faltando, intenção alucinada (fora da lista de members
 * do router) ou confidence fora de [0,1]/não-numérico tudo vira veredito nulo
 * ({ intentName: null, confidence: 0 }). classifyIntent embrulha tudo em
 * try/catch: qualquer erro (falha do modelo, LlmModelNotEnabledError, timeout)
 * vira log.warn + null — o chamador cai no fallbackAgentId do router.
 */
import { choice } from '@typesafe-ai/sdk';
import type pg from 'pg';

import type { Logger } from '../obs/logger';
import type { runModelCall, LlmEdgeConfig } from '../edge/llm/run-model-call';
import type { LoadedRouter, RouterMember } from './router-config';
import { avaliarComJev, jevConfigurado } from '@/lib/ai/system-one/client';

export interface IntentVerdict {
  intentName: string | null;
  confidence: number;
}

/** Instrução final fixa — pede JSON estrito, marcador estável pros testes/prompt. */
const JSON_INSTRUCTION =
  'Responda SOMENTE JSON: {"intent": "<nome exato de uma intenção da lista ou none>", "confidence": <0 a 1>}';

export function buildClassifierPrompt(members: RouterMember[], signal: string): string {
  const list = members
    .map((m) => {
      const examples = m.examples.length > 0 ? ` Exemplos: ${m.examples.join('; ')}.` : '';
      return `- ${m.intentName}: ${m.intentDescription}.${examples}`;
    })
    .join('\n');
  return [
    'Você é um classificador auxiliar de intenção (NÃO responde ao lead).',
    'Intenções possíveis:',
    list,
    '- none: nenhuma das intenções acima se aplica.',
    '',
    'Mensagem do lead a classificar:',
    signal,
    '',
    JSON_INSTRUCTION,
  ].join('\n');
}

/**
 * Parse tolerante (padrão de flywheel/live.ts): indexOf('{')/lastIndexOf('}') +
 * JSON.parse em try/catch. NUNCA lança — qualquer saída inesperada do modelo
 * vira { intentName: null, confidence: 0 }. Intenção fora de `members` é
 * recusada (defesa contra alucinação): o chamador não pode rotear pra um
 * agentId que o parse inventou.
 */
export function parseIntentVerdict(text: string, members: RouterMember[]): IntentVerdict {
  const nullVerdict: IntentVerdict = { intentName: null, confidence: 0 };
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return nullVerdict;

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return nullVerdict;
  }
  if (typeof parsed !== 'object' || parsed === null) return nullVerdict;

  const raw = parsed as { intent?: unknown; confidence?: unknown };
  const confidence = typeof raw.confidence === 'number' && !Number.isNaN(raw.confidence)
    ? Math.min(1, Math.max(0, raw.confidence))
    : 0;

  if (typeof raw.intent !== 'string' || raw.intent === 'none') {
    return { intentName: null, confidence };
  }
  const known = members.some((m) => m.intentName === raw.intent);
  if (!known) return nullVerdict;

  return { intentName: raw.intent, confidence };
}

export interface ClassifyIntentDeps {
  log: Logger;
  runModelCall?: typeof runModelCall;
}

export async function classifyIntent(
  db: pg.Pool,
  llmCfg: LlmEdgeConfig,
  input: {
    tenantId: string;
    /** null quando não há contact_id real (ex.: classificação de teste na UI) — vira contact_id null em llm_calls, nunca um uuid inventado (violaria a FK). */
    leadId: string | null;
    /** null quando não há job_queue real por trás da chamada (mesma razão de leadId). */
    jobId: string | null;
    router: LoadedRouter;
    signal: string;
  },
  deps: ClassifyIntentDeps,
): Promise<IntentVerdict | null> {
  if (!jevConfigurado()) {
    deps.log.warn('intent-classifier: Jev não configurado — turno cai no fallback do roteador');
    return null;
  }
  {
    try {
      const criteria: Record<string, string> = Object.fromEntries([
        ...input.router.members.map((member) => [
          member.intentName,
          [member.intentDescription, ...member.examples.map((example) => `Exemplo: ${example}`)].join(' '),
        ]),
        ['none', 'Nenhuma intenção configurada se aplica à mensagem.'],
      ]);
      const result = await avaliarComJev(db, {
        organizationId: input.tenantId,
        contactId: input.leadId,
        jobId: input.jobId,
        purpose: 'intent_router',
        state: input.signal,
        questions: {
          intent: choice('Qual intenção configurada descreve melhor a mensagem recebida?', criteria),
        },
      });
      const answer = result.answers.intent;
      return {
        intentName: answer.choice === 'none' ? null : answer.choice,
        confidence: answer.confidence,
      };
    } catch (err) {
      deps.log.warn('intent-classifier: Jev falhou — turno cai no fallback do roteador', {
        error_type: err instanceof Error ? err.name : 'unknown',
      });
      return null;
    }
  }
}
