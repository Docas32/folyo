# Folyo

Fundação da plataforma de portfólios: app Next.js 15, roteador Hono em Cloudflare Workers, PostgreSQL Neon e dois buckets R2. F2 adiciona autenticação Google, termos, onboarding, dashboard e configurações. F3a adiciona o editor de blocos com autosave; F4 publica snapshots estáticos versionados via KV/R2.

## Requisitos e instalação

Antes de iniciar o app, preencha as variáveis Neon e Google descritas abaixo. Use Node.js 22+ e pnpm 10.28.2 (`corepack enable` e `corepack prepare pnpm@10.28.2 --activate`). Wrangler é uma dependência local; não requer instalação global. Para desenvolvimento, nenhuma conta Cloudflare é necessária.

```sh
cp .env.example .env
pnpm install
pnpm dev
```

O comando carrega `.env` na raiz e inicia Next na porta 3000 e Wrangler na 8787; Ctrl+C encerra ambos. Os defaults do Wrangler são `ROOT_DOMAIN=lvh.me` e `ENVIRONMENT=dev`. O launcher do edge passa essas duas variáveis de `.env` explicitamente como bindings Wrangler. Nunca versione arquivos com segredos.

Acesse http://localhost:3000 para o placeholder “Folyo”. `lvh.me` e seus subdomínios resolvem para loopback; os testes curl funcionam mesmo sem DNS externo:

```sh
curl -H 'Host: app.lvh.me' http://localhost:8787
curl -H 'Host: maria.lvh.me' http://localhost:8787
curl -i -H 'Host: lvh.me' http://localhost:8787
curl -i -H 'Host: www.lvh.me' http://localhost:8787
curl -i -H 'Host: desconhecido.example' http://localhost:8787
curl -H 'Host: app.lvh.me' http://localhost:8787/__dev/r2
```

Resultados: HTML Next, 404 neutro para Maria ainda não publicada, dois redirects 302 e um 404. No navegador use http://app.lvh.me:8787; o redirect preserva a porta local. O diagnóstico R2 responde `{"objects":[],"truncated":false}` inicialmente e lista até 100 objetos. Só está disponível no host do app em `dev`; nos outros ambientes a rota segue para o app.

## Neon e banco de dados

1. Crie uma conta em https://neon.tech e um projeto PostgreSQL. Escolha uma região próxima aos usuários e crie uma branch de desenvolvimento.
2. Em **Connect**, selecione banco/role e habilite **Connection pooling**. Copie a URL PostgreSQL com hostname `-pooler` e `sslmode=require` para `DATABASE_URL` em `.env`. Não use uma URL de produção em desenvolvimento.
3. Execute:

```sh
pnpm db:migrate
pnpm db:seed
```

A migration inicial cria `users`, `sites`, `pages`, `blocks`, `assets`, `publications`, `reports` e `reserved_handles`, com PKs, uniques, cascades e CHECK de handle. O seed insere os 26 handles reservados e pode ser repetido. Consulte as tabelas no SQL Editor do Neon. Para mudar o schema, edite `packages/db/src/schema.ts`, execute `pnpm db:generate`, revise o SQL gerado e execute `pnpm db:migrate`. Versione SQL, snapshot e journal juntos.

O client `createDb(databaseUrl)` é inicializado explicitamente com uma variável de servidor; importar o pacote não abre conexões nem exige credenciais no build. A URL é validada com Zod. Em Workers, configure o secret `DATABASE_URL` no web para as operações de conta.

## R2 e Workers

`apps/edge/wrangler.jsonc` declara `ASSETS_BUCKET` (uploads futuros), `SITES_BUCKET` (publicações futuras) e `WEB` (service binding para `folyo-web`). Wrangler/Miniflare mantém os buckets locais em `.wrangler/state`; não é preciso criar buckets remotos para rodar `pnpm dev`. Esse estado é ignorado pelo Git.

Para verificar também objetos não vazios, com o edge parado:

```sh
printf 'ok' > /tmp/folyo-r2-probe.txt
pnpm --filter @folyo/edge exec wrangler r2 object put folyo-published-sites/probe.txt --file /tmp/folyo-r2-probe.txt --local
pnpm dev
# Em outro terminal:
curl -H 'Host: app.lvh.me' http://localhost:8787/__dev/r2
```

Build sem deploy:

```sh
pnpm build
```

Isso executa `opennextjs-cloudflare build` (que chama `next build`) e empacota o edge com `wrangler deploy --dry-run`. O web gera `.open-next/worker.js` e `.open-next/assets`; o Worker usa `nodejs_compat`, assets estáticos e self binding do OpenNext. Não há ISR nem cache incremental R2 na F1. Os dois buckets do produto são compartilhados pelo edge e pelo web; F2 usa os bindings no web para excluir os arquivos da conta.

O script `pnpm --filter @folyo/web deploy` está preparado para build + `wrangler deploy`, mas a CI não publica nada. Para a futura configuração de produção, crie os dois buckets na conta Cloudflare, configure domínio/rotas no edge, altere `ROOT_DOMAIN` e `ENVIRONMENT` nos bindings do ambiente e mantenha `WEB.service` sincronizado com o nome do Worker web. Publique primeiro o web e depois o edge. Domínios publicados pertencem ao edge; o app é alcançado pelo service binding. Em `preview` e `prod`, nunca se usa localhost.

## Estrutura e próximas frentes

```text
apps/web       Next.js 15 App Router + OpenNext
apps/edge      Hono, dispatch por Host e serviço de snapshots KV/R2
packages/core  Zod, tipos, handles reservados e catálogo pt-BR
packages/db    Schema, client Neon, migrations e seed
.github        CI, sem deploy
```

- F2: auth, sessões e dashboard em `apps/web`; consumir `@folyo/db` no servidor.
- F3: editor e gerenciamento de páginas/blocos em `apps/web`.
- F4: renders compartilhados, preview e publicação estática versionada em KV/R2.
- F5: estender os dicionários em `apps/web/lib/i18n` e o catálogo de stubs em `packages/core`.

## Decisões técnicas

