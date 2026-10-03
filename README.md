# Folyo — F1

Fundação da plataforma de portfólios: app Next.js 15, roteador Hono em Cloudflare Workers, PostgreSQL Neon e dois buckets R2. F2 adiciona autenticação Google, termos, onboarding, dashboard e configurações. Editor e publicação permanecem como pontos de extensão.

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

Resultados: HTML Next, HTML do stub Maria, dois redirects 302 e um 404. No navegador use http://app.lvh.me:8787; o redirect preserva a porta local. O diagnóstico R2 responde `{"objects":[],"truncated":false}` inicialmente e lista até 100 objetos. Só está disponível no host do app em `dev`; nos outros ambientes a rota segue para o app.

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
apps/edge      Hono, dispatch por Host, diagnóstico R2 e stub F4
packages/core  Zod, tipos, handles reservados e catálogo pt-BR
packages/db    Schema, client Neon, migrations e seed
.github        CI, sem deploy
```

- F2: auth, sessões e dashboard em `apps/web`; consumir `@folyo/db` no servidor.
- F3: editor e gerenciamento de páginas/blocos em `apps/web`.
- F4: publicação no R2 e substituição do TODO em `apps/edge/src/index.ts` por leitura das publicações.
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

O dashboard mostra status, handle e link `https://{handle}.{ROOT_DOMAIN}`, com clipboard e espaço `data-ad-slot="dashboard-top"` sem scripts. Esse link aponta para o stub do edge; em dev o link solicitado usa HTTPS, embora Wrangler local sirva HTTP — para verificar o stub localmente, use os exemplos curl da F1. `/editor` é apenas o stub solicitado.

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

### Validação F2 neste ambiente

Node 22/pnpm foram encontrados na instalação existente. ESLint passou e os 116 testes automatizados passaram; os testes incluem validação de handles, upsert Google com DB mockado, contratos de API, cooldown, compare-and-set SQL e limpeza R2 paginada/erros com mocks. `pnpm db:generate` confirma que o schema coincide com o snapshot gerado.

A rede do ambiente bloqueia o registry npm e o acesso externo. A dependência `next-auth@5.0.0-beta.30` foi declarada, mas ainda não instalada; por isso typecheck completo, build e smoke test Google não puderam ser aprovados. `pnpm-lock.yaml` precisa ser atualizado por `pnpm install` com rede disponível antes de congelar a CI. A tentativa de aplicar a migration F2 ao Neon falhou com `EAI_AGAIN` no primeiro acesso ao serviço; a migration ainda não foi aplicada. O build foi tentado e falhou na compilação. Esses passos não estão marcados como concluídos.
