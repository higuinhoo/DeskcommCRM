# AGENTS.md — Diretrizes para Agentes de IA & Pair Programming

Este documento contém todas as regras operacionais, decisões de arquitetura e boas práticas de economia de tokens para qualquer agente de IA ou desenvolvedor atuando no repositório **DeskcommCRM**.

---

## 1. Regras Fundamentais de Token Economy (Prioridade Máxima)

Ao trabalhar neste projeto, obedeça rigorosamente aos quatro pilares de otimização de tokens:

### 1.1. Local & GitHub Primeiro, Produção Depois
* **Nunca** faça alterações diretamente na máquina de produção sem antes validar e comitar localmente.
* O repositório no **GitHub (`https://github.com/higuinhoo/DeskcommCRM`, branch `main`)** é a única fonte da verdade para versionamento, recuperação e sincronização.
* Toda alteração deve passar pelo ciclo: **Edição Local ➜ Validação de Tipos (`tsc`) ➜ Commit & Push ➜ Deploy no Servidor**.

### 1.2. Zero Polling Loops em Operações Longas
* **Nunca** execute loops de polling (como `while sleep 10; do check; done`) consumindo turnos e tokens durante builds (`docker build`, `next build`, `pnpm build`) ou tarefas assíncronas.
* Dispare tarefas longas em segundo plano (background tasks) ou como scripts autônomos na VPS (`nohup` / `disown`).
* Avise o usuário com um resumo conciso e aguarde a notificação de término natural do sistema.

### 1.3. Economia de Tokens & Edições Cirúrgicas
* **Proibida Exploração Desnecessária:** Nunca faça varreduras cegas de diretórios nem execute `find` ou `grep` recursivos em pastas pesadas (`node_modules`, `.next`, `.git`, `tests`, `docs`).
* **Edições Cirúrgicas e Contíguas:** Altere estritamente os arquivos e as linhas necessárias usando blocos contíguos de substituição.
* **Agrupamento de Mudanças:** Agrupe tarefas correlatas na mesma chamada para evitar viagens de ida e volta e gasto desnecessário de contexto.

### 1.4. Comunicação Direta e Concisa
* Mantenha respostas operacionais, diretas e focadas no que foi feito.
* Evite transcrever logs inteiros ou reescrever arquivos completos nas mensagens ao usuário.

---

## 2. Arquitetura do DeskcommCRM

### 2.1. Stack Tecnológica
* **Frontend & Backend:** Next.js 16 (App Router + Turbopack), React 19, TypeScript estrito.
* **Estilização & UI:** TailwindCSS, componentes Radix / shadcn/ui.
* **Banco de Dados & Autenticação:** Supabase (PostgreSQL com RLS) e multi-tenant por organização (`organization_id`).
* **Mensageria & Filas:** Redis com SRH (Serverless Redis HTTP).
* **WhatsApp API:** WAHA (WhatsApp HTTP API).
* **Proxy Reverso & SSL:** Caddy Server 2.

### 2.2. TypeScript Estrito
* O projeto roda com `noUncheckedIndexedAccess: true`.
* Todo acesso a dicionários, mapas e arrays deve tratar `undefined` explicitamente ou usar casting seguro (`as MyType`), evitando quebras durante o `pnpm build` no Dockerfile.

---

## 3. Templates de Negócio e Nomenclaturas Dinâmicas

O DeskcommCRM suporta adaptação dinâmica de segmentos de mercado, permitindo que a interface e o assistente de IA falem a linguagem do cliente:

### 3.1. Os 6 Templates Canônicos (`lib/templates/business-templates.ts`)
1. **`clinica` (Clínica & Consultório 🏥):** Pacientes, Procedimentos & Consultas, Tratamentos.
2. **`barbearia` (Barbearia & Salão ✂️):** Clientes, Cortes & Serviços, Agendamentos.
3. **`escritorio` (Escritório & Consultoria ⚖️):** Clientes, Honorários & Consultorias, Processos & Casos.
4. **`imobiliaria` (Imobiliária & Corretores 🏠):** Compradores & Locatários, Portfólio de Imóveis, Propostas & Visitas.
5. **`servicos` (Serviços & Assistência Técnica 🛠️):** Clientes, Ordens de Serviço, Orçamentos.
6. **`vendas` (Vendas & Varejo Geral 🛍️):** Clientes, Produtos & Estoque, Pedidos.

### 3.2. Estrutura de Armazenamento e Hooks
* O segmento ativo fica gravado em `organizations.settings.business_template` e o vocabulário em `organizations.settings.vocabulary`.
* **Server Action:** `app/actions/settings/applyBusinessTemplate.ts` aplica o template na organização e propaga para o assistente padrão.
* **Hook de Frontend:** `hooks/useBusinessVocabulary.ts` fornece o vocabulário ativo em tempo real (`vocab.contacts`, `vocab.products`, `vocab.deals`, etc.).
* **Tela de Configuração:** `/app/settings/template` (cadastrada no menu em `lib/navigation/catalogo.ts`).

### 3.3. Slots Estruturados para Serviços e Valores (Assistente de IA)
* Em vez de campos de texto livre solto, o assistente utiliza slots estruturados:
  ```ts
  service_items: Array<{
    id: string;
    name: string;
    price: string;
    description: string;
  }>
  ```
* O compilador `promptFromConfig()` em `lib/assistant/config-schema.ts` converte esses itens em uma tabela oficial de preços e serviços, garantindo respostas de alta precisão da IA para o WhatsApp.
* Interface de gerenciamento implementada em `app/app/assistant/_wizard.tsx`.

---

## 4. Infraestrutura & Guia de Deploy em Produção

### 4.1. Dados da Máquina de Produção
* **Domínio:** `crm.samtab.com.br`
* **Servidor (GCP):** Instância `n8n` (`34.28.175.242`), zona `us-central1-c`, projeto `kinetic-hydra-308322`.
* **Caminho da Aplicação:** `/opt/deskcommcrm`.
* **Chave SSH:** `/home/bilbo/.ssh/google_compute_engine`.
* **Usuário:** `bilbo@34.28.175.242`.

### 4.2. Rede Docker do Caddy
* O proxy reverso central da VPS roda no container `automation-caddy-1`.
* O container `deskcommcrm-app-1` **DEVE** estar conectado a duas redes:
  1. `internal` (comunicação com Redis, WAHA e Worker).
  2. `deskcomm_proxy` (rede externa compartilhada com o Caddy).
* O arquivo `docker-compose.prod.yml` já possui a declaração:
  ```yaml
  services:
    app:
      networks: [internal, deskcomm_proxy]

  networks:
    internal:
      driver: bridge
    deskcomm_proxy:
      external: true
  ```

### 4.3. Procedimento Padrão de Atualização na VPS
1. Conectar via SSH e puxar as novidades da branch `main`:
   ```bash
   cd /opt/deskcommcrm
   sudo git fetch origin main && sudo git reset --hard origin/main
   ```
2. Atualizar a tag da imagem no `/opt/deskcommcrm/.env`:
   ```bash
   sudo sed -i "s/APP_IMAGE=deskcommcrm-modular:.*/APP_IMAGE=deskcommcrm-modular:<HASH_COMMIT>/" .env
   ```
3. Reconstruir a imagem e subir o container:
   ```bash
   sudo docker compose -f docker-compose.prod.yml -f docker-compose.build.yml build app
   sudo docker compose -f docker-compose.prod.yml up -d --no-deps app
   ```
4. Testar o health check:
   ```bash
   curl -sI https://crm.samtab.com.br/login | head -n 3
   curl -s https://crm.samtab.com.br/api/v1/health
   ```
