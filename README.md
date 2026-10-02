# Cronograma de Lançamentos — Web conectado ao ClickUp

Sistema web (TypeScript + React + Tailwind + Node) que mostra o cronograma **planejado × real** dos projetos de lançamento. O **ClickUp é o banco de dados**: cada card é um projeto e o **status do card é a fase atual**.

```
┌──────────────┐   /api/...   ┌────────────────────┐   API v2 + token   ┌─────────┐
│  web (React) │ ───────────▶ │ server (Node/Expr.)│ ─────────────────▶ │ ClickUp │
│  Vite :5173  │              │ :3001              │                    └─────────┘
└──────────────┘              └────────────────────┘
                               guarda o token e o modelo de lead time
```

O navegador **nunca** vê o token do ClickUp: só o servidor Node fala com a API.

---

## Passo a passo

### 1. Instale as ferramentas (uma vez)

- **Node.js 20 ou mais novo (LTS)**: https://nodejs.org. Para conferir, rode `node -v` no terminal.
- **VS Code**: https://code.visualstudio.com. Extensões recomendadas: *Tailwind CSS IntelliSense*, *ESLint* e *Prettier*.
- **Git** (opcional, para versionar): https://git-scm.com.

### 2. Abra o projeto

Descompacte a pasta `cronograma-lancamentos` e abra-a no VS Code (**Arquivo → Abrir pasta**). Depois abra o terminal (**Terminal → Novo terminal**) e rode:

```bash
npm install
```

Esse comando instala tudo: servidor, web e ferramentas.

### 3. Teste primeiro sem ClickUp (modo demonstração)

```bash
npm run dev:demo
```

Abra **http://localhost:5173**. Vão aparecer 4 projetos de exemplo, o que confirma que a tela funciona. Para parar, use `Ctrl + C`.

### 4. Pegue o token do ClickUp

1. No ClickUp, clique no seu avatar → **Configurações** → **Apps**.
2. Em **API Token**, clique em **Gerar** e copie o valor (começa com `pk_`).

> O token dá acesso ao ClickUp **como você**. Não compartilhe e não suba o `.env` para o Git (ele já está no `.gitignore`).

### 5. Configure o `.env`

Copie `.env.example` para `.env`, na raiz do projeto, e cole o token:

```env
CLICKUP_TOKEN=pk_...
CLICKUP_LIST_ID=901329151000
PORT=3001
CACHE_SECONDS=60
```

### 6. Rode com os dados reais

```bash
npm run dev
```

- Web: **http://localhost:5173**
- Diagnóstico da API: **http://localhost:3001/api/saude** (deve mostrar `"ok": true`)

### 7. Colocar no ar para a equipe (produção)

```bash
npm run build     # gera web/dist
npm start         # um único servidor em http://localhost:3001 entrega a API e o site
```

Opções de hospedagem: um servidor interno da empresa com Node, ou serviços como Render, Railway ou Azure App Service. Nesses serviços, configure as mesmas variáveis do `.env` no painel. Se for aberto na internet, coloque login na frente (ex.: Microsoft/Entra ID). Veja *Próximas evoluções*.

---

## Como funciona

| O quê | Onde fica |
|---|---|
| Projetos, fase atual, campos (PVL, família, onda…) | ClickUp (lista `CLICKUP_LIST_ID`) |
| Datas reais de cada fase | Histórico de status do ClickUp (*Total time in Status*) |
| Prazo (timing) de cada fase | `server/data/modelo.json`, editado na tela ("Modelo de lead time") |
| Cálculo de planejado, projeção e desvio | `web/src/lib/calc.ts` |

**Regras de cálculo**

- **Planejado** = *Data de início* do card + prazos do modelo.
- **Real**: cada mudança de status é o fim real de uma fase e o início da próxima.
- O status em que o card **foi criado** não tem início real, porque o projeto já estava nessa fase antes de existir no ClickUp (exceto *Escopo*). Fases anteriores contam como concluídas, sem data.
- **Projeção**: a fase atual termina no fim previsto ou hoje (o que for mais tarde); as seguintes vêm em sequência.
- **Desvio** = conclusão projetada − conclusão planejada.

