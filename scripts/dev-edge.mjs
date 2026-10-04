import { spawn } from 'node:child_process';

// dotenv-cli in the root command loads .env. Wrangler bindings are passed
// explicitly because ordinary process variables are not Worker bindings.
const child = spawn(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    '--port',
    process.env.SITE_EDGE_PORT || '8787',
    '--var',
    `ROOT_DOMAIN:${process.env.ROOT_DOMAIN ?? 'lvh.me'}`,
    '--var',
    `ENVIRONMENT:${process.env.ENVIRONMENT ?? 'dev'}`,
  ],
  { stdio: 'inherit', shell: false },
);
child.on('error', () => {
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
