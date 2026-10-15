# Migração de sistema e backup

## O que é preservado

O repositório GitHub contém código, assets versionados, migrations, lockfile, CI e documentação, incluindo o histórico Git. Credenciais, dependências, builds e estado local Wrangler ficam fora do Git.

O backup completo local desta migração contém a pasta `folyo`, incluindo `.git`, `.env`, arquivos OAuth locais, estado `.wrangler`, dependências e builds presentes. As pastas vazias de ambiente `.agents`, `.codex` e `.aws` não contêm dados do produto. O arquivo compactado contém segredos: mantenha-o em armazenamento privado e, ao transferir, use um disco criptografado ou destino de confiança.

O backup não contém os dados remotos Neon/R2/KV, credenciais de login GitHub/Cloudflare mantidas fora do projeto, configuração global do sistema, nem arquivos temporários fora da pasta do projeto. Trocar o sistema não apaga os serviços remotos. Para uma cópia independente da nuvem, exporte também o PostgreSQL e os buckets/namespace antes de excluir qualquer conta ou recurso.

## Antes de formatar

1. Copie o arquivo de backup e seu `.sha256` para um disco externo ou outro computador. Uma cópia no mesmo disco que será formatado não basta.
2. Confira o checksum no destino e abra/liste o arquivo compactado.
3. Confirme acesso às contas GitHub, Neon, Google Cloud e Cloudflare e seus métodos MFA.
4. Preserve o `.env` e o JSON OAuth: ambos estarão no backup privado, fora do GitHub.
5. Se pretende remover recursos remotos, faça exportação separada. O repositório e o backup local não substituem um dump do Neon nem exportação R2/KV.

## Restauração pelo backup completo

Em Linux/macOS ou WSL, no diretório em que está o backup:

```sh
sha256sum -c folyo-backup-completo-2026-10-15.tar.gz.sha256
tar -xzf folyo-backup-completo-2026-10-15.tar.gz
cd folyo
git status
git remote -v
```

No macOS, pode usar `shasum -a 256` para comparar o hash. No Windows, `Get-FileHash -Algorithm SHA256` calcula o checksum; prefira WSL para preservar as permissões e links do ambiente Linux. Extraia em uma pasta nova para não sobrescrever trabalho existente.

Instale Git, Node.js 22+ e pnpm 10.28.2 no novo sistema. Dependências e builds incluídos servem como cópia do ambiente anterior; devem ser regenerados para o SO de destino. Antes de instalar, remova apenas as pastas geradas `node_modules` (raiz e workspaces), `.next`, `.open-next` e `dist` que vieram do sistema anterior. Preserve `.wrangler`, `.env`, código e `.git`.

```sh
corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm dev
```

Acesse http://localhost:3000 e valide login, dashboard, abrir/editar/salvar página, imagens, preview e portfólio publicado. Não é necessário criar outro banco para a simples troca de SO: o `.env` restaurado aponta para o Neon existente. Não execute seed ou migrações automaticamente sobre uma base existente sem verificar sua necessidade.

## Restauração a partir do GitHub

```sh
git clone https://github.com/Docas32/folyo.git
cd folyo
corepack enable
corepack prepare pnpm@10.28.2 --activate
pnpm install --frozen-lockfile
```

Recupere `.env` do backup privado ou preencha `.env.example` e salve como `.env`. O clone não restaura KV/R2 locais. Sem o estado Wrangler antigo, snapshots locais deverão ser publicados novamente a partir do conteúdo do banco; os uploads remotos continuam na conta R2. Autentique novamente o GitHub CLI e o Wrangler se for enviar commits ou fazer deploy.

## Cópias independentes dos serviços remotos

Para PostgreSQL, use `pg_dump` compatível com a versão do servidor, com credenciais carregadas sem expor a URL em logs; restaure com `pg_restore` em uma base separada e verifique tabelas/contagens. Prefira conexão direta apropriada para exportação conforme o painel Neon. Para R2, use uma ferramenta S3 compatível para copiar ambos os buckets e preserve todas as chaves/metadados. KV exige exportar a listagem e os valores, não apenas o ID do namespace. Guarde esses arquivos separadamente e teste a restauração. Essas exportações remotas não fazem parte do arquivo local criado nesta migração.

## Validação do arquivo

O arquivo `.sha256` detecta corrupção, mas não cifra o conteúdo. O backup desta migração é verificado pela leitura integral do tar e comparação dos hashes e alvos de links com os arquivos originais. Arquivos de verificação ao lado do backup registram os resultados. Guarde o pacote em pelo menos um destino fora do disco atual antes de instalar o novo sistema.
