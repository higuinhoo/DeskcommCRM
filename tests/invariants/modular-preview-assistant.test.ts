import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sql } from "./gov-helpers";
describe("simulação e assistente guiado", () => {
  it("bloqueia escrita, callback, laboratório falso e sessão alheia", () => {
    expect(sql(readFileSync(join(process.cwd(),"tests/fixtures/modular/preview-security.sql"),"utf8"))).toContain("preview_context_security_verified");
  });
  it("exige teste, preserva rascunho e publica autonomia atomicamente", () => {
    expect(sql(readFileSync(join(process.cwd(),"tests/fixtures/modular/assistant-version.sql"),"utf8"))).toContain("assistant_version_verified");
  });
});