**Campos personalizados lidos** (arquivo `server/src/normalizar.ts`, constante `CAMPOS`):
`CÓDIGO PVL`, `FAMÍLIA`, `QUANTIDADE SUBITENS`, `ONDA - LANÇAMENTO`, `ANO LANÇAMENTO`, `DATA LANÇAMENTO META`, `DATA INÍCIO REAL`, `DATA CONCLUSÃO REAL`, `Forecast Inícial`, `IMAGEM PRODUTO` (tipo Anexo).
Se você renomear um campo no ClickUp, ajuste o nome ali.

**Status → fase** (arquivo `shared/modelo-padrao.ts`, propriedade `status` de cada fase). Se criar ou renomear um status no ClickUp, adicione o nome na fase correspondente. Status especiais: `backlog` (não iniciado) e `cancelado`.

---

## Telas (menu no topo)

| Aba | Para quê |
|---|---|
| **Cronograma** | Gantt planejado × real × projeção, por projeto (filtros no topo) |
| **Dashboards** | Farol (Atrasado / Atenção / No Prazo), projetos por fase, por responsável, por onda e por tipo |
| **Parâmetros** | Lead time de cada **Tipo de Projeto**, fase a fase |

## Tipos de projeto e lead time

O campo **Tipo de Projeto** do ClickUp define qual lead time o projeto usa:

| Tipo | Referência | Lead time padrão |
|---|---|---|
| Ampliação de Portfólio | 6 a 8 meses | 240 dias |
| Ampliação de Família | 12 meses | 307 dias |
| Nova Família | 12 a 24 meses | 367 dias |

- Os prazos ficam em **blocos**: fases do mesmo bloco correm juntas (as células mescladas da planilha — ex.: First Order + Em trânsito = 60 dias).
- Na aba **Parâmetros** você edita os dias, junta/separa fases e escolhe o **tipo padrão** (usado nos cards sem Tipo de Projeto).
- Tudo fica salvo em `server/data/modelo.json`. Um arquivo da versão antiga (lead time único) é trocado automaticamente pelo modelo por tipo.

## Estrutura

```
cronograma-lancamentos/
├─ .env.example            variáveis de ambiente (copie para .env)
├─ package.json            scripts: dev, dev:demo, build, start, typecheck
├─ shared/                 tipos e modelo padrão usados pelo servidor e pelo web
│  ├─ types.ts
│  └─ modelo-padrao.ts     fases, prazos, cores e status do ClickUp
├─ server/                 API em Node + Express
│  ├─ src/index.ts         rotas /api
│  ├─ src/clickup.ts       chamadas à API do ClickUp
│  ├─ src/normalizar.ts    tarefa do ClickUp → Projeto
│  ├─ src/modelo-store.ts  lê/salva server/data/modelo.json
│  └─ src/demo.ts          dados de exemplo (--demo)
└─ web/                    React + Vite + Tailwind
   └─ src/
      ├─ App.tsx
      ├─ lib/calc.ts       planejado × real × projeção
      ├─ lib/datas.ts
      ├─ lib/api.ts
      ├─ hooks/            useProjetos (relê a cada 2 min), useModelo
      └─ components/       Kpis, Funil, Filtros, Legenda, Gantt, ProjetoDrawer, ModeloPanel
```

## Rotas da API

| Método | Rota | Uso |
|---|---|---|
| GET | `/api/saude` | Confere configuração |
| GET | `/api/projetos` | Projetos (cache de 60 s; `?atualizar=1` força leitura) |
| GET | `/api/status` | Status da lista no ClickUp |
| GET / PUT | `/api/modelo` | Lê / salva o modelo de lead time |
| PATCH | `/api/projetos/:id/status` | Muda a fase do card no ClickUp (`{ "status": "marketing" }`) |
| GET | `/api/projetos/:id/imagem` | Foto do produto (campo IMAGEM PRODUTO; `?tam=p` = miniatura) |
| GET | `/api/projetos/:id/followups` | Follow-ups já registrados (lidos dos comentários do card) |
| POST | `/api/projetos/:id/followup` | Registra um follow-up como comentário no card (`{ "comentario": "..." }`) |
| GET / POST / DELETE | `/api/sessao` | Acesso: consulta, entra com a senha de edição (`{ "senha": "..." }`), sai |

