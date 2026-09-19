import { describe, it, expect } from "vitest";
import {
  assistantConfigSchema, promptFromConfig, BUSINESS_TEMPLATES,
  BUSINESS_TYPES, TONES, AUTONOMY_LEVELS,
} from "./config-schema";

describe("assistantConfigSchema", () => {
  it("parseia configuração vazia com defaults", () => {
    const config = assistantConfigSchema.parse({});
    expect(config.assistant_name).toBe("Assistente");
    expect(config.tone).toBe("professional");
    expect(config.autonomy).toBe("hybrid");
    expect(config.can_schedule).toBe(false);
  });

  it("rejeita tom desconhecido", () => {
    expect(assistantConfigSchema.safeParse({ tone: "angry" }).success).toBe(false);
  });

  it("todos os tipos de negócio têm templates", () => {
    for (const type of BUSINESS_TYPES) {
      expect(BUSINESS_TEMPLATES[type]).toBeDefined();
    }
  });
});

describe("promptFromConfig", () => {
  it("inclui nome do assistente", () => {
    const config = assistantConfigSchema.parse({ assistant_name: "Dra. Sofia" });
    expect(promptFromConfig(config)).toContain("Dra. Sofia");
  });

  it("não inclui termos técnicos desnecessários", () => {
    const config = assistantConfigSchema.parse({});
    const prompt = promptFromConfig(config);
    expect(prompt).not.toContain("system_prompt");
    expect(prompt).not.toContain("temperature");
    expect(prompt).not.toContain("token");
  });

  it("instrução de autonomia corresponde ao nível configurado", () => {
    const suggest = assistantConfigSchema.parse({ autonomy: "suggest_only" });
    expect(promptFromConfig(suggest)).toContain("sugestão");
    const automatic = assistantConfigSchema.parse({ autonomy: "automatic" });
    expect(promptFromConfig(automatic)).toContain("automaticamente");
    const hybrid = assistantConfigSchema.parse({ autonomy: "hybrid" });
    expect(promptFromConfig(hybrid)).toContain("rotineiros");
  });

  it("não usa emojis quando use_emojis=false", () => {
    const config = assistantConfigSchema.parse({ use_emojis: false });
    expect(promptFromConfig(config)).toContain("Não use emojis");
  });

  it("inclui assuntos proibidos quando configurado", () => {
    const config = assistantConfigSchema.parse({ forbidden_topics: "Diagnósticos médicos" });
    const prompt = promptFromConfig(config);
    expect(prompt).toContain("Diagnósticos médicos");
    expect(prompt).toContain("NÃO deve responder");
  });

  it("template de clínica inclui can_schedule=true", () => {
    const config = assistantConfigSchema.parse({ ...BUSINESS_TEMPLATES.clinic });
    expect(config.can_schedule).toBe(true);
    expect(promptFromConfig(config)).toContain("agendamentos");
  });
});
