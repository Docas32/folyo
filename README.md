# Folyo

Plataforma de criação e publicação de portfólios com login Google, editor visual de blocos, múltiplas páginas, templates, personalização de aparência e publicação estática em subdomínios.

## Documentação

- [Guia completo do projeto](docs/PROJETO.md): arquitetura, recursos, banco, APIs, configuração, execução, qualidade e operação.
- [Migração de sistema e restauração](docs/MIGRACAO-E-BACKUP.md): o que transferir, como restaurar e como validar.
- [Histórico técnico detalhado](docs/HISTORICO-TECNICO.md): decisões, contratos, tratamento de falhas e validações por etapa; preserva integralmente o README anterior.
- [Variáveis de ambiente](.env.example).
- [CI](.github/workflows/ci.yml).

## Início rápido

Requer Node.js 22+ e pnpm 10.28.2.

```sh
corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

Preencha `.env` com os acessos Neon, Google OAuth e R2. Se estiver restaurando um backup, preserve o `.env` existente.

```sh
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Login e editor: http://localhost:3000. Edge: http://app.lvh.me:8787. Use localhost durante todo o fluxo autenticado; os cookies não são compartilhados com lvh.me.

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Credenciais e estado local não são versionados. Consulte o guia de migração antes de formatar o computador.