- Scripts pnpm e concurrently bastam para quatro workspaces; nenhum cache de build ou Turbo é necessário nesta etapa. Os pacotes internos exportam TypeScript e são transpilados pelos consumidores.
- Neon HTTP com `@neondatabase/serverless` evita sockets/pools persistentes por isolate. A URL pooled usa pooling do Neon; não existe pool TCP local. Transações interativas, se necessárias no editor, exigirão avaliar driver WebSocket/Hyperdrive. Consulte a [documentação Drizzle/Neon](https://orm.drizzle.team/docs/connect-neon).
- Schema mantém as colunas e nulabilidade especificadas. UUIDs têm `gen_random_uuid()` e timestamps têm `now()` para facilitar inserts. `updated_at` não atualiza automaticamente: a camada de escrita da F3 deverá defini-lo.
- Valores comentados de template/status/tipo são tipos TS e schemas Zod, sem acrescentar enums PostgreSQL ao schema oficial. F2–F4 deverão validar cada payload externo com Zod antes de persistir; `jsonb` flexível não representa um contrato de conteúdo do editor nesta etapa.
- Handles reservados são bloqueados pelo roteador e armazenados pelo seed; a criação/alteração de handle em F2 consulta a tabela, inclusive reservas futuras. F3 deve preservar esse contrato. Hosts com múltiplos subdomínios ou handles inválidos retornam 404.
- Redirects mantêm caminho/query e usam HTTPS fora de dev. O stub só interpola handles validados como ASCII seguro. O proxy preserva método/body e query; em produção usa exclusivamente service binding.
- OpenNext segue o [setup oficial](https://opennext.js.org/cloudflare/get-started). O desenvolvimento usa Next diretamente; F2 inicializa os bindings web via `initOpenNextCloudflareForDev`, com persistência no mesmo diretório R2 do edge. Não use runtime `edge` nas páginas do Next.

## Qualidade

```sh
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

ESLint e Prettier cobrem todos os workspaces; TypeScript é strict, com `noUncheckedIndexedAccess` e sem `any`. Vitest cobre os quatro caminhos de Host, proxy local, portas, hosts inválidos e isolamento do diagnóstico R2. CI roda install → lint → typecheck → test → build em PRs e pushes na main. Use commits convencionais (`feat:`, `fix:`, `chore:`).

## F2 — autenticação e conta

### Desenvolvimento e Google OAuth

O login em desenvolvimento roda **diretamente em http://localhost:3000**, sem passar pelo edge. Use esse hostname também depois de autenticar; os cookies de sessão de localhost não são compartilhados com `app.lvh.me`.

1. No Google Cloud Console, crie/selecione um projeto. Em **Google Auth Platform**, configure Branding/consentimento e Audience. Se o app estiver em modo Testing, cadastre seus usuários de teste.
2. Crie um OAuth client do tipo **Web application**. Cadastre a origem `http://localhost:3000` e o redirect URI **exato** `http://localhost:3000/api/auth/callback/google`.
3. Copie o client ID e secret para `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` no `.env` da raiz. Gere `AUTH_SECRET` com `openssl rand -base64 32`. Configure `AUTH_URL=http://localhost:3000`, `ROOT_DOMAIN=lvh.me`, `ENVIRONMENT=dev` e `DATABASE_URL` Neon. O arquivo `.env.example` contém as chaves; arquivos de credenciais Google baixados são ignorados pelo Git e pelo Prettier.
4. Instale dependências e aplique a migration F2 antes do primeiro login:

```sh
pnpm install
pnpm db:migrate
pnpm dev:auth
```

`pnpm dev:auth` carrega `.env` e sobe apenas Next. `pnpm dev` continua iniciando web e edge juntos e também carrega `.env`; para autenticar, acesse sempre a porta 3000 diretamente. Rodar o script do workspace web isoladamente não carrega o `.env` da raiz.

Em produção/preview configure `AUTH_URL` com a origem HTTPS do app, os três secrets Auth.js e `DATABASE_URL` como secrets do Worker web; configure `ROOT_DOMAIN` e `ENVIRONMENT` como bindings/variáveis. Cadastre o callback correspondente no Google. Com `nodejs_compat`, Cloudflare disponibiliza as variáveis de servidor em `process.env`; segredos nunca usam prefixo `NEXT_PUBLIC_`. `trustHost` exige que as requisições venham da infraestrutura de proxy/domínio configurada.

### Fluxo e contratos

Auth.js v5 usa Google e **sessões JWT**, sem adapter de database sessions. O primeiro login valida o perfil e exige e-mail verificado; faz upsert por `google_sub`. O idioma inicial usa o primeiro idioma de `Accept-Language`: português salva `pt-BR`, outros salvam `en`. Relogin atualiza nome/e-mail/avatar e preserva UUID, locale e aceite. O UUID do banco é gravado no JWT e exposto como `session.user.id`.

Depois do callback, `/post-login` verifica os dados atuais no banco e encaminha na ordem:

```text
sem aceite → /accept-terms
sem site   → /onboarding
com site   → /dashboard
```

O middleware verifica JWT para `/dashboard`, `/onboarding`, `/settings`, `/accept-terms`, `/editor` e `/post-login`. As próprias páginas consultam o banco e reforçam a ordem; possuir JWT não permite pular o aceite ou o onboarding. Um token de usuário excluído é rejeitado pelos guards e pelas APIs. A divisão entre configuração JWT do middleware e callbacks do servidor segue a [orientação de compatibilidade do Auth.js](https://authjs.dev/guides/edge-compatibility).

Todas as APIs mutantes exigem sessão, usuário existente, Origin da mesma origem e body Zod estrito. IDs de usuário/site enviados pelo cliente são rejeitados. O site sempre é buscado pelo UUID da sessão e os updates SQL também restringem o dono. Respostas de erro retornam códigos estáveis, traduzidos na UI; erros de infraestrutura não expõem queries ou credenciais.

| Endpoint                         | Contrato                                                                                                 |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `POST /api/account/accept-terms` | `{accepted:true}`; grava data do servidor e versão `2026-10-v1`, sem sobrescrever o primeiro aceite      |
| `GET /api/handle/check?handle=X` | `{available, reason?}`; invalid/reserved/taken; autenticado e com termos aceitos                         |
| `POST /api/onboarding`           | `{handle}`; site único por usuário, `draft`, template `blank`; 201 ou 409 se houver corrida de unicidade |
| `PATCH /api/site`                | `{title?,description?,handle?}`; título até 120, descrição até 300; exige site e termos                  |
| `DELETE /api/account`            | `{handle}`; confirmação do handle, limpeza R2, cascade no banco e encerramento da sessão                 |

Handles são normalizados com trim/lowercase, têm 3–30 caracteres ASCII alfanuméricos/hífens e não começam/terminam com hífen. O endpoint consulta tanto `sites` como `reserved_handles` e respeita as reservas compartilhadas. O client espera 300 ms e cancela consultas antigas. O CHECK original do banco continua compatível com F1; a restrição adicional de bordas é aplicada na fronteira Zod.

A troca de handle tem cooldown de exatamente sete dias após `handle_changed_at`. A primeira troca é livre; uma requisição bloqueada recebe `nextAllowedAt` em ISO UTC e a UI mostra a data no idioma do usuário. A condição do UPDATE usa compare-and-set e cutoff no banco para impedir que duas requisições simultâneas ignorem o prazo. Salvar título/descrição ou enviar o mesmo handle não reinicia o prazo. Não há redirect do handle anterior nesta frente.

O dashboard mostra status, handle e link `https://{handle}.{ROOT_DOMAIN}`, com clipboard e espaço `data-ad-slot="dashboard-top"` sem scripts. Esse link aponta para o stub do edge; em dev o link solicitado usa HTTPS, embora Wrangler local sirva HTTP — para verificar o stub localmente, use os exemplos curl da F1. `/editor` contém o editor de blocos da F3a.

Dicionários `getDictionary(locale)` em `apps/web/lib/i18n` cobrem todas as strings das novas telas, inclusive labels, mensagens e textos legais provisórios. O locale vem de `users.locale`, com fallback `en`. Não há next-intl; F5 pode estender essa camada.

### Exclusão e R2

O web declara os mesmos buckets R2 do edge. No desenvolvimento, `initOpenNextCloudflareForDev` usa `apps/edge/.wrangler/state/v3` para que a limpeza alcance os objetos locais também visíveis ao roteador. Em produção os bindings devem apontar para os mesmos buckets remotos.

A exclusão limpa **todos** os objetos dos prefixos `sites/{siteId}/` e `assets/{userId}/`, com paginação e lotes de até 1000 chaves. Depois usa `db.batch` Neon HTTP, que executa uma transação, para deletar o usuário; as FKs cascade removem seu site e registros relacionados. `reserved_handles` permanece global. Auth.js expira os cookies JWT na resposta e o client retorna a `/`.

R2 e PostgreSQL não podem participar da mesma transação. Por isso a limpeza R2 acontece primeiro: em caso de falha, o banco preserva IDs e a operação pode ser repetida. Uma falha parcial pode já ter removido parte dos arquivos. Uma futura frente com uploads/publicação concorrentes deverá coordenar essas escritas com exclusão de conta (por exemplo, estado de exclusão e job de limpeza); F2 não implementa essas escritas.

### Checklist manual

- [ ] Com uma conta Google nova, entrar e conferir um único registro `users` e locale correto.
- [ ] Tentar abrir `/dashboard`, `/settings` e `/onboarding` antes do aceite: voltar a `/accept-terms`.
- [ ] Abrir Termos/Privacidade, aceitar e conferir `terms_accepted_at` e `terms_version=2026-10-v1`.
- [ ] No onboarding testar disponível, inválido (`-abc`), reservado (`app`) e em uso; testar espaços/maiúsculas e criação `draft`/`blank`.
- [ ] No dashboard conferir link com `ROOT_DOMAIN`, copiar, abrir Configurações e o stub do editor.
- [ ] Salvar título/descrição, atualizar a página e conferir persistência.
- [ ] Trocar handle uma vez; a próxima troca deve informar a data após sete dias, mas metadados continuam editáveis.
- [ ] Sair e relogar: pular termos/onboarding e voltar ao dashboard, mantendo o mesmo UUID e site.
- [ ] Sem sessão, páginas privadas voltam a `/` e APIs retornam 401; sem Origin correto, mutações retornam 403.
- [ ] Em uma conta de teste descartável, abrir exclusão: confirmação errada bloqueia; confirmação correta remove registros, limpa os dois prefixos e volta ao início sem sessão.

F1 e F2 foram validadas E2E no projeto antes desta frente. O checklist acima permanece como referência para regressões de autenticação e conta.

## F3b — drag & drop, comando "/" e atalhos markdown

### Decisões técnicas

- **Drag & drop**: Usa `@dnd-kit/core` + `@dnd-kit/sortable` com sensor de ponteiro e sensor de teclado habilitado. O handle de arraste (⠿) fica visível no hover dos cards e a reordenação otimista é aplicada apenas na soltura; o autosave existente mantém debounce pós-drop (sem enfileirar saves intermediários). A lógica de reordenação usa função pura `arrayMove` em `packages/core/src/array-move.ts`, testável sem DOM.
- **Comando "/"**: Em um bloco de texto vazio, digitar "/" no início abre o mesmo componente `BlockTypeMenu` (reutilizado de F3a), com filtro por nome/tipo (case-insensitive, substring), navegação por teclado (↑/↓/Enter/Esc), seleção que converte o bloco atual ou insere abaixo, foco no primeiro campo do novo bloco e fechamento ao clicar fora (limpando "/").
- **Atalhos markdown**: Parser puro `parseMarkdownShortcut` em `packages/core/src/markdown-parser.ts` consome o texto no início de um bloco de texto vazio: `"# "` → heading 1, `"## "` → heading 2, `"### "` → heading 3 (restante vai para o texto do heading); `"- "` e `"> "` mantêm o prefixo no conteúdo (comportamento documentado para que F4 trate linhas iniciadas por `- ` como lista e `"> "` como citação). Só dispara com prefixo exato + espaço.
- **Layout do shell (padrão Notion)**: sidebar e topbar ficam permanentemente visíveis e apenas o canvas rola. `.editor-layout` é o grid de duas colunas com `height: 100dvh` e `overflow: hidden`; dentro dele, `.sidebar` (220px, `overflow-y: auto`, rolagem própria e independente) e `.editor-main` (`flex-direction: column`, `overflow: hidden`). O único elemento rolável da página é `.editor-canvas-scroll` (`flex: 1; min-height: 0; overflow-y: auto`), que envolve o `fieldset.editor-canvas`; o `.editor-topbar` é `flex-shrink: 0`, irmão do scroller, portanto não rola. `html`/`body` recebem `height: 100%; overflow: hidden` via `html:has(.editor-layout)`, sem JavaScript e já no SSR — um seletor `:has()` puro evita o flash de janela rolável antes da hidratação, ao contrário de alternar classe em `<body>` por efeito. Como o `.editor-canvas-scroll` passa a ser o ancestral rolável dos cards, o autoScroll do dnd-kit passa a rolar o canvas (e não a janela) ao arrastar para as bordas superior/inferior, sem configuração adicional. O menu ⋯ das páginas é posicionado no viewport via `getBoundingClientRect`, então não consegue acompanhar o canvas rolando por baixo: ele fecha no `scroll` do `.editor-canvas-scroll` em vez de ficar deslocado. Os testes estruturais em `apps/web/components/editor/editor-layout.test.tsx` travam esse contrato.

## F3a — editor de blocos e autosave

Depois do onboarding, abra `/editor` diretamente no Next (`pnpm dev:auth`, porta 3000). Não há nova migration nesta frente: as tabelas `pages` e `blocks` da F1 já possuem as colunas necessárias.

No primeiro acesso, o servidor cria a página **Início** (`inicio`) para `pt-BR`, ou **Home** (`home`) nos demais locales, e um hero com placeholders. A página SSR e `GET /api/editor` usam a mesma função de bootstrap. A operação usa uma transação Neon HTTP (`db.batch`), com `pg_advisory_xact_lock` por site e INSERT condicional. O hero só é inserido a partir da página recém-criada; chamadas simultâneas não duplicam a página e remover todos os blocos não faz o hero reaparecer no reload.

### Contrato compartilhado

`packages/core/src/blocks.ts` exporta os nove schemas de conteúdo, `blockContentSchema` (union discriminada `{type, content}`), `BlockType`, os tipos inferidos e a validação do envelope de salvamento. Editor, API e futuro renderizador F4 devem importar esses schemas; não crie validadores paralelos. `createDefaultBlock(type, locale)` retorna o conteúdo do tipo com placeholders localizados, compartilhados com os dicionários web por `getBlockPlaceholders`.

- hero, heading e text: texto simples; o editor nunca interpreta HTML.
- image e gallery: uploads R2 e URLs externas com preview. Galeria: 1–12 itens.
- button: texto, URL e estilo primary/outline.
- social: 1–10 links, com plataforma e string de URL, incluindo email/WhatsApp.
- divider: objeto estritamente vazio; spacer: tamanho sm/md/lg.

URLs de imagens, avatar e botão devem ser HTTP(S), além de URLs válidas. Protocolos como `javascript:` e `data:` são rejeitados pelo schema compartilhado. As URLs sociais permanecem strings conforme o contrato; F4 deve escolher protocolos seguros por plataforma antes de renderizá-las como links. Imagens de exemplo usam `placehold.co`; os demais links de exemplo usam `example.com`. O preview usa `referrerPolicy="no-referrer"` e informa falhas de carregamento.

### API e persistência

| Endpoint                         | Contrato                                                                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/editor`                | `{site, pages, blocks}`: resumo do site (id, title, handle, status), páginas ordenadas e blocos de todas as páginas (cada bloco inclui `pageId`); `Cache-Control: no-store` |
| `PUT /api/pages/[pageId]/blocks` | `{blocks:[{id,type,content,position}]}`, com UUIDs distintos, até 100 blocos e `position` igual ao índice no array; retorna `{ok:true,savedAt}` em ISO UTC                  |

Ambas as APIs exigem sessão, conta existente, termos e site. Ownership é verificado no servidor; um site cujo dono não coincide com a sessão retorna 403, e página inexistente/de outro site retorna 404. O PUT também exige Origin da mesma origem. Conteúdo inválido retorna 400 com `issues:[{path,code}]`, por exemplo `['blocks',0,'content','url']`. IDs de usuário/site e outras propriedades extras no body são rejeitados.

Cada save adquire o mesmo advisory lock do bootstrap e faz **delete + insert da lista completa** em uma única transação, atualizando `sites.updated_at` pelo relógio PostgreSQL. IDs de blocos de outra página não são usados para upsert: uma colisão de PK causa rollback, sem mover ou apagar blocos alheios. Uma lista vazia apaga todos os blocos da página. A primeira página é escolhida por `position`, com `id` como desempate.

Essa escolha mantém o MVP simples, preserva os UUIDs enviados e evita posições parcialmente atualizadas. O lock serializa saves e leituras do editor por site. Entre abas/dispositivos, vence a última transação concluída; não há merge de edições concorrentes. F3b e futuras escritas de páginas devem respeitar o mesmo lock `editor:{siteId}`. Veja [batch Neon/Drizzle](https://orm.drizzle.team/docs/batch-api) e [advisory locks PostgreSQL](https://www.postgresql.org/docs/current/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS).

### Comportamento do editor

A paleta inclui ícone, nome e descrição dos nove tipos, ao final da lista e nos espaços entre blocos. `BlockTypeMenu` em `apps/web/components/editor/block-menu.tsx` é independente do trigger/posição e pode ser reutilizado pelo comando `/` na F3b. Controles de seta/exclusão aparecem no hover, no foco de teclado e em dispositivos de toque. A exclusão oferece desfazer do último bloco por cinco segundos, inclusive se o delete já tiver sido salvo.

As alterações são validadas pelos schemas core e entram em uma fila de autosave com debounce de **1,5 segundo**. A fila envia só uma requisição por vez, conserva a revisão válida mais recente e não marca edições novas como salvas ao receber uma resposta antiga. Saves sobrepostos são encadeados. Bloco inválido fica com borda vermelha e o indicador informa seu número; nenhuma lista inválida é enviada. Os estados incluem alterações pendentes, Salvando…, Salvo HH:MM e erro com retry manual. Erros de rede preservam o conteúdo local.

O link de volta ao dashboard aguarda o flush das alterações válidas; em erro ou conteúdo inválido, permanece no editor para correção/retry. Ao fechar/recarregar com alterações pendentes, o navegador pode oferecer seu aviso nativo. Não há persistência local offline: o estado após reload vem do último save confirmado no banco.

### Validação e checklist F3a

Testes Vitest cobrem conteúdo válido/inválido por tipo e limites, defaults em ambos os idiomas, envelope completo, PUT com DB mockado (sucesso, validação, sessão/termos, ownership e página estrangeira), plano transacional, bootstrap simultâneo com DB mockado e preservação de página vazia. A fila tem testes com timers e Promises controladas para debounce, sobrescrita da revisão pendente, resposta antiga, conteúdo inválido, falha/retry e flush. Os 116 testes anteriores permanecem na suíte. Na validação desta entrega, os **196 testes**, ESLint e typecheck de todos os workspaces passaram. O build OpenNext e o empacotamento dry-run do edge também concluíram.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

- [ ] Abrir `/editor` em uma conta sem páginas: conferir Início/Home e hero; carregar em duas abas e confirmar uma única página/bloco inicial.
- [ ] Adicionar cada tipo pelo menu final e pelo menu entre blocos; editar campos e conferir os previews externos.
- [ ] Mover com ↑/↓, aguardar Salvo HH:MM e recarregar; conferir conteúdo e ordem.
- [ ] Excluir um bloco e desfazer em até cinco segundos; excluir todos, aguardar save e recarregar para conferir o empty state.
- [ ] Apagar nome do hero ou usar URL inválida: conferir borda/indicador e ausência de PUT; corrigir e conferir autosave.
- [ ] Simular offline no navegador, editar, conferir erro, voltar online e usar retry; conferir o conteúdo após reload.
- [ ] Com rede lenta, editar durante um save; conferir que o último estado persiste e a resposta anterior não sinaliza save completo.
- [ ] Confirmar que PUT para página de outra conta retorna 404 e que payload inválido retorna 400 com path.

A validação automatizada de bootstrap e persistência nesta entrega usa DB mockado; o checklist de navegador/Neon acima não foi executado neste ambiente.

O MVP não implementa templates, publicação ou renderização pública nesta frente.

## F3c — uploads R2 e gerência de páginas

### Upload — configuração e diagnóstico

As três variáveis são obrigatórias no `.env` da **raiz**:

```dotenv
R2_ACCOUNT_ID=ID_DA_CONTA_CLOUDFLARE_32_HEX
R2_ACCESS_KEY_ID=ACCESS_KEY_ID_DO_TOKEN_S3_R2
R2_SECRET_ACCESS_KEY=SECRET_ACCESS_KEY_DO_TOKEN_S3_R2
```

Use credenciais **S3 do R2**, com leitura/escrita de objetos no bucket existente `folyo-assets`; um API token genérico da Cloudflare não substitui esse par de chaves. Em produção configure as mesmas variáveis como secrets do Worker web. Não use `NEXT_PUBLIC_`.

`pnpm dev:auth` e `pnpm dev` carregam o `.env` da raiz por dotenv **somente no boot**. Depois de editar esse arquivo, encerre o processo inteiro com Ctrl+C e reinicie `pnpm dev:auth` (ou `pnpm dev`). Hot reload do Next não recarrega o ambiente injetado por dotenv. Executar apenas `pnpm --filter @folyo/web dev` não carrega esse `.env` da raiz. O probe roda em um novo processo e lê o arquivo atualizado; portanto probe OK com dev falhando pode indicar processo dev antigo ou iniciado pelo comando errado. A limpeza de fixtures de teste não altera `.env` nem revoga credenciais.

Para testar o mesmo cliente **aws4fetch** usado em `/api/upload`, execute na raiz:

```sh
pnpm storage:probe
```

Esse comando carrega `.env`, envia um PNG de 1px com UUID exclusivo ao bucket `folyo-assets`, lê e compara os bytes e remove apenas esse objeto. Não cria registros no banco. Sucesso termina com código 0:

```text
[r2-probe] PUT OK {"bucket":"folyo-assets","key":"assets/<uuid>/<uuid>.png"}
[r2-probe] GET OK
[r2-probe] DELETE OK (temporary object removed)
```

Falha termina com código 1 e `[r2-probe] failure`: `fields` identifica configuração ausente/inválida, `upstreamStatus` e `responseBody` mostram a resposta sanitizada do R2, ou `causeCode` identifica rede/DNS sem resposta HTTP. Se DELETE falhar, há também `[r2-probe] cleanup failure` com a key que precisa ser removida. O probe nunca lista valores de credenciais nem headers assinados.

No terminal do dev, um upload completamente salvo gera:

```text
[upload] success {"status":201,"key":"assets/<userId>/<uuid>.webp","assetId":"<uuid>","mime":"image/webp","size":12345}
POST /api/upload 201 ...
```

Credencial incorreta/permissão insuficiente pode gerar um HTTP 403 do R2 (o código XML exato depende da falha):

```text
[upload] failure {"stage":"storage-put","key":"assets/<userId>/<uuid>.webp","status":503,"cause":"Object storage unavailable","method":"PUT","upstreamStatus":403,"responseBody":"<Error><Code>SignatureDoesNotMatch</Code>...</Error>","causeCode":null}
POST /api/upload 503 ...
```

O PUT envia `Content-Length` explicitamente com `body.byteLength`: R2 exige esse header, e os adapters fetch do Next/Workers podem não inferi-lo. Uma resposta 411 `MissingContentLength` indica ausência desse header, não rejeição de credenciais.

O body real permanece no log com campos sensíveis removidos e limite de 4096 caracteres. `SignatureDoesNotMatch`, `InvalidAccessKeyId`, `AccessDenied` e `NoSuchBucket` distinguem assinatura, chave, permissão e bucket, respectivamente. Sem resposta HTTP, `upstreamStatus`/`responseBody` são null; examine `causeCode` e `causeMessage`.

Configuração ausente/inválida aparece como `[upload] failure` com `stage: "storage-config"`, `cause: "R2 configuration missing or invalid"` e `fields: [{name: "R2_SECRET_ACCESS_KEY", reason: "missing"}]`, sem valores. Retorna 503 `{error:"storageConfig"}`; indisponibilidade/rejeição do storage retorna 503 `{error:"storageUnavailable"}`. **No upload, 503 fica reservado a storage/configuração R2**. Falha de persistência no banco retorna 500 `{error:"uploadPersistenceFailed"}` com `stage: "asset-insert"`; falhas inesperadas de outras etapas retornam 500 `{error:"uploadFailed"}`. Validação/auth preservam 400/401/403/413/415 e também são logadas. Falha de compensação gera um log independente `storage-cleanup`, preservando a resposta da falha original. A UI continua exibindo mensagem genérica; detalhes de infraestrutura ficam apenas no servidor.

### Storage e imagens

Configure `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` no `.env` local e como secrets no Worker web. O bucket remoto existente é **folyo-assets**. O cliente `@folyo/db/storage` usa [aws4fetch](https://github.com/mhart/aws4fetch), assinatura SigV4 (`service: s3`, `region: auto`) e o endpoint `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com/folyo-assets`. Usamos a [API S3 do R2](https://developers.cloudflare.com/r2/api/s3/api/) em Node e Workers para executar o mesmo código contra o mesmo bucket em dev e produção. Upload/leitura/limpeza de assets não dependem de binding R2 nem do emulador local. O binding de sites da F2 continua atendendo a limpeza do prefixo de publicações; publicação permanece fora desta frente.

`POST /api/upload` recebe multipart `file`, `width`, `height`, `alt`. Exige sessão e usuário existente, Origin da mesma origem, MIME JPEG/PNG/WebP, arquivo não vazio com até 5 MiB e metadata validada pelos schemas core. O objeto recebe a key `assets/{userId}/{uuid}.{ext}`, e a tabela `assets` registra MIME, bytes, dimensões finais informadas pelo client e alt inicial. Retorna `{url, assetId}`, com URL relativa `/api/assets/assets/{userId}/{uuid}.{ext}`. Falha de storage não insere metadata; falha do insert tenta remover o objeto como compensação. Não há transação distribuída entre R2 e Neon.

`GET /api/assets/[...key]` aceita somente keys de imagem desse namespace, transmite o body do R2, mantém o MIME e retorna `Cache-Control: public, max-age=31536000, immutable` e `X-Content-Type-Options: nosniff`. É público por design, sem sessão/ownership, para uso futuro em sites publicados. Objeto ausente retorna 404. URLs relativas são aceitas apenas nos campos de imagem/galeria; links de botão e avatar mantêm os contratos anteriores. Novos uploads usam UUIDs e nunca sobrescrevem uma imagem existente, compatível com cache immutable.

O `ImageUploader` é reutilizado no bloco image e em cada item gallery. Canvas limita o maior lado a 1600px, mantém proporção e usa WebP a quality 0.85. PNG pequeno (até 1 MiB, sem resize) mantém o original; PNG com transparência mantém PNG após resize. Por isso PNGs transparentes podem ficar maiores que JPEGs equivalentes; o limite final continua sendo 5 MiB. O nome do arquivo fornece alt inicial editável. Compressão acontece **antes** do limite do upload, permitindo selecionar JPEGs maiores que 5 MiB. O componente informa compressão/envio/nome/tamanho, permite retry manual reutilizando o arquivo comprimido e preserva o input de URL externa. Navegação entre páginas fica desabilitada durante compressão/envio.

A exclusão de conta limpa o prefixo remoto `assets/{userId}/` pela mesma API S3, com paginação, antes do cascade no banco. Isso substitui a limpeza do antigo bucket local de assets da F2. Uploads simultâneos com exclusão de conta ainda exigiriam coordenação distribuída futura; o MVP não fornece merge entre abas/dispositivos.

### Páginas e autosave

Não há migration: as tabelas `pages`, `blocks` e `assets` da F1 já suportam os campos usados. `MAX_PAGES = 5` e os payloads Zod ficam em `packages/core`.

| Endpoint                     | Contrato                                                                  |
| ---------------------------- | ------------------------------------------------------------------------- |
| `POST /api/pages`            | `{title}`; 201 com página e zero blocos; 400 na sexta página              |
| `PATCH /api/pages/[pageId]`  | `{title}`; renomeia somente título                                        |
| `DELETE /api/pages/[pageId]` | exclui com cascade dos blocos; 400 para a única página                    |
| `PUT /api/pages/reorder`     | `{pageIds}`; exige permutação exata sem duplicatas                        |
| `GET /api/editor`            | `{site, pages, blocks}`; páginas ordenadas e todos os blocos com `pageId` |

Todas as mutações exigem sessão, termos, site/ownership e Origin. IDs de páginas externas retornam 404 antes da validação do conteúdo. Títulos têm 1–120 caracteres após trim. Slugs são gerados por slugify (acentos removidos, lowercase, hífens, fallback `page`) com sufixos `-2`, `-3` etc. **Slug é imutável após criação**: renomear o título não pode quebrar links publicados. O primeiro slug de bootstrap continua localizado (`inicio`/`home`).

Criação, rename, delete, reorder, bootstrap e save compartilham `pg_advisory_xact_lock` de `editor:{siteId}` dentro de `db.batch`. O limite de cinco, a busca de slug livre, a proteção da única página e a validação da permutação são executados no banco depois de adquirir o lock. Reorder atualiza todas as posições em um único UPDATE transacional; listas incompletas não alteram nada.

A sidebar destaca a página ativa, oferece criação/rename e confirmação modal de exclusão definitiva (sem undo), e reordena com setas. O botão de criação fica desabilitado no limite com tooltip. Cada página mantém seus blocos no estado client. Antes de trocar/criar/excluir, o editor aguarda `AutosaveQueue.flush()` da página ativa; falha ou conteúdo inválido bloqueia a navegação e mostra erro. O canvas fica desabilitado durante a operação para impedir edições enquanto a página é trocada. O PUT continua enviando apenas blocos da página ativa, sem `pageId` no body. Uma página criada vazia usa o empty state já existente. Entre abas, continua valendo a última transação concluída.

### Validação F3c

Nesta entrega passaram `pnpm lint`, `pnpm typecheck`, os **268 testes em 24 arquivos** (incluindo os 222 anteriores) e `pnpm build` (OpenNext web e dry-run do Worker edge).

Vitest cobre upload com storage/DB mockados, auth, MIME/tamanho/metadata, compensação, leitura pública/cache, regras de páginas, planos SQL transacionais, schemas e assinatura real do cliente S3 com fetch mockado. RTL monta o editor com duas páginas e uma resposta PUT atrasada: verifica exatamente uma requisição antes da troca, ausência de troca antecipada, retorno ao conteúdo editado, bloqueio em erro/validação e limite da sidebar. A validação com Neon/R2 reais usou uma conta temporária e confirmou upload/leitura, registro em assets, headers da rota pública, persistência da URL ao recarregar, criação concorrente, slugs únicos, limite de cinco, rename, reorder e cascade; a conta e o objeto foram removidos ao final. Testes do uploader verificam metadata pós-compressão e retry; testes de canvas verificam escala/quality/preservação PNG (a codificação é mockada, não um benchmark de compressão real).

Checklist de navegador:

- [ ] Enviar JPEG de 8 MB; conferir dimensões finais ≤1600px, tamanho reduzido, preview, alt editável e persistência após reload.
- [ ] Enviar PNG transparente e imagens para múltiplos itens gallery; misturar upload e URL externa.
- [ ] Conferir objeto no bucket folyo-assets e linha em assets; abrir URL sem sessão e conferir cache immutable.
- [ ] Criar até cinco páginas, testar tooltip, rename mantendo slug, setas e delete confirmado; a única página não pode ser excluída.
- [ ] Editar e trocar antes do debounce; conferir PUT antes da troca e texto ao voltar. Simular erro de rede: manter página/conteúdo e informar bloqueio.

### UX da sidebar de páginas

A sidebar usa uma lista compacta: título com ellipsis, linha ativa destacada e ações sob demanda no menu `⋯`. O botão de opções aparece no hover, na página ativa, no foco de teclado e em dispositivos touch; clicar nele não troca de página. O menu reutiliza os handlers da F3c para rename, reorder e delete, sem alterar APIs, schemas, slug, limite de cinco páginas ou flush do autosave.

`Renomear` vira input inline com título atual focado/selecionado: Enter ou blur confirma uma única vez, Esc cancela e título vazio/falha de rede mostra erro junto ao campo (sem alerta global). A exclusão continua exigindo o modal de confirmação, sem undo. Ações de mover para cima/baixo ficam ausentes nas extremidades. `+ Nova página` permanece no rodapé com tooltip no limite.

As linhas navegam com ↑/↓/Home/End; Tab alcança `⋯`, Enter/Space abre o menu, ↑/↓ no botão abre no primeiro/último item, e Shift+F10 abre a partir da linha. O dropdown tem roles menu/menuitem, setas com retorno circular, Home/End, fechamento por Esc/clique-fora e restauração de foco ao botão ⋯ após fechamento (rename mantém foco no input e exclusão da página usa a linha sobrevivente). Tab fecha o menu e continua a navegação. Os rótulos acessíveis incluem o título da página e vêm dos dicionários pt-BR/en. Cores usam a paleta A global; a edição inline WYSIWYG continua reservada à F4.

RTL cobre menu, ações, limites, foco/teclado, rename por Enter/blur, cancelamento por Esc, erro inline e confirmação de delete. A integração verifica PATCH de rename sem PUT extra e mantém o teste do único PUT pendente antes da troca de página.

### Paleta A global e renderização do editor

`apps/web/app/globals.css` define a paleta A para todo o app: `--ink`, `--paper`,
`--coral`, `--coral-hover`, `--gray-100`, `--gray-500`, `--gray-700`, `--border`,
`--danger` e `--radius` (8px). `--surface` é o branco dos cards/dropdowns; estados
neutros e sombras derivam desses tokens. Os aliases `--app-*` apontam à mesma paleta.
Editor, dashboard, settings, onboarding e termos compartilham esses estilos.
Botões são neutros por padrão; `.button-primary` reserva coral ao CTA principal
(Adicionar hero no editor vazio). Inter é carregada e hospedada por `next/font`,
com fallback system-ui; não há requisição de fonte ao Google no navegador.

O componente raiz `Editor` renderiza apenas um skeleton no servidor e no primeiro
render do cliente. Após o mount, inicia o editor completo com dnd-kit, evitando
comparar IDs `DndDescribedBy-*` entre SSR e hidratação. O skeleton usa as mesmas
colunas e espaçamentos do editor. APIs, autosave, formulários de blocos e regras de
páginas permanecem intactos; WYSIWYG depende do renderizador da F4.

O dropdown de páginas usa coordenadas fixas e `getMenuPosition` puro com dimensões
explícitas do viewport: direita com gap de 8px, flip à esquerda e clamp nos dois
eixos. CSS limita o menu ao viewport, com scroll em janelas menores que o conteúdo,
itens nowrap e recálculo em resize/scroll. A sidebar oculta permanece inert e sem
menu visível; ao reabrir, as coordenadas são atualizadas.

### Coleta diferida de assets

Ao salvar blocos ou excluir uma página, a mesma transação recalcula referências de
**todas** as páginas do usuário. Assets sem referência recebem `orphaned_at`, sem
apagar o objeto R2; reanexar ou desfazer restaura `NULL`. Isso protege undo e imagens
compartilhadas. Exclusão de conta mantém a limpeza imediata de todos os objetos e o
cascade das linhas de assets (sem órfãos residuais).

Aplique as migrations com `pnpm db:migrate`. Configure `CRON_SECRET` e
`GC_GRACE_DAYS` (padrão 7, número positivo). Em desenvolvimento:

```sh
curl -X POST http://localhost:3000/api/cron/assets-gc \
  -H "Authorization: Bearer $CRON_SECRET"
```

O endpoint retorna `{deleted, keys}` e remove primeiro o objeto R2, depois a linha.
Falhas individuais são registradas e tentadas novamente na próxima execução;
objetos já ausentes são tratados como sucesso. Só assets órfãos anteriores à janela
são elegíveis. Em produção, agendar via cron-job.org ou Cloudflare Cron Trigger
chamando o endpoint com o bearer token; a escolha do scheduler fica adiada.

**F4b:** a versão publicada atual e snapshots em preparação protegem suas keys
via `publications.assets_keys` e `publication_operations`. Veja o protocolo abaixo.

### F4a — render compartilhado e preview do rascunho

Os componentes ficam em `apps/web/components/render`, próximos ao consumidor Next
atual. Não dependem de Next, sessão, banco, estado de cliente ou hooks do editor;
`index.ts` exporta os nove renders, `BlockRender`, `SiteRender` e `SITE_CSS`.
Essa mesma implementação deve gerar o HTML publicado na F4b e compor o canvas da F5.
Não criar uma segunda implementação de markup ou estilos para publicação.

Contrato por bloco: `{ content: ContentByType[T], theme: Theme }`, usando os schemas
Zod de `@folyo/core`. `BlockRender` recebe `{ block: BlockContent, theme }`.
`SiteRender` recebe somente dados serializáveis: tema armazenado, locale, páginas
ordenadas `{id,title,slug}`, `activePageId`, blocos da página ordenados com `id`,
`basePath`, `appUrl` e `chrome: {navigation,madeWith}` do dicionário do dono.
Para o preview, `basePath=/p/<siteId>` e `appUrl=/`; na publicação, usar `basePath=''`
e a URL absoluta da raiz do app. A primeira página é home; a URL sem slug a seleciona.
A navegação usa os mesmos slugs em ambos os contextos e desaparece com uma só página.
A F4b pode chamar `renderToStaticMarkup(<SiteRender {...props} />)` sem cliente React.
`SITE_CSS` já é incluído como CSS estático pelo wrapper, com escopo `.folyo-site`.

`themeSchema`, `resolveTheme` e `themeToCssVars` ficam em `packages/core/src/theme.ts`.
Temas inválidos retornam integralmente ao default blank. `themeToStyle` fornece as
mesmas variáveis para o style inline do React. As fontes Inter, Lora, Playfair Display
e Source Sans 3 são carregadas por `next/font` no preview (Inter no layout raiz).
A F4b deve incluir as mesmas fontes e definir `--font-inter`, `--font-lora`,
`--font-playfair`, `--font-source-sans` no HTML estático; os valores gerados pelo tema
possuem fallback nominal. O contraste do texto do botão primário acompanha o accent.

`/p/[siteId]/[[...slug]]` lê o banco em cada request, sem exigir sessão ou gerar
publicação/snapshot. Dashboard e editor abrem `/p/<siteId>` em nova aba, usando o
rascunho já persistido pelo autosave. Não há save extra ao abrir o preview. A rota
usa title/description do site e metadata `robots: noindex,nofollow`.
As consultas são limitadas ao site solicitado e projetam somente os campos públicos
necessários, incluindo o idioma do dono; o rodapé não expõe dados da conta.

Texto é renderizado com nós React escapados, sem `dangerouslySetInnerHTML`; o parser
aceita parágrafos, listas `- `, citações `> `, `**negrito**` e `*itálico*`.
Links sociais aceitam HTTP(S), e `mailto:` somente para email; URLs incompletas ou
protocolos executáveis ficam sem href. Não há lightbox; eventual interação é da F5.
A F4a não altera o roteador edge nem implementa publicação ou múltiplos templates.

## F4b — publicação estática e Edge

`POST /api/site/publish` exige sessão, termos, ownership e Origin do app. Lê o
rascunho inteiro numa transação sob o mesmo lock do editor, valida título/handle/
páginas e gera cada documento com `renderToReadableStream` de `react-dom/server.edge`, entrada compatível com
Workers e Route Handlers do App Router. A publicação aguarda `allReady` e consome
o stream inteiro antes de gravar R2; não há bootstrap/hidratação ou Suspense no
layout. Essa entrada evita as APIs legadas que o App Router bloqueia no build. O snapshot
reutiliza `SiteRender`/`BlockRender`; não há outro markup de blocos. Dados do usuário
continuam escapados por React, inclusive title, metadados e links inline.

A primeira página ocupa `index.html`, as demais `{slug}/index.html`. Nav usa `./`
para home e `./{slug}` para as outras páginas; URLs canônicas não têm barra final
nas subpáginas. Um `site.css` contém `SITE_CSS`, reset de body e variáveis do tema.
As fontes escolhidas pelo tema vêm de um `<link>` Google Fonts, usando os fallbacks
nominais do tema. Cada documento inclui descrição, canonical, OG/Twitter e a
primeira imagem hero/image de todo o site. Imagens hero/image/gallery em
`/api/assets/` são convertidas para URLs absolutas do app.

Configure **APP_PUBLIC_URL** como origem pública do app, sem caminho/query:
`http://app.lvh.me:8787` em dev e `https://app.<ROOT_DOMAIN>` em produção. A URL
pública usa ROOT_DOMAIN; em dev usa HTTP e SITE_EDGE_PORT (8787), fora de dev
usa HTTPS sem porta. Configure SITE_EDGE_PORT=8787 em dev e vazio em produção.
APP_PUBLIC_URL fornece somente a origem do app/asset, nunca a porta do portfólio.
Se APP_PUBLIC_URL estiver ausente, vazia ou inválida, publicar retorna HTTP 400
com mensagem pt/en explícita antes de qualquer gravação em banco/R2/KV. O renderer também
valida essa origem e converte avatar, imagem, itens de galeria e OG/Twitter de
`/api/assets/` para URLs absolutas. Republicar regenera snapshots antigos.
Dashboard, publish API e metadados do snapshot usam buildPublicSiteUrl. Não configure APP_PUBLIC_URL como localhost quando imagens
precisarem ser acessadas por outros dispositivos ou por crawlers externos.

### Versões, consistência e falhas

A migration `0003` adiciona `publications.assets_keys` (JSONB, default `[]`) e
`publication_operations` (trava persistida por site + token + keys em preparação).
Aplique com `pnpm db:migrate`. Duas publicações/despublicações simultâneas do mesmo
site não podem escrever o mesmo prefixo: a segunda recebe 409 `publicationBusy`.
A trava não expira automaticamente, evitando que uma operação lenta seja
ultrapassada e depois sobrescreva o KV de uma operação mais recente.

A ordem é: capturar rascunho → proteger suas keys → escrever TODOS os HTMLs e CSS
em `sites/{siteId}/v{published_version+1}/` → registrar a publication → gravar
`SITE_KV[site:{handle}] = {siteId,version}` → atualizar status/published_version no
banco numa transação com recomputação de órfãos → liberar a trava. O KV é o último
passo que altera o roteamento público; antes dele, a versão anterior permanece
intacta. Falha em R2 deixa objetos órfãos para limpeza futura. Republicar sempre
cria uma versão, mesmo sem mudanças de conteúdo. Histórico não é alterado pela
edição do rascunho.

KV, R2 e Neon não compartilham uma transação distribuída. Se a finalização no
banco falhar após escrever KV, a API tenta restaurar o ponteiro anterior. Se essa
compensação também falhar, mantém a trava e a proteção de assets para recuperação
operacional. Se um Worker for interrompido, a trava também permanece. Para
recuperar: primeiro confirme que não existe publicação em andamento, inspecione o
KV e os arquivos R2, reconcilie `sites.status/published_version` com o ponteiro
completo escolhido, e só então remova a row de `publication_operations` desse
site e recompute órfãos. Nunca libere a trava enquanto um writer ainda pode atuar.
Uma falha de rede no banco pode ter resultado de commit incerto; use o mesmo
procedimento de reconciliação antes de uma nova publicação.

Não há cache de ponteiros em memória no Worker. O próprio KV tem
[consistência eventual](https://developers.cloudflare.com/kv/concepts/how-kv-works/):
as alterações e misses cacheados podem demorar 60 segundos ou mais para propagar.
Portanto, a troca é atômica quanto à completude do snapshot, não uma invalidação
instantânea em todos os pontos da rede. HTML usa `public,max-age=300`, então um
navegador pode manter a versão anterior por até cinco minutos. `./site.css?v=N`
usa `public,max-age=31536000,immutable`; o Edge resolve N para o prefixo vN (mesmo
após republicar), evitando CSS velho na nova versão. `/site.css` sem versão usa
cache curto. O Edge não consulta Neon: só KV e SITES_BUCKET. Miss de KV/objeto
retorna 404 neutro em pt/en, sem expor existência da conta.

`POST /api/site/unpublish` apaga o ponteiro KV e marca draft. Repetir é permitido;
publications e R2 são mantidos como histórico, com cleanup diferido. Após propagação
e expiração do cache HTTP o link retorna 404. Falha de atualização do banco tenta
restaurar o ponteiro anterior com o mesmo protocolo de recuperação acima.

### Assets e GC

`publications.assets_keys` registra as keys originais `/api/assets/` do snapshot.
Recomputação considera blocos de todas as páginas do rascunho, a versão publicada
atual e as keys de uma operação em preparação. Esses assets têm `orphaned_at=NULL`.
O cron exclui candidatos protegidos e revalida cada key antes de apagar o objeto,
inclusive quando havia um timestamp de órfão antigo. Republicar/despublicar libera
keys que não estão mais no rascunho/versão atual; começa então a janela normal de
GC_GRACE_DAYS. Ela também cobre acessos a HTML da versão anterior em caches.
Versões antigas mantêm HTML/CSS como histórico, mas seus assets deixam de ser
protegidos depois da janela quando não são mais referenciados.

### Desenvolvimento e produção

Em dev, os dois wrangler.jsonc têm o mesmo identificador local SITE_KV. O web usa
`initOpenNextCloudflareForDev` com `persist.path=../edge/.wrangler/state/v3` e
remoteBindings=false, compartilhando KV/R2 com o Edge. Miniflare cria os recursos
[localmente](https://developers.cloudflare.com/workers/local-development/local-data/).
Uploads/leitura de `/api/assets` continuam usando o storage S3 remoto já configurado
na F3; publicar não muda esse contrato.

1. Atualize `.env` com APP_PUBLIC_URL e SITE_EDGE_PORT=8787, execute `pnpm db:migrate` e `pnpm dev`.
2. Em Configurações, informe título/descrição. Edite as páginas e espere o autosave.
3. No dashboard clique Publicar e abra `http://{handle}.lvh.me:8787`.
4. Confira nav, imagens, tema e metadados. Editar o rascunho não muda o HTML público;
   Republicar cria v2. Despublicar pede confirmação e retorna o site a draft.

Produção:

1. Crie o namespace com `pnpm --filter @folyo/edge exec wrangler kv namespace create SITE_KV`.
   Substitua o ID local de exemplo pelo ID real nos **dois** wrangler.jsonc. Não
   publique o ID `00000000000000000000000000000004`.
2. Crie/configure SITES_BUCKET e os buckets de assets já existentes; os bindings
   R2/KV do web e Edge devem apontar para os mesmos recursos de publicação.
3. Configure ROOT_DOMAIN/ENVIRONMENT no Edge; no web configure ROOT_DOMAIN,
   ENVIRONMENT, APP_PUBLIC_URL, SITE_EDGE_PORT vazio e os secrets Neon/Auth/R2. Aplique migrations na
   branch correta do Neon antes de servir a nova API.
4. Configure DNS wildcard `*.ROOT_DOMAIN` e rotas Worker para raiz e wildcard;
   `app.ROOT_DOMAIN` é encaminhado ao web pelo binding WEB. Use TLS ativo e
   AUTH_URL público. Domínios custom de clientes ficam para F5.
5. Configure CRON_SECRET/GC_GRACE_DAYS no web e agende POST
   `https://app.<ROOT_DOMAIN>/api/cron/assets-gc` com Authorization Bearer usando
   scheduler externo ou Worker Cron Trigger. Não inclua tokens em URLs/logs.
6. Faça deploy do web e Edge com bindings sincronizados e confira um publish,
   republish e unpublish. Criar recursos/deploy é uma etapa operacional separada
   do build dry-run do repositório.

### Templates e aparência (F5a)

O catálogo vive em `apps/web/lib/templates.ts`. `buildTemplate(id, locale)` cria
um documento novo com `{ theme, pages: [{ title, slug, blocks: [{ type, content }] }] }`.
Os IDs e o tipo `TemplateDefinition` são compartilhados em `packages/core`.
Os nomes, descrições, textos, nomes fictícios e alternativas das imagens ficam
nos dicionários `apps/web/lib/i18n/templates.ts` (pt-BR/en). Blocos não carregam
IDs nem posições no catálogo: o repositório os atribui na aplicação.

Para adicionar um quinto template:

1. Inclua o ID em `TEMPLATE_IDS` em `packages/core/src/templates.ts`; o tema usa o mesmo enum.
2. Adicione nomes, descrições e conteúdo nos dois dicionários.
3. Implemente o caso em `buildTemplate`, usando os schemas de blocos existentes,
   slugs únicos e uma cor da paleta `ACCENT_PALETTE`.
4. Acrescente a miniatura SVG em `TemplateThumbnail` e cubra o documento nos testes
   de estrutura/localização e renderização estática.

`POST /api/site/template` recebe somente `{ templateId }`: sempre aplica o tema,
e substitui páginas/blocos apenas quando o site continua virgem. A verificação,
o replace e a atualização do tema usam uma transação Neon HTTP com o mesmo lock
consultivo do editor, além do lock da linha do site. O predicado SQL corresponde
à função testável `isVirginSite`: site vazio ou uma página inicial pt-BR/en com
um único hero padrão, sem alterações de metadados, página ou conteúdo. Páginas
intencionalmente vazias e sites publicados são preservados. Sites editados
retornam `409 { appliedTheme: true, contentSkipped: true, theme }`; a interface
trata isso como aplicação de estilo e explica a preservação do conteúdo.
`POST /api/site/template/style` é a ação explícita de Settings que aplica o tema
completo e `templateId` sem substituir conteúdo, inclusive em sites virgens.
`PATCH /api/site/theme` valida e mescla somente os campos de aparência permitidos
no JSONB dentro do lock, preservando os demais campos. Todos exigem ownership,
termos aceitos e origem válida.

Novos sites começam com o tema mínimo `{ preset: 'blank' }`, que indica a escolha
pendente no onboarding. Escolher qualquer template, inclusive blank, persiste o
tema completo e libera o dashboard. Sites antigos com `{}` ou tema completo
mantêm seu fluxo anterior. Não é necessária migração do banco. Aplicações repetidas
não acumulam páginas/blocos e nunca substituem conteúdo que deixou de ser virgem.
As alterações aparecem ao abrir o preview `/p/[siteId]`; a versão pública muda
na próxima publicação. Preview e HTML publicado continuam usando os mesmos
renders puros e `themeToCssVars`, incluindo heroLayout e as fontes do catálogo.

O catálogo também inclui quatro portfólios demonstrativos completos (`executive`,
`studio`, `scientist`, `developer`), cada um com cinco páginas e os nove tipos de
bloco disponíveis. Os perfis e casos são fictícios; o texto orienta a substituição
pelas informações reais do usuário. Os dois idiomas ficam em
`apps/web/lib/i18n/showcase-templates.ts`.

As 28 ilustrações originais ficam em `apps/web/public/template-assets`:
composições editoriais, identidades visuais, diagramas de pesquisa e conceitos
de interfaces. São SVGs estáticos, sem scripts ou referências remotas. Apenas os
caminhos do catálogo passam por `templateAssetUrlSchema`; preview os usa diretamente
e o render de publicação transforma esses caminhos em URLs absolutas da aplicação.
Essas imagens compartilhadas não são uploads do usuário e não entram no GC de assets.
Os IDs e o schema de templates agora têm uma única fonte em
`packages/core/src/templates.ts`, também usada pelo schema de temas.

### Preview de templates e exclusão do portfólio (F5a.1)

Cada card das galerias oferece **Ver exemplo**. `TemplatePreviewModal` monta o
`buildTemplate(id, locale)` em memória e usa `SiteRender`, os mesmos renders de
blocos, estilos, fontes e variáveis de tema do preview e do HTML publicado.
A navegação do modal troca apenas a página renderizada: não muda a URL nem toca
no banco. **Fechar** e Escape retornam à galeria sem aplicar conteúdo. **Usar este
template** chama a API já existente; o 409 de um site editado continua aplicando
somente o estilo e mostrando a mensagem de preservação de conteúdo.

Settings tem uma **Zona de perigo** exclusiva para **Excluir portfólio**, separada
da exclusão da conta. A confirmação exige marcar a perda do link público e digitar
o handle exato. `DELETE /api/site` mantém a conta e a sessão, retorna `{ ok: true,
handle }`, e envia o usuário para `/onboarding`. Ausência do site ou ownership
incompatível retorna 404. Se uma publicação estiver em andamento, retorna 409 para
impedir que aquela operação restaure um roteamento depois da exclusão.

A transação, sob o mesmo lock do editor, remove o site (cascade de páginas, blocos,
publicações e denúncias), apaga as linhas de assets do usuário e registra uma tarefa
em `site_deletions`. A migração `0004_adorable_bug.sql` cria essa fila sem foreign
keys para que sobreviva à exclusão do site. **Execute `pnpm db:migrate` antes de
usar esta versão em outro ambiente.**

Depois do commit, a chave `site:{handle}` é removida do KV **antes** da limpeza dos
prefixos R2 `sites/{siteId}/` (todas as versões) e `assets/{userId}/`. Falhas de R2
são registradas sem desfazer a exclusão nem impedir o sucesso da resposta. A fila
continua pendente; o cron de assets GC tenta a limpeza novamente, pois o GC de
assets normal não encontra mais as linhas já removidas. Falha crítica de KV retorna
503 e também deixa a tarefa para recuperação pelo cron. Uma tarefa só é removida
depois de todas as limpezas concluírem.

Retentativas não removem um pointer KV que já pertence a outro site que reutilizou
o handle. A limpeza de imagens preserva assets registrados de um novo portfólio e
objetos enviados após a exclusão, usando as datas de upload do R2. As ilustrações
compartilhadas de templates em `public/template-assets` não são imagens do usuário
e permanecem disponíveis.

O handle volta a estar disponível assim que o site é removido: a verificação de
unicidade existente continua sendo a fonte de verdade. **O cooldown de troca de
handle não se aplica à recriação pós-exclusão**: o novo site começa sem o histórico
de troca do antigo. O fluxo normal de termos, handle e template é reutilizado, sem
excluir o usuário nem exigir um novo login.

### Canvas WYSIWYG (F5b)

O editor usa `SiteRender` como moldura e os mesmos nove renders de preview e
publicação. Slots opcionais de React permitem inserir **inputs/textarea
controlados** em `HeroRender`, `HeadingRender` e `TextRender`, e ações nas
miniaturas de `GalleryRender`. Sem slots, o HTML e o comportamento dos renders
continuam iguais. O tema vem do site na página do editor, sem mudar a API do
documento ou o PUT de blocos.

- O canvas começa no modo visual: clique no conteúdo ou em **Editar** no chrome
  do card. Heading usa botões H1/H2/H3; texto mantém markdown, slash menu e os
  atalhos de conversão de títulos; hero edita nome, título e subtítulo no render.
- Imagem, galeria, botão, social, divisor e espaçador usam painéis compactos dentro
  do card. A imagem continua visível. A galeria edita um item por vez, com troca,
  alt, legenda, reordenação, remoção e tile de adicionar. O hero reutiliza o
  uploader de imagem para o avatar. Selects e uploads existentes são preservados.
- Existe uma única lista `blocks` editável: inputs e renders leem essa lista. Uma
  sessão guarda somente a referência original do bloco para rollback. Alterações
  do card entram na fila existente ao confirmar com blur/clique fora,
  **Ctrl+Enter / Cmd+Enter** ou **Concluir**, mantendo o debounce de 1,5 s.
  **Esc** ou **Cancelar** restaura só o card ativo, sem salvar o texto cancelado ou
  descartar alterações confirmadas de outros cards. O foco retorna ao handle.
- Tab segue o fluxo natural. Selects em portal continuam associados ao card via
  `aria-controls`, de modo que escolher uma opção não confirma prematuramente o
  card. Uma operação de upload impede desmontar ou cancelar o card até terminar.
- Zod marca os campos inválidos e mostra **Corrija o bloco X**. A fila bloqueia o
  autosave e o modo Visualizar até a correção. Os dados nunca passam por
  `contentEditable` ou inserção de HTML do usuário.
- O botão **Inserir link** captura a seleção/cursor do textarea, abre campos de
  texto e URL HTTP(S) e insere `[texto](url)` na posição selecionada. A toolbar
  de link foi entregue; o restante da formatação continua pela sintaxe markdown.
- **Editar / Visualizar** confirma o card e flusha a mesma fila usada ao trocar
  de página. Se o save falhar, o editor permanece acessível com erro. Visualizar
  usa o `SiteRender` completo, sem wrappers/chrome de edição, com tema, nav e
  footer idênticos aos do site. A página ativa pode mudar pela sidebar ou nav.
  Voltar a Editar mantém os blocos atuais.

A medição com React Profiler em JSDOM, em um canvas de 100 blocos alternando
heading/text, mostrou aproximadamente 140 ms para uma alteração antes da
memoização e 13 ms no teste isolado depois. Os cards/inserções são memoizados;
callbacks, IDs ordenados e opções dos sensores dnd mantêm referências estáveis
entre mudanças de conteúdo. Esses números são uma referência do ambiente de
testes, não um benchmark de todos os dispositivos. A medição permanece no teste
`editor-inline.test.tsx`; não há dependências novas, alterações no GC, na API,
na fila de autosave ou no pipeline de publicação.
