import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();

const JULGAMENTOS = [
  "lib/agent-engine/agent/intent-classifier.ts",
  "lib/agent-engine/agent/stage-classifier.ts",
  "lib/agent-engine/agent/followup-flow-classify.ts",
  "lib/agent-engine/guardrails/jailbreak/classifier.ts",
  "lib/agent-engine/guardrails/promise/semantic.ts",
  "workers/ai-sentiment-worker.ts",
];

describe("separação Jev × LLM", () => {
  it.each(JULGAMENTOS)("%s não chama modelo generativo", (arquivo) => {
    const fonte = readFileSync(join(RAIZ, arquivo), "utf8");
    expect(fonte).not.toMatch(/\bgenerate(?:Object|Text)\s*\(/);
    expect(fonte).not.toMatch(/\brunModelCall\s*\(/);
    expect(fonte).toContain("avaliarComJev");
  });

  it("o juiz do flywheel usa Jev e só o distiller textual usa LLM", () => {
    const fonte = readFileSync(join(RAIZ, "lib/agent-engine/flywheel/live.ts"), "utf8");
    expect(fonte).toContain("purpose: 'flywheel_judge'");
    expect(fonte).toContain("avaliarComJev(pool");
    expect(fonte).toContain("purpose: 'flywheel_distiller'");
    expect(fonte.match(/runModelCall\s*\(/g)).toHaveLength(1);
  });
});