## Problemas comuns

- **"Token do ClickUp inválido"**: confira o `.env` (sem espaços nem aspas) e reinicie o `npm run dev`.
- **Projeto aparece em "Backlog" mas tem fase**: o nome do status não está mapeado em `shared/modelo-padrao.ts`.
- **Datas reais não aparecem**: ative o ClickApp **Total time in Status** no espaço, e lembre que as datas só existem a partir da primeira mudança de status.
- **Porta ocupada**: troque `PORT` no `.env` e o `proxy` em `web/vite.config.ts`.

## Próximas evoluções sugeridas

1. **Login** (Microsoft Entra ID / Google) antes de publicar para a equipe.
2. **Webhook do ClickUp** (`taskStatusUpdated`) para atualizar na hora, em vez de a cada 2 min.
3. **Tela de Kanban** e **tela por analista**.
4. **Página de indicadores**: lead time real médio por fase, % no prazo, gargalos.
5. **Histórico do modelo**: guardar versões do lead time (240 × 285 × 342 dias).

## Fases dispensadas (projetos fora da curva)

Alguns projetos não passam por todas as fases (ex.: revisão sem amostra c/ arte e sem marketing; item sem amostra por custo de envio).

1. No ClickUp, crie na lista o campo **FASES DISPENSADAS**, tipo **Rótulos (Labels)**, com uma opção por fase, escrita igual ao nome da fase
   (ex.: `Aguardando amostra`, `Teste / Validação`, `Em trânsito amostra c/ arte`, `Marketing`…).
2. No card, marque as fases que não se aplicam.
3. O web:
   - tira essas fases do **planejado** e do **real** (no Gantt não aparecem barras; no detalhe aparecem riscadas como “não se aplica”);
   - se **todas** as fases de um bloco forem dispensadas, o prazo do bloco sai do lead time (ex.: sem amostra e sem teste em Ampl. Família → 307 − 20 − 20 = 267 d);
   - se só parte de um bloco paralelo for dispensada (ex.: Marketing, que corre junto com Envio 1º lote), o prazo do bloco continua pela outra fase.
4. Se um card pular fases no ClickUp **sem** elas estarem marcadas, o cronograma mostra **⚠ Pulou: …** para você decidir se marca como dispensada.

## Farol automático (Status do Projeto)

O servidor calcula o farol de cada projeto com o mesmo cálculo do cronograma e grava no campo **Status do Projeto** do ClickUp.

| Farol | Regra (editável na aba Parâmetros) |
|---|---|
| **Atrasado** | o real saiu do esperado: a fase atual passou do prazo **ou** a conclusão projetada ficou mais de *N* dias (tolerância, padrão 0) depois da planejada |
| **Atenção** | ainda no plano, mas a fase atual já usou *X*% do prazo (padrão 80%) |
| **No Prazo** | o resto |

- Backlog, concluídos e cancelados não são mexidos. Só grava quando o valor muda (fica no histórico de atividade do card).
- Começa **desligado**: na aba Parâmetros use **Ver prévia** para conferir o que mudaria, depois ligue e clique em **Atualizar ClickUp agora**.
- Ligado, o servidor recalcula ao iniciar e a cada `FAROL_MINUTOS` (padrão 30) enquanto o `npm run dev` estiver aberto.
- Para rodar sem deixar o site aberto: `npm run farol` (dá para agendar no Agendador de Tarefas do Windows, ex.: toda terça às 7h).

## Reprogramação da onda de lançamento

No detalhe do projeto, **Reprogramar onda** muda a onda/ano no ClickUp e deixa a evidência como comentário no card:

```
🔁 REPROGRAMAÇÃO DE LANÇAMENTO
🔹Data: 30/09/2026
🔹Onda inicial: ONDA 1 - 2027
🔹Nova onda: ONDA 3 - 2027
🔹Categoria: Atraso em Sourcing
🔹Motivo: Atraso em Sourcing, sendo assim será reprogramada a data de lançamento
```

