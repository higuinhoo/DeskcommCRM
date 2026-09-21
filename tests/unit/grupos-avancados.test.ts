import { describe, expect, it } from "vitest";
import { TOOL_CATALOG } from "@/lib/mcp/tools/catalog";
import {
  GRUPOS_AVANCADOS,
  classificarToolNoGrupo,
  grupoMeta,
} from "@/lib/mcp/tools/grupos-avancados";

describe("agrupamento temático de capacidades do agente", () => {
  it("contém os 9 grupos declarados em ordem", () => {
    expect(GRUPOS_AVANCADOS.length).toBe(9);
    expect(GRUPOS_AVANCADOS[0]?.id).toBe("agendamento");
  });

  it("todas as capacidades de agendamento são classificadas como 'agendamento'", () => {
    const toolsAgendamento = [
      "crm_list_event_types",
      "crm_find_free_slots",
      "crm_list_appointments",
      "crm_find_and_book_appointment",
      "crm_book_appointment",
      "crm_reschedule_appointment",
      "crm_confirm_appointment",
      "crm_set_appointment_outcome",
      "crm_cancel_appointment",
    ];

    for (const tool of toolsAgendamento) {
      expect(classificarToolNoGrupo(tool)).toBe("agendamento");
    }
  });

  it("classifica cada tool do TOOL_CATALOG em um grupo válido", () => {
    const gruposValidos = new Set(GRUPOS_AVANCADOS.map((g) => g.id));
    for (const tool of TOOL_CATALOG) {
      const grupo = classificarToolNoGrupo(tool.name, tool.oQueToca);
      expect(gruposValidos.has(grupo)).toBe(true);
    }
  });

  it("retorna metadados válidos para cada grupo", () => {
    const agendamento = grupoMeta("agendamento");
    expect(agendamento.rotulo).toContain("Agendamento");
    expect(agendamento.emoji).toBe("📅");
  });
});
