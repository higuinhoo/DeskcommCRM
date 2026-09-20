# Plataforma modular — estado de desenvolvimento

Confirmado no código: `organizations.settings.product_platform` é a política persistente.
O resolvedor `lib/product/capabilities.ts` alimenta a navegação, o proxy e os guards de API.
`PRODUCT_PROFILES_ENABLED` mantém compatibilidade por padrão. A ativação depende de concluir
cobertura de workers, ações e MCP; não ativar por causa de um build verde.

A simulação em `platform_support_sessions.preview_context` passa pelo mesmo resolvedor,
por interseção com a política real. Não eleva papel nem concede módulo. A migration 0314
valida sessão/autoridade/MFA e converte acompanhamento para somente leitura inclusive depois
de limpar a simulação; edição exige encerrar e iniciar suporte explicitamente. Callbacks
OAuth e RLS consomem a mesma restrição. Laboratório sintético ainda pendente, sem booleano
cliente capaz de liberar escrita.

O assistente guiado salva `ai_agent_versions.assistant_config` junto do prompt, preservando
modelo, canal, escopos e orçamento da versão anterior em uma transação. Não modifica o runtime
no rascunho. Publicação passa pela operação existente; a migration 0315 exige teste concluído,
impede alteração do rascunho guiado e aplica config/autonomia no mesmo commit da publicação.
`assisted` é o modo existente de aprovação humana. A pausa é preservada. Primeiro provisionamento
continua no editor de agentes; o wizard não inventa modelo ou credencial.

O diagnóstico é leitura administrativa por organização, com consultas independentes em paralelo,
auditoria limitada às últimas 20 operações, integrações aos últimos 20 recebimentos, consumo e
p95 de IA do mês UTC. Ausência de dados e falhas de consulta têm estados distintos. Não expõe
conteúdo de conversa, prompts, credenciais ou payloads de webhook.

A interface simples entra por `/app/home` e resume o estado publicado do assistente, conversas
que pedem atenção, próximos compromissos e configuração pendente. O editor administrativo expõe
as regras graduais já resolvidas por plano, perfil, organização, percentual e opt-in experimental.
O painel de saúde também verifica Google Agenda, credenciais de IA, banco, filas, webhooks e
storage; o teste manual apenas relê sinais seguros e não altera a operação.

Living System Checklist:
1. Entrada: política persistente, sessão autenticada, versões existentes e telemetria real.
2. Saída: navegação/guards, runtime publicado e diagnóstico do operador.
3. Registro: mudanças de produto, preview e versões no audit existente.
4. Tela: perfil/módulos, banner, Meu Assistente e detalhe administrativo da organização.
5. Portas: catálogo de navegação, banner de suporte e detalhe de tenant.
6. Próximo passo: erros orientam configurar agente/canal ou repetir consulta; leitura não agenda ações.
7. Configuração: editor administrativo e wizard; falha persistente é visível.
8. Continuidade: modo assisted e handoff existentes; nenhum segundo motor.
9. Retorno: simular, revisar configuração, salvar nova versão e testar antes de publicar.
10. Mapa: este documento liga política → resolvedor → guards/interface; config → versão → runtime;
telemetria → diagnóstico → correção administrativa.

Pendências: laboratório sintético, cobertura completa de vocabulário,
provisionamento guiado sem editor técnico, enforcement de módulos em workers/MCP,
testes completos de integração/tela e implantação. Nenhuma destas partes é declarada concluída.
