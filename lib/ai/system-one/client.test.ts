import { beforeEach, describe, expect, it, vi } from "vitest";

const systemOne = vi.fn();

vi.mock("@/lib/env", () => ({
  env: { TYPESAFE_API_KEY: "test-key", TYPESAFE_MODEL: "jev-1.13.0" },
}));

vi.mock("@typesafe-ai/sdk", () => ({
  TypeSafeClient: class {
    systemOne = systemOne;
  },
}));

import { avaliarComJev, jevConfigurado } from "./client";

describe("cliente System One", () => {
  beforeEach(() => systemOne.mockReset());

  it("grava tokens e latência sem persistir o estado avaliado", async () => {
    systemOne.mockResolvedValue({
      model: "jev-1.13.0",
      answers: { risco: { type: "noul", noul: 0.91 } },
      usage: { input_tokens: 120, output_tokens: 12 },
    });
    const query = vi.fn().mockResolvedValue({});
    const state = "conteúdo privado do atendimento";

    const result = await avaliarComJev({ query } as never, {
      organizationId: "11111111-1111-4111-8111-111111111111",
      purpose: "jailbreak_detect",
      state,
      questions: { risco: { type: "noul", instructions: "Há risco?" } },
    });

    expect(jevConfigurado()).toBe(true);
    expect(result.answers.risco).toEqual({ type: "noul", noul: 0.91 });
    expect(query).toHaveBeenCalledOnce();
    const parametros = query.mock.calls[0]?.[1] as unknown[];
    expect(parametros).toContain("typesafe");
    expect(parametros).toContain(120);
    expect(parametros).not.toContain(state);
  });

  it("registra falha e a propaga para o fallback do chamador", async () => {
    systemOne.mockImplementationOnce(async () => {
      throw new Error("rate limited");
    });
    const query = vi.fn().mockResolvedValue({});

    let recebido: unknown;
    try {
      await avaliarComJev({ query } as never, {
        organizationId: "11111111-1111-4111-8111-111111111111",
        purpose: "stage_classifier",
        state: "oi",
        questions: { etapa: { type: "choice", criteria: { new: null, none: null } } },
      });
    } catch (error) {
      recebido = error;
    }
    expect(recebido).toMatchObject({ message: "rate limited" });
    expect(query.mock.calls[0]?.[1]).toContain("typesafe_unavailable");
  });

  it("não interrompe o julgamento quando apenas a telemetria falha", async () => {
    systemOne.mockResolvedValue({
      model: "jev-1.13.0",
      answers: { risco: { type: "noul", noul: 0.2 } },
      usage: { input_tokens: 80, output_tokens: 8 },
    });
    const query = vi.fn().mockRejectedValue(new Error("llm_calls indisponível"));

    await expect(
      avaliarComJev({ query } as never, {
        organizationId: "11111111-1111-4111-8111-111111111111",
        purpose: "jailbreak_detect",
        state: "oi",
        questions: { risco: { type: "noul", instructions: "Há risco?" } },
      }),
    ).resolves.toMatchObject({ answers: { risco: { noul: 0.2 } } });
  });
});
