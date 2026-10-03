import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/.open-next/**', '**/.wrangler/**', '**/dist/**', '**/migrations/meta/**', '**/next-env.d.ts'] },
  js.configs.recommended, ...tseslint.configs.recommended,
  { files: ['**/*.mjs'], languageOptions: { globals: { process: 'readonly' } } },
  prettier,
);
