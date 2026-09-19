import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantWizard } from "./_wizard";
import { assistantConfigSchema } from "@/lib/assistant/config-schema";
const props = { agentId: "agent", initialVersionId: null, history: [], isActive: true,
  savedConfig: assistantConfigSchema.parse({}), publishedVersionNumber: 1, publishedAt: null };
afterEach(() => vi.unstubAllGlobals());
describe("jornada guiada", () => {
  it("testa e publica o UUID salvo com os contratos das rotas existentes", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { agent_id: "agent", version_id: "version-8" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { status: "ok", final_text: "Olá! Como posso ajudar?" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { version_id: "version-8" } }) });
    vi.stubGlobal("fetch", fetch);
    render(<AssistantWizard {...props} />);
    expect(screen.getByRole("button", { name: "3. Publicar" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar rascunho" }));
    const input = await screen.findByLabelText("Mensagem de teste");
    fireEvent.change(input, { target: { value: "Olá" } });
    expect(screen.getByRole("button", { name: "Continuar para publicar →" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Testar agora" }));
    fireEvent.click(await screen.findByRole("button", { name: "Publicar assistente" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(fetch.mock.calls[1]?.[0]).toBe("/api/v1/ai/agents/agent/versions/version-8/test");
    expect(JSON.parse(fetch.mock.calls[1]?.[1].body)).toEqual({ sample_message: "Olá" });
    expect(fetch.mock.calls[2]?.[0]).toBe("/api/v1/ai/agents/agent/publish");
    expect(JSON.parse(fetch.mock.calls[2]?.[1].body)).toEqual({ version_id: "version-8" });
  });
  it("resposta bloqueada não libera publicação", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { status: "blocked", final_text: "" } }) }));
    render(<AssistantWizard {...props} initialVersionId="draft" />);
    fireEvent.click(screen.getByRole("button", { name: "2. Testar" }));
    fireEvent.change(screen.getByLabelText("Mensagem de teste"), { target: { value: "teste" } });
    fireEvent.click(screen.getByRole("button", { name: "Testar agora" }));
    await screen.findByText("O teste não produziu uma resposta. Revise a configuração antes de publicar.");
    expect(screen.getByRole("button", { name: "3. Publicar" })).toBeDisabled();
  });
});
