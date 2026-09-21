"use client";
/**
 * O que o agente pode fazer — na língua de quem contrata um agente, não na de
 * quem escreve um.
 *
 * Antes desta tela o humano via `crm_move_lead_stage` em fonte monoespaçada,
 * agrupado por "Leitura / Escrita / Especiais". Isso descreve o código, não a
 * decisão: quem configura é dono de clínica, de loja, de imobiliária, e a
 * pergunta dele é "o que essa coisa vai fazer com meus clientes?".
 *
 * O caminho padrão é o PACOTE por jornada. O checkbox por capacidade continua
 * existindo em modo avançado — agora organizado por grupos temáticos claros
 * (Agendamento, Atendimento, Vendas, etc.).
 *
 * A regra de quem entra por pacote NÃO mora aqui: vive em
 * `lib/mcp/tools/selecao-por-pacote.ts`, com teste. O componente chama e
 * renderiza. Regra dentro de `onChange` é regra que nunca é exercitada.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { apiClient } from "@/lib/api/client";
import { useT } from "@/hooks/i18n/useT";
import {
  PACOTES,
  riscoMeta,
  type ToolBundle,
  type ToolRisk,
} from "@/lib/mcp/tools/pacotes";
import {
  TETO_TOOLS_POR_AGENTE,
  capacidadesAutomaticasDoPacote,
  capacidadesCriticasDoPacote,
  desligarPacote,
  estadoDoPacote,
  ligarPacote,
  vagasExigidasPeloPacote,
  textoDaContagem,
  vagasRestantes,
  type CapacidadeSelecionavel,
} from "@/lib/mcp/tools/selecao-por-pacote";
import {
  GRUPOS_AVANCADOS,
  classificarToolNoGrupo,
  type ToolGroupId,
} from "@/lib/mcp/tools/grupos-avancados";

/** O que a rota `/api/v1/mcp/tools` serve (snake_case no wire). */
export interface McpToolMeta extends CapacidadeSelecionavel {
  id: string;
  description: string;
  category: string;
  requires_role: string;
  requires_scope: string;
  rotulo: string;
  explicacao: string;
  o_que_toca: string;
  risco: ToolRisk;
  pacotes: ReadonlyArray<ToolBundle>;
  /** `false` = capacidade do harness: mostra, explica e não deixa marcar. */
  marcavel: boolean;
  motivo_nao_marcavel: string | null;
}

interface Props {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}

interface ApiResponse {
  data: { tools: Array<Omit<McpToolMeta, "name">> };
}

const TODOS_OS_PACOTES: ReadonlyArray<ToolBundle> = PACOTES.map((p) => p.id);

const CLASSE_RISCO: Record<ToolRisk, string> = {
  seguro: "border-border/60 text-muted-foreground",
  atencao: "border-amber-500/40 text-amber-700 dark:text-amber-400",
  critico: "border-destructive/40 text-destructive",
};

function BadgeRisco({ risco }: { risco: ToolRisk }) {
  const t = useT();
  const meta = riscoMeta(risco);
  return (
    <Badge variant="outline" className={`text-[11px] ${CLASSE_RISCO[risco]}`} title={t(meta.explicacao)}>
      {t(meta.rotulo)}
    </Badge>
  );
}

