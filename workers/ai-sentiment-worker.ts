/**
 * ai-sentiment-worker — classifies the sentiment of inbound messages.
 *
 * Consumes `message.received` events (parallel to ai-response-worker).
 * Uses `anthropic/claude-haiku-4-5` via Vercel AI Gateway with generateObject
 * and a strict Zod schema so the result is always typed.
 *
 * Design principles (CLAUDE.md):
 * - Service-role admin client bypasses RLS → EVERY query filters `organization_id`
 *   programmatically from the trusted event_log row, never from user input.
 * - Any failure is swallowed (try/catch global) so the bot path in
 *   ai-response-worker keeps running unaffected.
 * - `console.log` is forbidden — only `console.warn`/`console.error` with prefix.
 */

import { score } from "@typesafe-ai/sdk";

import { resolverAgenteDaConversa } from "@/lib/ai/agents/agente-da-conversa";
import { decidirElegibilidadeDaConversaViaSupabase } from "@/lib/ai/elegibilidade/consulta-supabase";
import { ttlDaAutorizacaoMs } from "@/lib/ai/elegibilidade/gate";
import type { EventRow } from "@/lib/event-log/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestPool } from "@/lib/agent-engine/db/request-pool";
import { avaliarComJev, jevConfigurado } from "@/lib/ai/system-one/client";

const DEFAULT_SENTIMENT_THRESHOLD = 0.3;

export interface SentimentResult {
  skipped: boolean;
  reason?: string;
  sentiment_score?: number;
}

