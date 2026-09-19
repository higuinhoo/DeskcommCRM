import { describe, it, expect, vi } from "vitest";
import type { Pool } from "pg";
import { saveAssistantDraft } from "./save-draft";
import { assistantConfigSchema } from "./config-schema";
import { versionCreateSchema } from "@/lib/ai/agents/validation";
const previous = { ...versionCreateSchema.parse({ system_prompt: "Prompt anterior", provider: "openai", model: "modelo-existente", credential_id: null,
  channel_session_id: "00000000-0000-4000-8000-000000000001", pipeline_ids: ["00000000-0000-4000-8000-000000000002"] }), version_number: 7, multimodal_input: true, video_frames_enabled: false };
function pool(insertFails = false) {
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith("select id from ai_agents")) return { rows: [{ id: "agent" }] };
    if (sql.startsWith("select * from ai_agent_versions")) return { rows: [previous] };
    if (sql.startsWith("insert into ai_agent_versions")) {
      if (insertFails) throw new Error("database unavailable");
      return { rows: [{ id: "version", version_number: 8 }] };
    }
    return { rows: [] };
  });
  const release = vi.fn();
  return { query, release, db: { connect: async () => ({ query, release }) } as unknown as Pool };
}
describe("rascunho guiado", () => {
  it("preserva canal e modelo e não altera o runtime publicado", async () => {
    const fixture = pool();
    const result = await saveAssistantDraft(fixture.db, "org", "actor", "agent", assistantConfigSchema.parse({}));
    expect(result).toEqual({ agent_id: "agent", version_id: "version", version_number: 8 });
    const calls = fixture.query.mock.calls as unknown as [string, unknown[]][];
    const insert = calls.find(([sql]) => sql.startsWith("insert into ai_agent_versions"));
    expect(insert?.[1]).toContain("modelo-existente");
    expect(insert?.[1]).toContain(previous.channel_session_id);
    expect(calls.some(([sql]) => sql.startsWith("update ai_agents"))).toBe(false);
    expect(calls.at(-1)?.[0]).toBe("commit");
    expect(fixture.release).toHaveBeenCalledOnce();
  });
  it("falha sem sucesso fictício e desfaz gravações parciais", async () => {
    const fixture = pool(true);
    await expect(saveAssistantDraft(fixture.db,"org","actor","agent",assistantConfigSchema.parse({}))).rejects.toThrow("database unavailable");
    expect(fixture.query).toHaveBeenLastCalledWith("rollback");
    expect(fixture.release).toHaveBeenCalledOnce();
  });
  it("não promete agendamento sem capacidade configurada", async () => {
    const fixture = pool();
    await expect(saveAssistantDraft(fixture.db,"org","actor","agent",assistantConfigSchema.parse({ can_schedule: true }))).rejects.toThrow("assistant_calendar_setup_required");
    expect(fixture.query).toHaveBeenLastCalledWith("rollback");
  });
});
