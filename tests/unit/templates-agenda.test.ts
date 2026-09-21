import { describe, expect, it } from "vitest";
import { BUSINESS_TEMPLATES, TEMPLATE_KEYS, getTemplate } from "@/lib/templates/business-templates";

describe("templates de negócio com suporte à agenda", () => {
  it("todos os templates possuem configurações e vocabulário de agenda", () => {
    for (const key of TEMPLATE_KEYS) {
      const tpl = BUSINESS_TEMPLATES[key];
      expect(tpl.vocabulary.appointment_singular).toBeTruthy();
      expect(tpl.vocabulary.appointment_plural).toBeTruthy();
      expect(tpl.vocabulary.new_appointment_button).toBeTruthy();
      expect(tpl.vocabulary.calendar_title).toBeTruthy();
      expect(tpl.vocabulary.calendar_subtitle).toBeTruthy();
      expect(tpl.defaultEventTypes.length).toBeGreaterThan(0);
    }
  });

  it("clínica define termos de consulta e avaliação", () => {
    const clinica = getTemplate("clinica");
    expect(clinica.vocabulary.appointment_singular).toBe("Consulta");
    expect(clinica.vocabulary.appointment_plural).toBe("Consultas");
    expect(clinica.vocabulary.new_appointment_button).toBe("Nova consulta");
    expect(clinica.defaultEventTypes.some((e) => e.category === "consulta")).toBe(true);
    expect(clinica.defaultEventTypes.some((e) => e.category === "retorno")).toBe(true);
  });

  it("barbearia define termos de corte e horário", () => {
    const barbearia = getTemplate("barbearia");
    expect(barbearia.vocabulary.appointment_singular).toBe("Horário");
    expect(barbearia.vocabulary.new_appointment_button).toBe("Novo horário");
    expect(barbearia.defaultEventTypes.some((e) => e.name.includes("Corte"))).toBe(true);
  });

  it("imobiliária define termos de visita", () => {
    const imobiliaria = getTemplate("imobiliaria");
    expect(imobiliaria.vocabulary.appointment_singular).toBe("Visita");
    expect(imobiliaria.vocabulary.new_appointment_button).toBe("Agendar visita");
    expect(imobiliaria.defaultEventTypes.some((e) => e.category === "visita")).toBe(true);
  });
});
