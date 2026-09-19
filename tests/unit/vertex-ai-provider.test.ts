import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultRegistry, VERTEX_ENDPOINT } from "@/lib/agent-engine/edge/llm/providers";
import { validateVertexKey } from "@/lib/ai/provider-validators";
import { PROVEDOR_POR_ID } from "@/lib/ai/pontos/provedores";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google Cloud Vertex AI", () => {
  it("aparece como provider próprio e explica que a chave é do modo Express", () => {
    const provider = PROVEDOR_POR_ID.get("vertex");
    expect(provider?.rotulo).toMatch(/Vertex AI/);
    expect(provider?.quandoUsar).toMatch(/modo Express/i);
    expect(provider?.ondePegarAChave).toMatch(/^https:\/\/console\.cloud\.google\.com\/vertex-ai/);
  });

  it("o registry cria um modelo Vertex e contém o egress no endpoint da Google Cloud", () => {
    const model = createDefaultRegistry().vertex?.("AIza-teste", "gemini-3.5-flash");
    expect(model).toBeDefined();
    expect(VERTEX_ENDPOINT).toBe("https://aiplatform.googleapis.com");
  });

  it("valida a API key no header, nunca na URL", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ candidates: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await validateVertexKey("segredo-vertex");

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).not.toContain("segredo-vertex");
    expect(String(url)).toContain("aiplatform.googleapis.com");
    expect((init as RequestInit).headers).toMatchObject({ "x-goog-api-key": "segredo-vertex" });
    if (result.ok) expect(result.models).toContain("gemini-3.5-flash");
  });

  it("recusa uma chave que a Vertex responde como não autorizada", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Promise.resolve(new Response(null, { status: 403 })),
      ),
    );
    await expect(validateVertexKey("invalida")).resolves.toEqual({
      ok: false,
      error: "auth_failed_401",
    });
  });
});
