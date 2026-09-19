import { describe, expect, it } from "vitest";
import {
  productSchema,
  flagSchema,
  moduleDecision,
  operationDecision,
  featureDecision,
  moduleForPath,
  rolloutBucket,
  type CapabilityContext,
} from "./capabilities";
const base: CapabilityContext = {
  organizationId: "00000000-0000-4000-8000-000000000001",
  role: "admin",
  isPlatformAdmin: false,
  plan: "standard",
  product: productSchema.parse({
    enabled: true,
    profile: "assistant_agenda",
    interface_mode: "simple",
  }),
};
describe("capacidades de produto", () => {
  it("preserva instalação existente com liberação desligada", () =>
    expect(moduleDecision("sales", { ...base, product: productSchema.parse({}) }).allowed).toBe(
      true,
    ));
  it("não confunde administrador com perfil comercial", () => {
    expect(moduleDecision("sales", base).allowed).toBe(false);
    expect(moduleDecision("calendar", base).allowed).toBe(true);
  });
  it("não ignora plano, nem com módulo explícito e platform admin", () =>
    expect(
      moduleDecision("sales", {
        ...base,
        isPlatformAdmin: true,
        planModules: ["inbox"],
        product: productSchema.parse({ enabled: true, profile: "sales", modules: { sales: true } }),
      }).source,
    ).toBe("plan"));
  it("não permite papel viewer escrever com módulo habilitado", () =>
    expect(operationDecision("calendar", "agent", { ...base, role: "viewer" }).source).toBe(
      "role",
    ));
  it("um override não eleva capacidades", () =>
    expect(
      moduleDecision("sales", {
        ...base,
        override: { expiresAt: 100, modules: { sales: true } },
        now: 1,
      }).allowed,
    ).toBe(false));
  it("ignora restrição temporária vencida", () =>
    expect(
      moduleDecision("calendar", {
        ...base,
        override: { expiresAt: 100, modules: { calendar: false } },
        now: 101,
      }).allowed,
    ).toBe(true));
  it("desativação da organização vence perfil", () =>
    expect(
      moduleDecision("calendar", {
        ...base,
        product: productSchema.parse({
          enabled: true,
          profile: "sales",
          modules: { calendar: false },
        }),
      }).source,
    ).toBe("organization"));
  it("percentual zero e cem têm fronteiras corretas", () => {
    expect(
      featureDecision(flagSchema.parse({ key: "x", enabled: true, percentage: 0 }), base).allowed,
    ).toBe(false);
    expect(
      featureDecision(flagSchema.parse({ key: "x", enabled: true, percentage: 100 }), base).allowed,
    ).toBe(true);
    expect(rolloutBucket(base.organizationId, "x")).toBe(rolloutBucket(base.organizationId, "x"));
  });
  it("experimento exige adesão", () =>
    expect(
      featureDecision(flagSchema.parse({ key: "x", enabled: true, experimental: true }), base)
        .allowed,
    ).toBe(false));
  it("flag administrativa não permite usuário comum", () =>
    expect(
      featureDecision(flagSchema.parse({ key: "x", enabled: true, platform_only: true }), base)
        .allowed,
    ).toBe(false));
  it("classifica página e API com a mesma regra", () => {
    expect(moduleForPath("/app/ai/knowledge/sources")).toBe("knowledge");
    expect(moduleForPath("/api/v1/ai/knowledge/sources")).toBe("knowledge");
    expect(moduleForPath("/app/ai-other")).toBeNull();
  });
  it("recusa perfil e módulo desconhecidos", () => {
    expect(productSchema.safeParse({ profile: "admin" }).success).toBe(false);
    expect(productSchema.safeParse({ modules: { unknown: true } }).success).toBe(false);
  });
});
