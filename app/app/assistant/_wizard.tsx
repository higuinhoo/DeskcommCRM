"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  assistantConfigSchema,
  BUSINESS_TEMPLATES, BUSINESS_TYPE_LABELS, TONE_LABELS, AUTONOMY_LABELS,
  BUSINESS_TYPES, TONES, AUTONOMY_LEVELS, RESPONSE_LENGTH,
  type AssistantConfig, type BusinessType,
} from "@/lib/assistant/config-schema";

interface Props {
  agentId: string | null;
  initialVersionId: string | null;
  history: { id: string; version_number: number; config: AssistantConfig }[];
  isActive: boolean;
  savedConfig: unknown;
  publishedVersionNumber: number | null;
  publishedAt: string | null;
}

const LENGTH_LABELS = { short: "Curtas", medium: "Equilibradas", long: "Detalhadas" };

function defaultConfig(): AssistantConfig {
  return assistantConfigSchema.parse({});
}

function loadConfig(raw: unknown): AssistantConfig {
  const parsed = assistantConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultConfig();
}

export function AssistantWizard({ agentId: initialAgentId, initialVersionId, history, isActive, savedConfig, publishedVersionNumber, publishedAt }: Props) {
  const [localAgentId, setLocalAgentId] = useState<string | null>(initialAgentId);
  const [config, setConfig] = useState<AssistantConfig>(() => loadConfig(savedConfig));
  const [versionId, setVersionId] = useState<string | null>(initialVersionId);
  const [testedVersionId, setTestedVersionId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [step, setStep] = useState<"config" | "test" | "publish">("config");
  const [testInput, setTestInput] = useState("");
  const [testResponse, setTestResponse] = useState("");

  function applyTemplate(type: BusinessType) {
    const template = BUSINESS_TEMPLATES[type];
    setVersionId(null); setTestedVersionId(null);
    setConfig(c => ({ ...c, ...template, business_type: type }));
  }

  function patch<K extends keyof AssistantConfig>(key: K, value: AssistantConfig[K]) {
    setVersionId(null); setTestedVersionId(null);
    setConfig(c => ({ ...c, [key]: value }));
  }

  async function saveDraft() {
    setBusy(true); setMessage("");
    try {
      const res = await fetch(`/api/v1/ai/assistant/save`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agent_id: localAgentId, assistant_config: config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Não foi possível salvar.");
      if (data.data?.agent_id) setLocalAgentId(data.data.agent_id);
      setVersionId(data.data.version_id);
      setTestedVersionId(null);
      setMessage("Rascunho salvo. Teste antes de publicar.");
      setStep("test");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro inesperado.");
    } finally { setBusy(false); }
  }

  async function testAssistant() {
    if (!localAgentId || !versionId || !testInput.trim()) return;
    setBusy(true); setTestResponse("");
    try {
      const res = await fetch(`/api/v1/ai/agents/${localAgentId}/versions/${versionId}/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sample_message: testInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Não foi possível testar.");
      if (data.data?.status !== "ok" || !data.data?.final_text) throw new Error("O teste não produziu uma resposta. Revise a configuração antes de publicar.");
      setTestResponse(data.data.final_text);
      setTestedVersionId(versionId);
      setStep("publish");
    } catch (e) {
      setTestResponse(e instanceof Error ? e.message : "Erro ao testar.");
    } finally { setBusy(false); }
  }

  async function publish() {
    if (!localAgentId || !versionId || testedVersionId !== versionId) return;
    setBusy(true); setMessage("");
    try {
      const res = await fetch(`/api/v1/ai/agents/${localAgentId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ version_id: versionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Não foi possível publicar.");
      setMessage("Assistente publicado com sucesso! A nova versão foi selecionada. O estado de pausa do assistente foi preservado.");
      setStep("config");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro ao publicar.");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      {/* Status do assistente */}
      {localAgentId && (
        <div className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm">
          <span className={`h-2.5 w-2.5 rounded-full ${isActive ? "bg-green-500" : "bg-amber-400"}`} />
          <span>
            {isActive ? "Assistente ativo" : "Assistente pausado"}
            {publishedVersionNumber && (
              <span className="ml-2 text-muted-foreground">
                · Versão {publishedVersionNumber}
                {publishedAt && ` · Publicado em ${new Date(publishedAt).toLocaleDateString("pt-BR")}`}
              </span>
            )}
          </span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setStep("test")} disabled={!versionId}>
            Testar rascunho
          </Button>
        </div>
      )}

      {/* Navegação entre passos */}
      <div className="flex gap-1 text-sm font-medium border-b">
        {(["config", "test", "publish"] as const).map((s, i) => (
          <button
            key={s}
            disabled={busy || (s === "test" && !versionId) || (s === "publish" && (!versionId || testedVersionId !== versionId))}
            onClick={() => setStep(s)}
            className={`px-4 py-2 border-b-2 transition-colors ${step === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {i + 1}. {s === "config" ? "Configurar" : s === "test" ? "Testar" : "Publicar"}
          </button>
        ))}
      </div>

      {step === "config" && (
        <div className="space-y-6">
          {/* Modelos rápidos */}
          <div>
            <p className="text-sm font-medium mb-2">Comece com um modelo para o seu segmento (opcional)</p>
            <div className="flex flex-wrap gap-2">
              {BUSINESS_TYPES.map(t => (
                <Button key={t} size="sm" variant={config.business_type === t ? "default" : "outline"}
                  onClick={() => applyTemplate(t)}>
                  {BUSINESS_TYPE_LABELS[t]}
                </Button>
              ))}
            </div>
          </div>

          {/* Identidade */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Identidade do assistente</h2>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Nome do assistente</span>
              <Input value={config.assistant_name} onChange={e => patch("assistant_name", e.target.value)} maxLength={80} placeholder="Ex: Assistente da Clínica Saúde" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Como ele deve se apresentar</span>
              <Textarea value={config.presentation} onChange={e => patch("presentation", e.target.value)} maxLength={300} rows={2} placeholder="Ex: Olá! Sou o assistente virtual da Clínica Saúde e estou aqui para ajudar…" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Objetivo do atendimento</span>
              <Textarea value={config.objective} onChange={e => patch("objective", e.target.value)} maxLength={500} rows={2} placeholder="Ex: Auxiliar pacientes com informações, agendamentos e dúvidas sobre consultas." />
            </label>
          </section>

          {/* Comunicação */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Comunicação</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Tom</span>
                <select className="rounded-md border bg-background p-2 text-sm" value={config.tone} onChange={e => patch("tone", e.target.value as AssistantConfig["tone"])}>
                  {TONES.map(t => <option key={t} value={t}>{TONE_LABELS[t]}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Grau de formalidade</span>
                <select className="rounded-md border bg-background p-2 text-sm" value={config.formality} onChange={e => patch("formality", e.target.value as AssistantConfig["formality"])}>
                  <option value="formal">Formal</option>
                  <option value="informal">Informal</option>
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Tamanho das respostas</span>
                <select className="rounded-md border bg-background p-2 text-sm" value={config.response_length} onChange={e => patch("response_length", e.target.value as AssistantConfig["response_length"])}>
                  {RESPONSE_LENGTH.map(l => <option key={l} value={l}>{LENGTH_LABELS[l]}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 pt-5">
                <input type="checkbox" checked={config.use_emojis} onChange={e => patch("use_emojis", e.target.checked)} className="h-4 w-4" />
                <span className="text-sm">Usar emojis ocasionalmente</span>
              </label>
            </div>
            {config.tone === "custom" && (
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Descreva o tom personalizado</span>
                <Input value={config.custom_tone} onChange={e => patch("custom_tone", e.target.value)} maxLength={200} />
              </label>
            )}
          </section>

          {/* Conhecimento */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">O que ele sabe</h2>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Serviços oferecidos</span>
              <Textarea value={config.services} onChange={e => patch("services", e.target.value)} maxLength={2000} rows={3} placeholder="Liste os serviços, produtos ou consultas disponíveis." />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Perguntas frequentes</span>
              <Textarea value={config.faq} onChange={e => patch("faq", e.target.value)} maxLength={3000} rows={4} placeholder="Pergunta: … Resposta: …" />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Outras informações importantes</span>
              <Textarea value={config.knowledge_notes} onChange={e => patch("knowledge_notes", e.target.value)} maxLength={3000} rows={3} placeholder="Endereço, políticas, regras, observações que o assistente precisa saber." />
            </label>
          </section>

          {/* Limites */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Limites e transferências</h2>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Assuntos que ele NÃO pode responder</span>
              <Textarea value={config.forbidden_topics} onChange={e => patch("forbidden_topics", e.target.value)} maxLength={1000} rows={2} placeholder="Ex: Diagnósticos, preços de concorrentes, informações confidenciais." />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Situações em que deve chamar um humano</span>
              <Textarea value={config.escalation_triggers} onChange={e => patch("escalation_triggers", e.target.value)} maxLength={1000} rows={2} placeholder="Ex: Urgências, reclamações, solicitações especiais." />
            </label>
          </section>

          {/* Agenda */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Agendamentos</h2>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.can_schedule} onChange={e => patch("can_schedule", e.target.checked)} className="h-4 w-4" />
              <span className="text-sm">O assistente pode consultar e criar agendamentos</span>
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Horários de atendimento</span>
              <Input value={config.business_hours} onChange={e => patch("business_hours", e.target.value)} maxLength={500} placeholder="Ex: Segunda a sexta, das 8h às 18h." />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Mensagem fora do horário</span>
              <Input value={config.out_of_hours_message} onChange={e => patch("out_of_hours_message", e.target.value)} maxLength={500} placeholder="Ex: Obrigado pelo contato. Retornaremos em breve." />
            </label>
          </section>

          {/* Autonomia */}
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Nível de autonomia</h2>
            <div className="space-y-2">
              {AUTONOMY_LEVELS.map(level => (
                <label key={level} className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer hover:bg-muted/30">
                  <input type="radio" name="autonomy" value={level} checked={config.autonomy === level}
                    onChange={() => patch("autonomy", level)} className="mt-0.5 h-4 w-4" />
                  <span className="text-sm">{AUTONOMY_LABELS[level]}</span>
                </label>
              ))}
            </div>
          </section>

          <div className="flex gap-3 pt-2">
            <Button onClick={saveDraft} disabled={busy}>{busy ? "Salvando…" : "Salvar rascunho"}</Button>
          </div>
        </div>
      )}

      {step === "test" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Simule uma conversa para ver como o assistente vai responder antes de publicar.</p>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Mensagem de teste</span>
            <Textarea value={testInput} onChange={e => setTestInput(e.target.value)} rows={3} placeholder="Digite uma mensagem como se fosse um cliente…" />
          </label>
          <Button onClick={testAssistant} disabled={busy || !testInput.trim() || !versionId}>
            {busy ? "Testando…" : "Testar agora"}
          </Button>
          {testResponse && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Resposta do assistente:</p>
              <p className="text-sm whitespace-pre-wrap">{testResponse}</p>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setStep("config")}>← Voltar e editar</Button>
            <Button onClick={() => setStep("publish")} disabled={!versionId || testedVersionId !== versionId}>Continuar para publicar →</Button>
          </div>
        </div>
      )}

      {step === "publish" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-green-50 p-4 text-sm space-y-2">
            <p className="font-medium text-green-800">Pronto para publicar</p>
            <p className="text-green-700">Ao publicar, esta versão testada será usada nos próximos atendimentos. Se o assistente estiver pausado, continuará pausado.</p>
            <p className="text-green-700">As versões anteriores permanecem no histórico do agente.</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={publish} disabled={busy || !versionId || testedVersionId !== versionId}>{busy ? "Publicando…" : "Publicar assistente"}</Button>
            <Button variant="outline" onClick={() => setStep("test")}>← Voltar para teste</Button>
          </div>
        </div>
      )}

      {history.length > 0 && <section className="rounded-lg border p-4 space-y-3">
        <h2 className="font-semibold">Histórico de configurações</h2>
        <p className="text-sm text-muted-foreground">Restaurar preenche o formulário. Salve e teste um novo rascunho antes de publicar.</p>
        <ul className="flex flex-wrap gap-2">{history.map(item => <li key={item.id}><Button variant="outline" size="sm" disabled={busy}
          onClick={() => { setConfig(item.config); setVersionId(null); setTestedVersionId(null); setStep("config"); setMessage("Configuração restaurada no formulário. Salve um novo rascunho."); }}>
          Restaurar configuração {item.version_number}
        </Button></li>)}</ul>
      </section>}
      {message && (
        <p role="status" className="rounded-md border px-3 py-2 text-sm">{message}</p>
      )}
    </div>
  );
}
