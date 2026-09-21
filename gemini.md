# GEMINI.md — Contexto do Projeto DeskcommCRM & Regras de Economia

Este documento define as diretrizes e regras operacionais para o **Gemini / Antigravity** ao trabalhar no projeto **DeskcommCRM**.

---

## 1. Ambiente Local & Regras Fundamentais (Windows)

### 1.1. Ambiente de Execução Local
* **Sistema Operacional:** Windows (PowerShell).
* **Workspace Principal:** `C:\Users\agare\Documents\crm`.
* **Regras de SO:** Comandos locais devem ser compatíveis com PowerShell / Windows. Não assumir ferramentas exclusivas de Linux localmente (como `pacman`, `pkexec`, `sudo` ou scripts de desktop Hyprland).
* **Sistema de Arquivos:** O Windows é case-insensitive. Não criar nem manter arquivos que se diferenciem apenas por maiúsculas/minúsculas no mesmo diretório (como `agents.md` e `AGENTS.md`).

### 1.2. Regras Fundamentais de Economia de Tokens
1. **Local & GitHub First, Produção Depois:**
   - O repositório no GitHub (`https://github.com/higuinhoo/DeskcommCRM`, branch `main`) é a única fonte da verdade.
   - Qualquer alteração deve ser implementada e testada localmente antes de qualquer deploy em produção.
   - Sempre valide sintaxe e tipos TypeScript antes de gerar imagens ou deploys.

2. **Edições Cirúrgicas e Contíguas:**
   - Não faça varreduras cegas de diretórios nem buscas pesadas (`grep`/`find`) em pastas volumosas (`node_modules`, `.next`, `.git`, `tests`, `docs`).
   - Aplique substituições cirúrgicas em blocos contíguos de código nos arquivos alvo.
   - Priorize ferramentas de leitura seletiva (`selective-reader`).

3. **Zero Polling Loops em Operações Longas:**
   - Jamais execute loops de espera (`while sleep 20; check; done`) durante builds (`docker build`, `next build`).
   - Execute comandos longos como processos em segundo plano ou monitores autônomos (`nohup` / `disown`) na VPS, permitindo que a compilação ocorra sem bloquear o agente ou queimar tokens.

4. **Comunicação Direta e Objetiva:**
   - Mantenha respostas enxutas, técnicas e livres de transcripts ou repetições desnecessárias.

### 1.3. TypeScript Estrito
* O projeto opera com `noUncheckedIndexedAccess: true`.
* Acessos a arrays, dicionários e mapas devem tratar `undefined` explicitamente ou usar casting seguro para evitar falhas durante `pnpm build` e no container Docker.

---

## 2. Decisões de Arquitetura do DeskcommCRM

### 2.1. Stack Tecnológica
* **Frontend & Backend:** Next.js 16 (App Router + Turbopack), React 19, TypeScript estrito (`noUncheckedIndexedAccess: true`).
* **Estilização:** TailwindCSS, componentes Radix / shadcn/ui.
* **Banco & Auth:** Supabase (PostgreSQL com Row Level Security) em arquitetura multi-tenant (`organizations`).
* **Mensageria & Filas:** Redis com SRH (Serverless Redis HTTP).
* **WhatsApp:** Integração com WAHA (WhatsApp HTTP API).
* **Proxy & SSL:** Caddy Server 2 em container dedicado.

### 2.2. Sistema de Templates de Negócio e Nomenclaturas
* **Templates Implementados (`lib/templates/business-templates.ts`):**
  - Clínica & Consultório (`clinica`)
  - Barbearia & Salão (`barbearia`)
  - Escritório & Consultoria (`escritorio`)
  - Imobiliária & Corretores (`imobiliaria`)
  - Serviços & Assistência Técnica (`servicos`)
  - Vendas & Varejo Geral (`vendas`)
* **Aplicação e Persistência:**
  - Salvo em `organizations.settings.business_template` e `organizations.settings.vocabulary`.
  - Aplicado via Server Action `app/actions/settings/applyBusinessTemplate.ts`.
  - Acessível no frontend via hook `hooks/useBusinessVocabulary.ts`.
  - Página de seleção em `/app/settings/template`.

### 2.3. Slots Estruturados para o Assistente de IA
* No assistente (`/app/assistant`), produtos e serviços são gerenciados via slots estruturados contendo:
  - `Nome do Item`
  - `Preço/Valor`
  - `Descrição/Detalhes`
* A lista estruturada (`service_items`) é compilada automaticamente para o prompt da IA através da função `promptFromConfig()` em `lib/assistant/config-schema.ts`.

---

## 3. Infraestrutura & Deploy em Produção

* **Domínio:** `crm.samtab.com.br`
* **Servidor (GCP):** Instância `n8n` (`34.28.175.242`), zona `us-central1-c`, projeto `kinetic-hydra-308322`.
* **Caminho na VPS:** `/opt/deskcommcrm`
* **Rede do Proxy:**
  - O container `deskcommcrm-app-1` deve obrigatoriamente estar conectado às redes `internal` (bridge local) e `deskcomm_proxy` (rede externa compartilhada com o Caddy).
  - Declarado no `docker-compose.prod.yml`.
* **Resiliência de Deploy:**
  - Para builds longos de Docker na VPS que não devam ser interrompidos por queda de conexão local, execute o script em background na VPS (`nohup /tmp/deploy-auto.sh > /tmp/deploy-auto.log 2>&1 & disown`).
* **Processo de Atualização:**
  1. `git pull origin main` na VPS.
  2. Atualização da tag `APP_IMAGE` no `.env`.
  3. Rebuild e reinicialização com `docker compose -f docker-compose.prod.yml -f docker-compose.build.yml build app && docker compose -f docker-compose.prod.yml up -d --no-deps app`.
  4. Validação via health check (`curl -s https://crm.samtab.com.br/api/v1/health`).