- Motivo e categoria são obrigatórios; há uma tela de confirmação com o texto do comentário.
- Campos opcionais na lista (crie para ganhar o selo ↻ no cronograma e a tabela em Dashboards):
  **ONDA ORIGINAL** (texto curto — preenchido só na 1ª reprogramação) e **REPROGRAMAÇÕES** (número — soma 1 a cada vez).
- O histórico no web é lido dos comentários do card (mudar a onda direto no ClickUp não gera histórico).

## Imagem do produto

A foto de cada produto vem do campo **IMAGEM PRODUTO** (tipo *Anexo*) do card no ClickUp:

- aparece em miniatura na coluna da esquerda do **Cronograma** e no topo do **detalhe do projeto** (clique na foto para abrir em tamanho real);
- o servidor baixa a imagem do ClickUp e guarda em memória; o navegador só fala com o nosso servidor (rota `/api/projetos/:id/imagem`);
- com mais de uma imagem no campo, vale a anexada por último. Para trocar a foto, anexe a nova (e apague a antiga, se quiser);
- card sem imagem mostra um ícone cinza no lugar.

## Comentários de follow-up

No detalhe do projeto, abaixo de **Mover fase no ClickUp**, o botão **Acrescentar comentário** abre um campo para registrar o que foi combinado no follow-up com a pessoa. Depois de revisar, o web cria este comentário no card:

```
♦️DATA: 02/10/2026
♦️Comentário: texto digitado no follow-up
```

- A data é sempre a do dia do envio. Nenhum campo do card é alterado.
- Os follow-ups anteriores aparecem logo abaixo (os 3 mais recentes; "Ver todos" mostra o resto), lidos dos comentários do card que seguem esse padrão.
- Se o painel for fechado sem querer, o texto digitado continua lá ao reabrir o projeto (enquanto a página estiver aberta).

## Acesso: visualização × edição (senha)

Quem abre o web **só visualiza**: abas **Cronograma** e **Dashboards**, detalhe do projeto com imagem, datas, fases e históricos.
Para alterar, clique em **Entrar para editar** (no topo) e digite a senha de edição. Aí aparecem a aba **Parâmetros**, **Mover fase**, **Reprogramar onda** e **Acrescentar comentário**. O navegador lembra a senha por 30 dias; **Sair da edição** volta ao modo leitura.

**Definir a senha (uma vez, no seu PC):**

```bash
npm run senha
```

Digite a senha duas vezes (mínimo 6 caracteres). Ela fica embutida no projeto em `server/src/acesso.json`, **só como resumo criptográfico** (scrypt): quem abrir o arquivo não descobre a senha. Depois é só gerar o build/pacote normalmente — o servidor da empresa já sobe com a senha certa, sem o TI cadastrar nada. Para trocar, rode `npm run senha` de novo e gere o pacote de novo.

| Situação | O que acontece |
|---|---|
| `npm run dev` sem senha definida | tudo liberado, como antes |
| Com senha definida (dev ou servidor) | só leitura; a senha libera a edição |
| Servidor (`npm start` / Docker) sem senha definida | **só leitura para todos** |

- Opcional: a variável de ambiente `SENHA_EDICAO`, se existir, vale no lugar da senha embutida.
- O bloqueio é feito no servidor: toda chamada que altera algo (`POST`, `PUT`, `PATCH`, `DELETE` em `/api`) é recusada sem a senha, mesmo que alguém tente chamar a API direto.
- Trocar a senha derruba na hora todos os acessos de edição abertos.
- Após 5 senhas erradas em 1 minuto, o servidor pede para aguardar.
- O farol automático continua rodando no servidor, independente de quem está logado.

## Exportar PDF (por Onda)

Botão **Exportar PDF** no topo (também no modo leitura): escolha as ondas (as 2 mais próximas vêm marcadas), opcionalmente aplique os filtros da tela e clique em **Gerar PDF** → na janela de impressão, destino **Salvar como PDF** (A4 deitado).
O relatório traz números gerais, um bloco por onda (da mais próxima para a mais distante) e, por projeto: foto, PVL, **status proposto** (fase prevista para hoje pelo plano), **status real** (fase atual no ClickUp), **dias na etapa** (× prazo), **status da etapa**, farol e desvio.
#   C R O N O G R A M A - L A N C A M E N T O  
 