# Folyo — F1

Fundação da plataforma de portfólios: app Next.js 15, roteador Hono em Cloudflare Workers, PostgreSQL Neon e dois buckets R2. Auth, editor e publicação permanecem como pontos de extensão.

## Requisitos e instalação

Use Node.js 22+ e pnpm 10.28.2 (`corepack enable` e `corepack prepare pnpm@10.28.2 --activate`). Wrangler é uma dependência local; não requer instalação global. Para desenvolvimento, nenhuma conta Cloudflare é necessária.

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

O client `createDb(databaseUrl)` é inicializado explicitamente com uma variável de servidor; importar o pacote não abre conexões nem exige credenciais no build. A URL é validada com Zod. Em Workers, passe o secret `DATABASE_URL` quando a F2 começar a consumir o banco.

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

Isso executa `opennextjs-cloudflare build` (que chama `next build`) e empacota o edge com `wrangler deploy --dry-run`. O web gera `.open-next/worker.js` e `.open-next/assets`; o Worker usa `nodejs_compat`, assets estáticos e self binding do OpenNext. Não há ISR nem cache incremental R2 na F1. Os dois buckets do produto pertencem ao edge.

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
- F5: seleção de idioma a partir do catálogo em `packages/core`; os stubs já usam chaves de mensagens.

## Decisões técnicas

- Scripts pnpm e concurrently bastam para quatro workspaces; nenhum cache de build ou Turbo é necessário nesta etapa. Os pacotes internos exportam TypeScript e são transpilados pelos consumidores.
- Neon HTTP com `@neondatabase/serverless` evita sockets/pools persistentes por isolate. A URL pooled usa pooling do Neon; não existe pool TCP local. Transações interativas, se necessárias no editor, exigirão avaliar driver WebSocket/Hyperdrive. Consulte a [documentação Drizzle/Neon](https://orm.drizzle.team/docs/connect-neon).
- Schema mantém as colunas e nulabilidade especificadas. UUIDs têm `gen_random_uuid()` e timestamps têm `now()` para facilitar inserts. `updated_at` não atualiza automaticamente: a camada de escrita da F3 deverá defini-lo.
- Valores comentados de template/status/tipo são tipos TS e schemas Zod, sem acrescentar enums PostgreSQL ao schema oficial. F2–F4 deverão validar cada payload externo com Zod antes de persistir; `jsonb` flexível não representa um contrato de conteúdo do editor nesta etapa.
- Handles reservados são bloqueados pelo roteador e armazenados pelo seed; a criação/alteração de handle em F2/F3 deverá consultar a tabela, inclusive reservas futuras. Hosts com múltiplos subdomínios ou handles inválidos retornam 404.
- Redirects mantêm caminho/query e usam HTTPS fora de dev. O stub só interpola handles validados como ASCII seguro. O proxy preserva método/body e query; em produção usa exclusivamente service binding.
- OpenNext segue o [setup oficial](https://opennext.js.org/cloudflare/get-started). O desenvolvimento F1 usa Next diretamente; bindings web deverão ser integrados via `initOpenNextCloudflareForDev` quando forem consumidos em F2. Não use runtime `edge` nas páginas do Next.

## Qualidade

```sh
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

ESLint e Prettier cobrem todos os workspaces; TypeScript é strict, com `noUncheckedIndexedAccess` e sem `any`. Vitest cobre os quatro caminhos de Host, proxy local, portas, hosts inválidos e isolamento do diagnóstico R2. CI roda install → lint → typecheck → test → build em PRs e pushes na main. Use commits convencionais (`feat:`, `fix:`, `chore:`).

### Estado de validação desta entrega

O ambiente de criação dispõe de Node 18, não tem pnpm e não resolve `registry.npmjs.org`. Por isso dependências não foram instaladas e não foi possível executar lint, typecheck, Vitest, build ou smoke tests com os servidores. Nenhuma credencial Neon foi fornecida; migration e seed não foram executados contra o serviço. SQL inicial e snapshot foram escritos sem executar Drizzle Kit e precisam ser conferidos com `pnpm db:generate` antes de alterações futuras (o schema intacto deve gerar zero mudanças).

O lockfile não pôde ser gerado. A primeira instalação usa resolução normal; versione `pnpm-lock.yaml` após validar e substitua `--no-frozen-lockfile` por `--frozen-lockfile` na CI. Não considere os critérios de execução aprovados até rodar os comandos acima com Node 22 e rede disponível.