/** Ficha de uma capacidade — o que ela faz, o que toca, quanto pode doer. */
function FichaCapacidade({
  capacidade,
  marcada,
  bloqueada,
  onToggle,
  disabled,
  mostrarNomeTecnico,
}: {
  capacidade: McpToolMeta;
  marcada: boolean;
  bloqueada: boolean;
  onToggle: () => void;
  disabled?: boolean;
  mostrarNomeTecnico?: boolean;
}) {
  const t = useT();
  return (
    <label
      data-testid={`capacidade-${capacidade.name}`}
      data-marcada={marcada ? "sim" : "nao"}
      data-risco={capacidade.risco}
      className={`flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted/40 transition-colors ${
        bloqueada ? "opacity-60" : ""
      }`}
    >
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 shrink-0 rounded-md border-border accent-primary"
        checked={marcada}
        onChange={onToggle}
        disabled={disabled || (bloqueada && !marcada)}
        aria-label={t(capacidade.rotulo)}
      />
      <span className="flex-1 space-y-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{t(capacidade.rotulo)}</span>
          <BadgeRisco risco={capacidade.risco} />
          <span className="text-xs text-muted-foreground">· {t(capacidade.o_que_toca)}</span>
        </span>
        <span className="block text-xs text-muted-foreground">{t(capacidade.explicacao)}</span>
        {capacidade.motivo_nao_marcavel ? (
          <span
            data-testid={`motivo-nao-marcavel-${capacidade.name}`}
            className="block text-xs text-sky-700 dark:text-sky-400"
          >
            {t(capacidade.motivo_nao_marcavel)}
          </span>
        ) : null}
        {mostrarNomeTecnico ? (
          <code className="block font-mono text-[11px] text-muted-foreground">
            {capacidade.name}
          </code>
        ) : null}
      </span>
    </label>
  );
}