export async function processSentiment(event: EventRow): Promise<SentimentResult> {
  try {
    if (!jevConfigurado()) {
      return { skipped: true, reason: "typesafe_key_missing" };
    }

    const messageId =
      (event.payload?.["message_id"] as string | undefined) ?? event.entity_id ?? null;
    const conversationId = (event.payload?.["conversation_id"] as string | undefined) ?? null;
    if (!messageId) {
      return { skipped: true, reason: "missing_message_id" };
    }

    const admin = createAdminClient();

    // ── Load message (programmatic org filter) ────────────────────────────
    const { data: message, error: msgErr } = await admin
      .from("messages")
      .select("id, body, direction, conversation_id, organization_id, metadata")
      .eq("id", messageId)
      .eq("organization_id", event.organization_id)
      .maybeSingle();

    if (msgErr || !message) {
      return { skipped: true, reason: "message_not_found" };
    }

    // ── Guard: inbound only ───────────────────────────────────────────────
    if (message.direction !== "inbound") {
      return { skipped: true, reason: "not_inbound" };
    }

    // ── Guard: non-empty body ─────────────────────────────────────────────
    const body = (message.body ?? "").trim();
    if (!body) {
      return { skipped: true, reason: "empty_body" };
    }

    // ── Guard: elegibilidade da IA ────────────────────────────────────────
    // O único efeito deste worker é alimentar o handoff por sentimento
    // (`ai.sentiment_alert` → `triggerHandoff`). Numa conversa que o gate
    // `allowlist` barra, `triggerHandoff` já se recusa — então classificar aqui
    // seria só queimar um Haiku à toa. Pula cedo. `open` (o default) segue.
    // Fail-closed: erro de leitura → pula (sem custo, sem efeito).
    const convIdParaGate = conversationId ?? (message.conversation_id as string | null);
    if (convIdParaGate) {
      try {
        const elegib = await decidirElegibilidadeDaConversaViaSupabase(admin, {
          organizationId: event.organization_id,
          conversationId: convIdParaGate,
          agora: new Date(),
          ttlMs: ttlDaAutorizacaoMs(process.env),
        });
        if (elegib !== null && elegib.bloqueioPorAllowlist) {
          return { skipped: true, reason: "nao_elegivel_para_ia" };
        }
      } catch {
        return { skipped: true, reason: "elegibilidade_indeterminada" };
      }
    }

    // ── Qual agente atende ESTA conversa? ─────────────────────────────────
    //
    // Antes, a resposta era "o primeiro da organização que atende", ordenado por
    // `is_default` e depois `created_at` — e a conversa que disparou o evento não
    // entrava na consulta em lugar nenhum. Com um agente só, certo por acidente.
    // Com dois, o limiar em vigor passava a depender da ORDEM DE CRIAÇÃO: numa
    // clínica, cliente triste é sinal de problema; numa assistência técnica, é o
    // cliente normal. O mesmo limiar erra nos dois sentidos, e quem configurou o
    // campo do agente B ficava vendo o comportamento do agente A sem pista
    // nenhuma na tela — os dois campos existem, os dois aceitam valor, e um
    // deles não fazia nada. (issue #486)
    const { data: conversa } = await admin
      .from("conversations")
      .select("id, channel_session_id, active_ai_agent_id")
      .eq("id", message.conversation_id)
      .eq("organization_id", event.organization_id)
      .maybeSingle();

    // As versões PUBLICADAS ligadas ao número em que a conversa acontece — é
    // quem de fato responde ao cliente por aquela sessão. `null` (não consegui
    // consultar) e `[]` (consultei, não há) levam ao mesmo desfecho na régua,
    // mas quem lê o log precisa distinguir os dois.
    let versoesPublicadasNaSessao: string[] | null = null;
    if (conversa?.channel_session_id) {
      const { data: versoes } = await admin
        .from("ai_agent_versions")
        .select("id, channel_session_id, status")
        .eq("organization_id", event.organization_id)
        .eq("channel_session_id", conversa.channel_session_id)
        .eq("status", "published");
      versoesPublicadasNaSessao = (versoes ?? []).map((v) => v.id as string);
    }

    const { data: candidatos } = await admin
      .from("ai_agents")
      .select(
        "id, config, kind, is_active, paused_at, published_version_id, archived_at, priority, created_at",
      )
      .eq("organization_id", event.organization_id)
      .is("archived_at", null);

    const { agente: agent, motivo: motivoDoAgente } = resolverAgenteDaConversa(
      candidatos ?? [],
      conversa
        ? {
            active_ai_agent_id: conversa.active_ai_agent_id as string | null,
            versoesPublicadasNaSessao,
          }
        : null,
    );

    // Sem agente resolvido, o padrão do PRODUTO — nunca o limiar do vizinho.
    // Chutar a configuração de outro agente é o defeito de novo, agora com cara
    // de configuração deliberada.
    const agentConfig = (agent?.config as Record<string, unknown> | null) ?? {};
    const threshold =
      typeof agentConfig["sentiment_threshold"] === "number"
        ? agentConfig["sentiment_threshold"]
        : DEFAULT_SENTIMENT_THRESHOLD;

    // ── Julgamento estruturado (Jev) ──────────────────────────────────────
    const start = Date.now();
    const judged = await avaliarComJev(getRequestPool(), {
          organizationId: event.organization_id,
          agentId: agent?.id ?? null,
          purpose: "sentiment_classify",
          state: body,
          questions: {
            sentiment: score(
              "Qual é o sentimento expresso pelo cliente nesta mensagem?",
              [
                "Muito negativo: irritação, hostilidade ou frustração intensa.",
                "Negativo: insatisfação ou preocupação clara.",
                "Neutro: sem emoção positiva ou negativa dominante.",
                "Positivo: satisfação, interesse ou cordialidade.",
                "Muito positivo: entusiasmo, gratidão ou forte satisfação.",
              ],
            ),
          },
        });
    if (judged.answers.sentiment.confidence < 0.6) {
      return { skipped: true, reason: "typesafe_low_confidence" };
    }
    const result = { sentiment_score: judged.answers.sentiment.score / 4 };

    const latencyMs = Date.now() - start;

    // ── Merge sentiment into messages.metadata ────────────────────────────
    const existingMetadata = (message.metadata as Record<string, unknown> | null) ?? {};
    const updatedMetadata = {
      ...existingMetadata,
      sentiment_score: result.sentiment_score,
      sentiment_latency_ms: latencyMs,
    };

    const { error: updateErr } = await admin
      .from("messages")
      .update({ metadata: updatedMetadata })
      .eq("id", messageId)
      .eq("organization_id", event.organization_id);

    if (updateErr) {
      console.warn("[ai-sentiment-worker] metadata update failed", {
        message_id: messageId,
        error: updateErr.message,
      });
    }

    // ── Emit alert if below threshold ────────────────────────────────────
    if (result.sentiment_score < threshold) {
      const { error: emitErr } = await admin.rpc(
        "emit_event" as never,
        {
          p_event_type: "ai.sentiment_alert",
          p_entity_kind: "message",
          p_entity_id: messageId,
          p_payload: {
            message_id: messageId,
            conversation_id: conversationId ?? message.conversation_id ?? null,
            sentiment_score: result.sentiment_score,
          },
          // `agent_id` e `motivo` viajam com o alerta porque o limiar é o número
          // que decidiu emiti-lo: sem eles, "por que este alerta saiu?" recomeça
          // do zero, e foi essa ausência que deixou o defeito da #486 invisível
          // pela tela — os dois campos existiam e um não fazia nada.
          p_metadata: {
            source: "ai-sentiment-worker",
            threshold,
            agent_id: agent?.id ?? null,
            agente_resolvido_por: motivoDoAgente,
          },
          p_organization_id: event.organization_id,
        } as never,
      );

      if (emitErr) {
        console.warn("[ai-sentiment-worker] ai.sentiment_alert emit failed", {
          message_id: messageId,
          error: emitErr.message,
        });
      }
    }

    return { skipped: false, sentiment_score: result.sentiment_score };
  } catch (err) {
    // Global catch: NEVER throw — must not break the bot path.
    console.warn("[ai-sentiment-worker] sentiment_classify_failed", {
      event_id: event.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { skipped: true, reason: "classify_failed" };
  }
}
