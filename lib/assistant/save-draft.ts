import "server-only";
import { TOOLS_AGENDAMENTO } from "@/lib/mcp/tools/catalogo/agendamento";
import type { Pool } from "pg";
import { assistantConfigSchema, promptFromConfig, type AssistantConfig } from "./config-schema";
import { versionCreateSchema } from "@/lib/ai/agents/validation";

/** Uma transação: rascunho nunca altera o assistente que está atendendo. */
export async function saveAssistantDraft(pool: Pool, orgId: string, actorId: string, agentId: string | null, config: AssistantConfig) {
  const db = await pool.connect();
  try {
    await db.query("begin");
    await db.query("select id from organizations where id=$1 for update", [orgId]);
    const { rows: agents } = await db.query<{ id: string }>(
      `select id from ai_agents where organization_id=$1 and archived_at is null
       and (($2::uuid is not null and id=$2) or ($2::uuid is null and is_default)) for update`, [orgId, agentId]);
    const agent = agents[0];
    if (!agent) throw new Error("assistant_setup_required");
    const { rows: versions } = await db.query(
      "select * from ai_agent_versions where organization_id=$1 and agent_id=$2 order by version_number desc limit 1", [orgId, agent.id]);
    const previous = versions[0];
    if (!previous) throw new Error("assistant_setup_required");
    // Copia todas as opções do runtime. O wizard só altera o texto estruturado.
    const fields = Object.keys(versionCreateSchema.shape);
    const values: Record<string, unknown> = Object.fromEntries(fields.map(key => [key, previous[key]]));
    values.system_prompt = promptFromConfig(config);
    const agendaTools = new Set<string>(TOOLS_AGENDAMENTO.map(tool => tool.name));
    for (const field of ["tool_ids", "operator_tool_ids"] as const) {
      const selected = (previous[field] ?? []) as string[];
      values[field] = config.can_schedule ? selected : selected.filter(id => !agendaTools.has(id));
    }
    if (config.can_schedule && ![...(values.tool_ids as string[]), ...(values.operator_tool_ids as string[])].some(id => agendaTools.has(id)))
      throw new Error("assistant_calendar_setup_required");
    const version = versionCreateSchema.parse(values);
    const { rows } = await db.query<{ id: string; version_number: number }>(
      `insert into ai_agent_versions (organization_id,agent_id,version_number,created_by,status,
        assistant_config,multimodal_input,video_frames_enabled,${fields.join(",")})
       values ($1,$2,$3,$4,'draft',$5,$6,$7,${fields.map((_,i) => `$${i+8}`).join(",")})
       returning id,version_number`,
      [orgId,agent.id,previous.version_number+1,actorId,JSON.stringify(assistantConfigSchema.parse(config)),
        previous.multimodal_input,previous.video_frames_enabled,
        ...fields.map(key => ["trigger_config","followup"].includes(key)
          ? JSON.stringify(version[key as keyof typeof version]) : version[key as keyof typeof version])]);
    const saved = rows[0];
    if (!saved) throw new Error("assistant_draft_not_saved");
    await db.query("commit");
    return { agent_id: agent.id, version_id: saved.id, version_number: saved.version_number };
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally { db.release(); }
}
