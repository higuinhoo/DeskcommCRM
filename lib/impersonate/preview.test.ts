import { describe, expect, it } from "vitest";
import { applyPreview, previewContextSchema } from "./preview";
import { productSchema, moduleDecision, type CapabilityContext } from "@/lib/product/capabilities";
const context: CapabilityContext = { organizationId: "org", role: "admin", isPlatformAdmin: true,
  plan: "self_hosted", product: productSchema.parse({ enabled: true, profile: "assistant_agenda" }) };
describe("preview restritivo", () => {
  it("não concede vendas simulando perfil completo", () => {
    const result = applyPreview(context, previewContextSchema.parse({ profile: "sales" }));
    expect(moduleDecision("sales", result).allowed).toBe(false);
    expect(moduleDecision("calendar", result).allowed).toBe(true);
    expect(result.isPlatformAdmin).toBe(false);
  });
  it("restringe perfil mesmo quando a liberação real está desligada", () => {
    const result = applyPreview({ ...context, product: productSchema.parse({}) }, previewContextSchema.parse({ profile: "essential" }));
    expect(moduleDecision("calendar", result).allowed).toBe(false);
    expect(moduleDecision("inbox", result).allowed).toBe(true);
  });
  it("não eleva papel e aplica complexidade", () => {
    const result = applyPreview({ ...context, role: "viewer" }, previewContextSchema.parse({ role: "admin", interface_mode: "simple" }));
    expect(result.role).toBe("viewer");
    expect(result.product.interface_mode).toBe("simple");
  });
  it("não aceita transformar organização real em laboratório pelo payload", () => {
    expect(previewContextSchema.safeParse({ is_lab: true }).success).toBe(false);
  });
  it("preserva contexto sem preview", () => expect(applyPreview(context, null)).toBe(context));
});