export function ToolPicker({ value, onChange, disabled }: Props) {
  const t = useT();
  const [avancado, setAvancado] = React.useState(false);
  const [recusa, setRecusa] = React.useState<string | null>(null);
  const [busca, setBusca] = React.useState("");
  const [grupoSelecionado, setGrupoSelecionado] = React.useState<ToolGroupId | "todos">("todos");

  const query = useQuery({
    queryKey: ["mcp", "tools"],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse>("/api/v1/mcp/tools");
      return res.data.tools.map((item) => ({ ...item, name: item.id })) as McpToolMeta[];
    },
    staleTime: 60_000,
  });

  const catalogo = React.useMemo<McpToolMeta[]>(() => query.data ?? [], [query.data]);
  const porNome = React.useMemo(
    () => new Map(catalogo.map((c) => [c.name, c])),
    [catalogo],
  );

  const vagas = vagasRestantes(value);
  const cheio = vagas <= 0;

  /** Ids salvos que o servidor não oferece mais. */
  const orfas = value.filter((id) => !porNome.has(id));

  function aplicar(proximo: string[], motivoSeRecusar: string, vagasExigidas = proximo.length) {
    if (vagasExigidas > TETO_TOOLS_POR_AGENTE) {
      setRecusa(motivoSeRecusar);
      return;
    }
    setRecusa(null);
    onChange(proximo);
  }

  function alternarPacote(pacote: ToolBundle, ligar: boolean) {
    if (ligar) {
      const proximo = ligarPacote(value, catalogo, pacote);
      const exigidas = vagasExigidasPeloPacote(value, catalogo, pacote);
      const excedente = exigidas - TETO_TOOLS_POR_AGENTE;
      aplicar(
        proximo,
        `${t("Ligar este pacote passaria de")} ${TETO_TOOLS_POR_AGENTE} ${t("capacidades (faltam")} ${excedente} ${
          excedente === 1 ? t("vaga") : t("vagas")
        }${t("). Desligue um pacote que você usa menos antes.")}`,
        exigidas,
      );
    } else {
      setRecusa(null);
      onChange(desligarPacote(value, catalogo, pacote, TODOS_OS_PACOTES));
    }
  }

  function alternarCapacidade(name: string) {
    if (value.includes(name)) {
      setRecusa(null);
      onChange(value.filter((x) => x !== name));
      return;
    }
    aplicar(
      [...catalogo.map((c) => c.name), ...orfas].filter(
        (n) => value.includes(n) || n === name,
      ),
      `${t("Você já ligou")} ${TETO_TOOLS_POR_AGENTE} ${t("capacidades. Desligue uma antes de ligar outra.")}`,
    );
  }

  /** Ferramentas de agendamento em destaque */
  const agendamentoTools = React.useMemo(() => {
    return catalogo.filter(
      (c) => classificarToolNoGrupo(c.name, c.o_que_toca) === "agendamento",
    );
  }, [catalogo]);

  const agendamentoLigadas = React.useMemo(() => {
    return agendamentoTools.filter((t) => value.includes(t.name));
  }, [agendamentoTools, value]);

  /** Liga todas as ferramentas marcáveis de um grupo */
  function ligarGrupo(groupId: ToolGroupId) {
    const toolsDoGrupo = catalogo.filter(
      (c) => classificarToolNoGrupo(c.name, c.o_que_toca) === groupId && c.marcavel,
    );
    const novas = toolsDoGrupo.filter((t) => !value.includes(t.name)).map((t) => t.name);
    if (novas.length === 0) return;

    const proximo = [...value, ...novas];
    const excedente = proximo.length - TETO_TOOLS_POR_AGENTE;
    aplicar(
      proximo,
      `${t("Ligar este grupo passaria de")} ${TETO_TOOLS_POR_AGENTE} ${t("capacidades (faltam")} ${excedente} ${
        excedente === 1 ? t("vaga") : t("vagas")
      }${t("). Desligue outras antes.")}`,
    );
  }

  /** Desliga todas as ferramentas de um grupo */
  function desligarGrupo(groupId: ToolGroupId) {
    setRecusa(null);
    const nomesDoGrupo = new Set(
      catalogo
        .filter((c) => classificarToolNoGrupo(c.name, c.o_que_toca) === groupId)
        .map((c) => c.name),
    );
    onChange(value.filter((id) => !nomesDoGrupo.has(id)));
  }

  /** Agrupamento completo para a lista avançada */
  const catalogoPorGrupo = React.useMemo(() => {
    const mapa = new Map<ToolGroupId, McpToolMeta[]>();
    for (const g of GRUPOS_AVANCADOS) {
      mapa.set(g.id, []);
    }
    for (const item of catalogo) {
      const gid = classificarToolNoGrupo(item.name, item.o_que_toca);
      const lista = mapa.get(gid) ?? [];
      lista.push(item);
      mapa.set(gid, lista);
    }
    return mapa;
  }, [catalogo]);

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">{t("Carregando as capacidades…")}</p>;
  }
  if (query.isError) {
    return (
      <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        {t("Não foi possível carregar as capacidades. Recarregue a página.")}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="tool-picker">
      {/* Consumo do teto */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 p-3">
        <p className="text-sm">
          <strong data-testid="consumo-teto">
            {value.length} {t("de")} {TETO_TOOLS_POR_AGENTE}
          </strong>{" "}
          {t("capacidades ligadas")}
        </p>
        <p className="text-xs text-muted-foreground">
          {cheio
            ? t("Limite atingido. Desligue algo para ligar outra coisa.")
            : t("Acima disso o agente erra na hora de escolher o que usar.")}
        </p>
      </div>

      {recusa ? (
        <p
          data-testid="aviso-teto"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {recusa}
        </p>
      ) : null}

      {/* Destaque Especial: Capacidades de Agendamento & Calendário */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">📅</span>
              <h4 className="text-sm font-semibold">{t("Agendamento & Calendário")}</h4>
              <Badge
                variant="outline"
                className={`text-xs font-medium ${
                  agendamentoLigadas.length > 0
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground"
                }`}
              >
                {agendamentoLigadas.length} {t("de")} {agendamentoTools.length} {t("ativas")}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {t(
                "Tudo que o agente precisa para consultar horários livres, marcar consultas ou sessões, remarcar e confirmar compromissos no WhatsApp.",
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {agendamentoLigadas.length < agendamentoTools.length ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
                disabled={disabled}
                onClick={() => ligarGrupo("agendamento")}
              >
                {t("Ativar Agendamento Completo")}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={disabled}
                onClick={() => desligarGrupo("agendamento")}
              >
                {t("Desativar Agendamento")}
              </Button>
            )}
          </div>
        </div>

        {/* Chips de visualização rápida das ferramentas de agendamento */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {agendamentoTools.map((tool) => {
            const ativa = value.includes(tool.name);
            return (
              <button
                key={tool.name}
                type="button"
                disabled={disabled || (!ativa && cheio)}
                onClick={() => alternarCapacidade(tool.name)}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs border transition-colors ${
                  ativa
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "bg-background text-muted-foreground border-border/70 hover:bg-muted/60"
                }`}
                title={tool.explicacao}
              >
                <span>{ativa ? "✓" : "+"}</span>
                <span>{tool.rotulo}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Caminho padrão: pacotes por jornada */}
      <div className="grid gap-3">
        {PACOTES.map((pacote) => {
          const automaticas = capacidadesAutomaticasDoPacote(catalogo, pacote.id);
          const criticas = capacidadesCriticasDoPacote(catalogo, pacote.id);
          const estado = estadoDoPacote(value, catalogo, pacote.id);
          const total = automaticas.length + criticas.length;
          const ligadas = [...automaticas, ...criticas].filter((n) =>
            value.includes(n),
          ).length;
          const vazio = total === 0;

          return (
            <div
              key={pacote.id}
              data-testid={`pacote-${pacote.id}`}
              data-estado={estado}
              className="space-y-3 rounded-md border border-border/60 p-4"
            >
              <div className="flex items-start gap-3">
                <Switch
                  id={`pacote-${pacote.id}`}
                  data-testid={`switch-pacote-${pacote.id}`}
                  checked={estado === "ligado"}
                  onCheckedChange={(v) => alternarPacote(pacote.id, v)}
                  disabled={disabled || vazio}
                  aria-label={t(pacote.rotulo)}
                />
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label
                      htmlFor={`pacote-${pacote.id}`}
                      className="cursor-pointer text-sm font-medium"
                    >
                      {t(pacote.rotulo)}
                    </label>
                    {estado === "parcial" ? (
                      <Badge variant="outline" className="text-[11px]">
                        {t("parcial")}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{t(pacote.explicacao)}</p>
                  <p className="text-xs text-muted-foreground" data-testid={`contagem-${pacote.id}`}>
                    {textoDaContagem(total, ligadas, t)}
                  </p>
                </div>
              </div>

              {/* Crítico nunca entra por pacote */}
              {criticas.length > 0 ? (
                <div
                  data-testid={`criticas-${pacote.id}`}
                  className="space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2"
                >
                  <p className="text-xs font-medium text-destructive">
                    {t("Só ligando uma a uma — o pacote não liga por você:")}
                  </p>
                  {criticas.map((name) => {
                    const capacidade = porNome.get(name);
                    if (!capacidade) return null;
                    const marcada = value.includes(name);
                    return (
                      <FichaCapacidade
                        key={name}
                        capacidade={capacidade}
                        marcada={marcada}
                        bloqueada={!marcada && (cheio || !capacidade.marcavel)}
                        onToggle={() => alternarCapacidade(name)}
                        disabled={disabled}
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Modo avançado organizado por grupos */}
      <div className="space-y-2">
        <button
          type="button"
          data-testid="toggle-avancado"
          aria-expanded={avancado}
          onClick={() => setAvancado((v) => !v)}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {avancado ? t("Esconder a lista completa") : t("Escolher uma a uma (modo avançado)")}
        </button>

        {avancado ? (
          <div
            data-testid="lista-avancada"
            className="space-y-4 rounded-md border border-border/60 p-4 bg-muted/10"
          >
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">{t("Lista completa organizada por área")}</h4>
              <p className="text-xs text-muted-foreground">
                {t(
                  "Escolha capacidade por capacidade. O nome em cinza é a identificação técnica para integrações externas.",
                )}
              </p>
            </div>

            {/* Barra de busca e filtros rápidos */}
            <div className="space-y-2">
              <Input
                placeholder={t("Buscar capacidade por nome, função ou área (ex: consulta, funil, contato...)")}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 text-xs"
              />

              <div className="flex flex-wrap gap-1 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={grupoSelecionado === "todos" ? "default" : "outline"}
                  className="h-7 text-xs px-2.5"
                  onClick={() => setGrupoSelecionado("todos")}
                >
                  {t("Todos")} ({value.length}/{catalogo.length})
                </Button>
                {GRUPOS_AVANCADOS.map((grupo) => {
                  const items = catalogoPorGrupo.get(grupo.id) ?? [];
                  if (items.length === 0) return null;
                  const ligadas = items.filter((i) => value.includes(i.name)).length;
                  const selecionado = grupoSelecionado === grupo.id;

                  return (
                    <Button
                      key={grupo.id}
                      type="button"
                      size="sm"
                      variant={selecionado ? "default" : "outline"}
                      className={`h-7 text-xs px-2.5 ${
                        !selecionado && ligadas > 0 ? "border-primary/40 font-medium text-primary" : ""
                      }`}
                      onClick={() => setGrupoSelecionado(grupo.id)}
                    >
                      <span className="mr-1">{grupo.emoji}</span>
                      <span>{t(grupo.rotulo.split("&")[0]?.trim() || grupo.rotulo)}</span>
                      <span className="ml-1 text-[11px] opacity-75">
                        ({ligadas}/{items.length})
                      </span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Grupos temáticos */}
            <div className="space-y-4 pt-1">
              {GRUPOS_AVANCADOS.filter(
                (g) => grupoSelecionado === "todos" || grupoSelecionado === g.id,
              ).map((grupo) => {
                const todasDoGrupo = catalogoPorGrupo.get(grupo.id) ?? [];
                const termo = busca.trim().toLowerCase();
                const filtradas = todasDoGrupo.filter((c) => {
                  if (!termo) return true;
                  return (
                    c.name.toLowerCase().includes(termo) ||
                    c.rotulo.toLowerCase().includes(termo) ||
                    c.explicacao.toLowerCase().includes(termo) ||
                    c.o_que_toca.toLowerCase().includes(termo)
                  );
                });

                if (filtradas.length === 0) return null;

                const ligadas = todasDoGrupo.filter((c) => value.includes(c.name));
                const marcaveis = todasDoGrupo.filter((c) => c.marcavel);
                const tudoLigado = marcaveis.length > 0 && marcaveis.every((c) => value.includes(c.name));

                return (
                  <div
                    key={grupo.id}
                    className="rounded-lg border border-border/70 bg-card p-3 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{grupo.emoji}</span>
                          <span className="text-sm font-medium">{t(grupo.rotulo)}</span>
                          <Badge variant="outline" className="text-[11px]">
                            {ligadas.length} {t("de")} {todasDoGrupo.length} {t("ativas")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{t(grupo.explicacao)}</p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {!tudoLigado ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-primary"
                            disabled={disabled || cheio}
                            onClick={() => ligarGrupo(grupo.id)}
                          >
                            {t("Ligar grupo")}
                          </Button>
                        ) : null}
                        {ligadas.length > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            disabled={disabled}
                            onClick={() => desligarGrupo(grupo.id)}
                          >
                            {t("Desligar grupo")}
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <div className="space-y-1">
                      {filtradas.map((capacidade) => {
                        const marcada = value.includes(capacidade.name);
                        return (
                          <FichaCapacidade
                            key={capacidade.name}
                            capacidade={capacidade}
                            marcada={marcada}
                            bloqueada={!marcada && (cheio || !capacidade.marcavel)}
                            onToggle={() => alternarCapacidade(capacidade.name)}
                            disabled={disabled}
                            mostrarNomeTecnico
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {orfas.length > 0 ? (
        <div
          data-testid="capacidades-orfas"
          className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400"
        >
          <p>
            {orfas.length === 1
              ? t("Uma capacidade ligada não existe mais")
              : `${orfas.length} ${t("capacidades ligadas não existem mais")}`}{" "}
            {t("nesta versão do sistema (")}
            {orfas.join(", ")}
            {t("). Elas continuam salvas, mas o agente não consegue usá-las.")}
          </p>
          <button
            type="button"
            data-testid="remover-orfas"
            disabled={disabled}
            onClick={() => {
              setRecusa(null);
              onChange(value.filter((id) => porNome.has(id)));
            }}
            className="font-medium underline underline-offset-4 disabled:opacity-50"
          >
            {t("Desligar")} {orfas.length === 1 ? t("essa capacidade") : t("essas capacidades")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
