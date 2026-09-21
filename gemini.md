# GEMINI.md — Configurações, Regras & Memória Antigravity

Este arquivo serve como contexto de memória e diretrizes de execução para o **Gemini / Antigravity CLI** ao operar no ecossistema e repositórios do usuário.

---

## 1. Regras do Usuário & Políticas do Sistema

O assistente e suas extensões devem sempre observar as regras configuradas em `~/.gemini/config/rules/`:

### 1.1. Autenticação Segura do Sistema (`authentication.md`)
* **Nunca** armazene ou requisite a senha do usuário em texto simples.
* Quando comandos exigirem privilégios de administrador/root (como `pacman` ou modificação de arquivos de sistema), **SEMPRE** use `pkexec <comando>` em vez de `sudo`.
* O `pkexec` aciona a interface gráfica `hyprpolkitagent` na tela para que o usuário informe sua senha de forma protegida.

### 1.2. Workflow Hyprland & Serpantinum (`hyprland-workflow.md`)
Quando interagir ou modificar o ambiente desktop do usuário (`~/.config/hypr/` ou `~/.config/serpantinum/`):
* **Show Desktop (`Super + D`):** Mostra o papel de parede limpo e oculta todas as janelas; acionado novamente, restaura o workspace anterior (`name:desktop`).
* **Alt+Tab (`cycle_next`):** Utiliza o ciclador de janelas nativo do Hyprland (sem switchers externos em Python/Rofi). Ao alternar a partir do desktop vazio, restaura o workspace ativo instantaneamente.
* **Auto-Maximize (`Super + Alt + F` / `fullscreen 1`):** Novas janelas devem abrir maximizadas (`fullscreen 1`) sem dividir a tela ou tremer foco. Ao usar Alt+Tab para janela não maximizada, maximizá-la automaticamente.
* **App Launcher (`Super + Space`):** Mantém retângulo de fundo fallback no delegate do `Launcher.qml` para prevenir bugs de texto invisível no `morphHighlight`.
* **Dock:** Flutuante e controlada pelas preferências do usuário em `settings.json`.

### 1.3. Otimização de Tokens & Deploy (`token-optimization-workflow.md`)
* **Local & GitHub First:** Toda modificação é feita e testada no repositório local e enviada ao GitHub antes de tocar a VPS de produção.
* **Economia Estrita:** Proibido rodar buscas amplas (`find /`, `grep` em pastas pesadas) ou inspecionar arquivos inteiros desnecessariamente.
* **Zero Polling Loops:** Jamais faça loops de `sleep` aguardando builds (`docker build`, `next build`). Suba as tarefas em segundo plano ou monitores autônomos.

---

## 2. Decisões de Arquitetura & Infraestrutura (DeskcommCRM)

### 2.1. Repositório e Branches
* **Repositório GitHub:** `https://github.com/higuinhoo/DeskcommCRM`
* **Branch Oficial:** `main` (tudo o que vai para produção deve estar comitado e testado na `main`).
* **Clones Locais:**
  * Workspace ativo de desenvolvimento: `.../work/source`
  * Clone na máquina do usuário: `~/Downloads/DeskcommCRM`

### 2.2. Servidor de Produção
* **IP / Host:** `34.28.175.242` (Instância `n8n`, GCP `us-central1-c`, projeto `kinetic-hydra-308322`).
* **Domínio Público:** `https://crm.samtab.com.br`
* **Diretório da Aplicação:** `/opt/deskcommcrm`
* **Acesso SSH:** `ssh -i ~/.ssh/google_compute_engine bilbo@34.28.175.242`
* **Arquitetura de Rede do Proxy:**
  * O Caddy principal roda no container `automation-caddy-1`.
  * O container `deskcommcrm-app-1` deve se comunicar pela rede bridge externa `deskcomm_proxy`.
  * O `docker-compose.prod.yml` conecta declarativamente o serviço `app` às redes `internal` e `deskcomm_proxy`.

### 2.3. Templates e Nomenclaturas por Segmento
* **Templates disponíveis:** Clínica (`clinica`), Barbearia (`barbearia`), Advocacia/Escritório (`escritorio`), Imobiliária (`imobiliaria`), Serviços (`servicos`), Vendas Gerais (`vendas`).
* **Configuração:** Gerenciada pela tela `/app/settings/template`, salva no banco em `organizations.settings.business_template` e `organizations.settings.vocabulary`.
* **Slots Dedicados:** Serviços e produtos não usam mais texto livre desordenado. São cadastrados como slots estruturados `{ name, price, description }` no assistente de IA (`/app/assistant`), compilando respostas exatas de catálogo e preços no WhatsApp.

### 2.4. Resiliência de Deploy (Independência do Computador Local)
* Ao disparar builds longos de Docker na VPS que possam ser interrompidos pelo fechamento do notebook do usuário, crie um script em background (`nohup /tmp/deploy-auto.sh > /tmp/deploy-auto.log 2>&1 & disown`).
* Isso garante que a VPS complete o build e suba o container mesmo se a sessão SSH cair ou o computador for desligado.
