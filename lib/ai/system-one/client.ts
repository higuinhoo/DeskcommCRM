import {
  TypeSafeClient,
  type EntryType,
  type Questions,
  type SystemOneResult,
} from "@typesafe-ai/sdk";
import type pg from "pg";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const TYPESAFE_PROVIDER = "typesafe";

export function jevConfigurado(): boolean {
  return (env.TYPESAFE_API_KEY ?? "").trim() !== "";
}

export interface AvaliarComJevInput<Q extends Questions> {
  organizationId: string;
  agentId?: string | null;
  contactId?: string | null;
  jobId?: string | null;
  purpose: string;
  state: EntryType;
  questions: Q;
}

/**
 * Executa um julgamento tipado no Jev e mantém a mesma trilha de telemetria das
 * chamadas generativas. O estado e as respostas nunca entram em log.
 */
export async function avaliarComJev<const Q extends Questions>(
  db: pg.Pool,
  input: AvaliarComJevInput<Q>,
): Promise<SystemOneResult<Q>> {
  if (!jevConfigurado()) throw new Error("typesafe_not_configured");

  const startedAt = Date.now();
  const client = new TypeSafeClient({
    apiKey: env.TYPESAFE_API_KEY,
    defaultModel: env.TYPESAFE_MODEL,
    logLevel: "off",
    timeout: 15_000,
  });

  try {
    const result = await client.systemOne({
      model: env.TYPESAFE_MODEL,
      state: input.state,
      questions: input.questions,
    });
    await registrarSemBloquear(db, input, {
      model: result.model,
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      latencyMs: Date.now() - startedAt,
      status: "ok",
    });
    return result;
  } catch (error) {
    await registrarSemBloquear(db, input, {
      model: env.TYPESAFE_MODEL,
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startedAt,
      status: "erro",
      errorMessage: error instanceof Error ? error.name : "typesafe_request_failed",
    });
    throw error;
  }
}

async function registrarSemBloquear<Q extends Questions>(
  db: pg.Pool,
  input: AvaliarComJevInput<Q>,
  result: Parameters<typeof registrarChamada<Q>>[2],
): Promise<void> {
  try {
    await registrarChamada(db, input, result);
  } catch {
    // Observabilidade degradada não pode interromper nem mascarar o atendimento.
    logger.warn("typesafe_telemetry_failed", {
      organization_id: input.organizationId,
      purpose: input.purpose,
      status: result.status,
    });
  }
}

async function registrarChamada<Q extends Questions>(
  db: pg.Pool,
  input: AvaliarComJevInput<Q>,
  result: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    status: "ok" | "erro";
    errorMessage?: string;
  },
): Promise<void> {
  await db.query(
    `insert into llm_calls
       (organization_id,agent_id,contact_id,job_id,purpose,provider,model,input_tokens,output_tokens,
        cost_cents,latency_ms,status,error_code,error_message)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,null,$10,$11,$12,$13)`,
    [
      input.organizationId,
      input.agentId ?? null,
      input.contactId ?? null,
      input.jobId ?? null,
      input.purpose,
      TYPESAFE_PROVIDER,
      result.model,
      result.inputTokens,
      result.outputTokens,
      result.latencyMs,
      result.status,
      result.status === "erro" ? "typesafe_unavailable" : null,
      result.errorMessage?.slice(0, 500) ?? null,
    ],
  );
}
