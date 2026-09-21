"use client";
import { useState } from "react";
import Link from "next/link";
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
  canAccessAdvanced?: boolean;
}

const LENGTH_LABELS = { short: "Curtas", medium: "Equilibradas", long: "Detalhadas" };

function defaultConfig(): AssistantConfig {
  return assistantConfigSchema.parse({});
}

function loadConfig(raw: unknown): AssistantConfig {
  const parsed = assistantConfigSchema.safeParse(raw);
  return parsed.success ? parsed.data : defaultConfig();
}

export function AssistantWizard({ agentId: initialAgentId, initialVersionId, history, isActive, savedConfig, publishedVersionNumber, publishedAt, canAccessAdvanced }: Props) {
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
      {/* Banner de atalho para administradores */}
      {canAccessAdvanced && localAgentId && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-sm dark:border-blue-900/60 dark:bg-blue-950/30">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚙️</span>
            <div>
              <p className="font-semibold text-foreground">Modo Administrador Disponível</p>
              <p className="text-xs text-muted-foreground">
                Você pode personalizar instruções de sistema diretas, modelos de IA (Vertex/Gemini), chaves e ferramentas técnicas.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="bg-background shadow-xs">
            <Link href={`/app/ai/agents/${localAgentId}`}>
              Painel Técnico Avançado →
            </Link>
          </Button>
        </div>
      )}

      {/* Status do assistente */}
      {localAgentId && (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm shadow-xs">
          <span className={`h-3 w-3 rounded-full ${isActive ? "bg-green-500 ring-4 ring-green-100 dark:ring-green-950" : "bg-amber-400 ring-4 ring-amber-100 dark:ring-amber-950"}`} />
          <div>
            <span className="font-medium text-foreground">
              {isActive ? "Assistente Ativo e Respondendo" : "Assistente em Pausa"}
            </span>
            {publishedVersionNumber && (
              <span className="ml-2 text-xs text-muted-foreground">
                · Versão {publishedVersionNumber}
                {publishedAt && ` (publicada em ${new Date(publishedAt).toLocaleDateString("pt-BR")})`}
              </span>
            )}
          </div>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => setStep("test")} disabled={!versionId}>
            Testar rascunho
          </Button>
        </div>
      )}

      {/* Navegação entre passos */}
      <div className="flex gap-2 border-b pb-1 text-sm font-medium">
        {(["config", "test", "publish"] as const).map((s, i) => (
          <button
            key={s}
            disabled={busy || (s === "test" && !versionId) || (s === "publish" && (!versionId || testedVersionId !== versionId))}
            onClick={() => setStep(s)}
            className={`flex items-center gap-2 rounded-t-lg px-4 py-2.5 transition-colors ${
              step === s
                ? "border-b-2 border-primary font-semibold text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
              step === s ? "bg-primary text-primary-foreground font-bold" : "bg-muted text-muted-foreground"
            }`}>
              {i + 1}
            </span>
            {s === "config" ? "Configurar" : s === "test" ? "Simular & Testar" : "Publicar"}
          </button>
        ))}
      </div>

      {step === "config" && (
        <div className="space-y-6">
          {/* Modelos rápidos */}
          <section className="rounded-xl border bg-card/60 p-5 shadow-xs space-y-3">
            <div>
              <h2 className="text-base font-semibold">Modelos Prontos por Segmento</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Escolha um modelo abaixo para preencher automaticamente com exemplos recomendados para o seu tipo de negócio.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {BUSINESS_TYPES.map(t => (
                <Button
                  key={t}
                  size="sm"
                  variant={config.business_type === t ? "default" : "outline"}
                  onClick={() => applyTemplate(t)}
                >
                  {BUSINESS_TYPE_LABELS[t]}
                </Button>
              ))}
            </div>
          </section>

          {/* Identidade */}
          <section className="rounded-xl border bg-card/60 p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-semibold">1. Identidade e Apresentação</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Como seu assistente deve se chamar e como ele deve saudar os clientes.
              </p>
            </div>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Nome do assistente</span>
              <Input
                value={config.assistant_name}
                onChange={e => patch("assistant_name", e.target.value)}
                maxLength={80}
                placeholder="Ex: Assistente da Clínica Saúde"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Como ele deve se apresentar</span>
              <Textarea
                value={config.presentation}
                onChange={e => patch("presentation", e.target.value)}
                maxLength={300}
                rows={2}
                placeholder="Ex: Olá! Sou o assistente virtual da Clínica Saúde e estou aqui para ajudar…"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Objetivo principal do atendimento</span>
              <Textarea
                value={config.objective}
                onChange={e => patch("objective", e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Ex: Auxiliar pacientes com informações, agendamentos e dúvidas sobre consultas."
              />
            </label>
          </section>

          {/* Comunicação */}
          <section className="rounded-xl border bg-card/60 p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-semibold">2. Tom de Voz e Comunicação</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Defina o estilo das mensagens e o ritmo das respostas.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Tom da conversa</span>
                <select
                  className="rounded-md border bg-background p-2 text-sm"
                  value={config.tone}
                  onChange={e => patch("tone", e.target.value as AssistantConfig["tone"])}
                >
                  {TONES.map(t => <option key={t} value={t}>{TONE_LABELS[t]}</option>)}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Grau de formalidade</span>
                <select
                  className="rounded-md border bg-background p-2 text-sm"
                  value={config.formality}
                  onChange={e => patch("formality", e.target.value as AssistantConfig["formality"])}
                >
                  <option value="formal">Formal (Senhor / Senhora)</option>
                  <option value="informal">Informal (Você / Natural)</option>
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Tamanho das respostas</span>
                <select
                  className="rounded-md border bg-background p-2 text-sm"
                  value={config.response_length}
                  onChange={e => patch("response_length", e.target.value as AssistantConfig["response_length"])}
                >
                  {RESPONSE_LENGTH.map(l => <option key={l} value={l}>{LENGTH_LABELS[l]}</option>)}
                </select>
              </label>
              <label className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={config.use_emojis}
                  onChange={e => patch("use_emojis", e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm">Usar emojis de forma amigável</span>
              </label>
            </div>
            {config.tone === "custom" && (
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Descreva o tom personalizado</span>
                <Input
                  value={config.custom_tone}
                  onChange={e => patch("custom_tone", e.target.value)}
                  maxLength={200}
                  placeholder="Ex: Entusiasta, jovem e acolhedor"
                />
              </label>
            )}
          </section>

          {/* Conhecimento */}
          <section className="rounded-xl border bg-card/60 p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-semibold">3. O que o Assistente Sabe</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Informações sobre seus produtos, serviços e dúvidas frequentes dos clientes.
              </p>
            </div>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Serviços ou Produtos oferecidos</span>
              <Textarea
                value={config.services}
                onChange={e => patch("services", e.target.value)}
                maxLength={2000}
                rows={3}
                placeholder="Liste os serviços, valores ou produtos disponíveis."
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Perguntas Frequentes (FAQ)</span>
              <Textarea
                value={config.faq}
                onChange={e => patch("faq", e.target.value)}
                maxLength={3000}
                rows={4}
                placeholder="Pergunta: Aceitam convênio?&#10;Resposta: Sim, aceitamos os principais planos de saúde."
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Outras informações e orientações</span>
              <Textarea
                value={config.knowledge_notes}
                onChange={e => patch("knowledge_notes", e.target.value)}
                maxLength={3000}
                rows={3}
                placeholder="Endereço, estacionamento, formas de pagamento, regras gerais."
              />
            </label>
          </section>

          {/* Limites */}
          <section className="rounded-xl border bg-card/60 p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-semibold">4. Limites e Transbordo Humano</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Defina o que o assistente NÃO pode falar e quando deve encaminhar para sua equipe.
              </p>
            </div>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Assuntos que ele NUNCA deve responder</span>
              <Textarea
                value={config.forbidden_topics}
                onChange={e => patch("forbidden_topics", e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Ex: Diagnósticos médicos, opiniões políticas, dados de concorrentes."
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Quando chamar um atendente humano</span>
              <Textarea
                value={config.escalation_triggers}
                onChange={e => patch("escalation_triggers", e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Ex: Reclamações, emergências, solicitação explícita de falar com uma pessoa."
              />
            </label>
          </section>

          {/* Agenda */}
          <section className="rounded-xl border bg-card/60 p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-semibold">5. Horários e Agendamentos</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure disponibilidade de agenda e respostas fora do horário de atendimento.
              </p>
            </div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.can_schedule}
                onChange={e => patch("can_schedule", e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span className="text-sm font-medium">O assistente pode consultar horários e agendar compromissos</span>
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Horários de atendimento da empresa</span>
              <Input
                value={config.business_hours}
                onChange={e => patch("business_hours", e.target.value)}
                maxLength={500}
                placeholder="Ex: Segunda a sexta, das 8h às 18h."
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Mensagem automática fora do horário</span>
              <Input
                value={config.out_of_hours_message}
                onChange={e => patch("out_of_hours_message", e.target.value)}
                maxLength={500}
                placeholder="Ex: Nosso atendimento encerrou por hoje, mas já registrei sua mensagem e responderemos amanhã cedo!"
              />
            </label>
          </section>

          {/* Autonomia */}
          <section className="rounded-xl border bg-card/60 p-5 shadow-xs space-y-4">
            <div>
              <h2 className="text-base font-semibold">6. Nível de Autonomia</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Qual a liberdade do assistente para responder sozinho.
              </p>
            </div>
            <div className="space-y-2">
              {AUTONOMY_LEVELS.map(level => (
                <label
                  key={level}
                  className={`flex items-start gap-3 rounded-lg border p-3.5 cursor-pointer transition-colors ${
                    config.autonomy === level ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="autonomy"
                    value={level}
                    checked={config.autonomy === level}
                    onChange={() => patch("autonomy", level)}
                    className="mt-1 h-4 w-4"
                  />
                  <div>
                    <span className="text-sm font-medium">{AUTONOMY_LABELS[level]}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {level === "automatic" && "Responde dúvidas, realiza consultas e conduz o atendimento de forma independente."}
                      {level === "hybrid" && "Responde dúvidas rotineiras e transfere para a equipe humana em assuntos sensíveis."}
                      {level === "suggest_only" && "A IA apenas redige sugestões no painel; nenhuma mensagem sai sem clique humano."}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <div className="flex items-center gap-3 pt-2">
            <Button size="lg" onClick={saveDraft} disabled={busy}>
              {busy ? "Salvando…" : "Salvar e Avançar para Teste →"}
            </Button>
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
