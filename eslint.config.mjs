import tseslint from 'typescript-eslint';
import { gameScriptsConfig } from './scripts/lib/eslint-plugin-bennescript.mjs';
export default [
  { ignores: ['node_modules/**', 'benne-editor/**', 'dist/**', 'coverage/**', 'test-results/**', 'playwright-report/**', 'src/types/generated/**', 'game-templates/**'] },
  {
    files: ['src/engine/**/*.ts', 'src/editor/**/*.ts', 'src/game/boot/**/*.ts', 'src/main.ts', 'tests/**/*.ts', '*.config.ts'],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaVersion: 'latest', sourceType: 'module' } },
    plugins: { '@typescript-eslint': tseslint.plugin },
    rules: { 'constructor-super': 'error', 'no-dupe-args': 'error', 'no-dupe-else-if': 'error', 'no-constant-condition': ['error', { checkLoops: false }], 'no-unsafe-finally': 'error', 'no-unreachable': 'error', 'valid-typeof': 'error' },
  },
  { files: ['scripts/**/*.mjs', 'scripts/**/*.cjs', 'electron/**/*.cjs'], languageOptions: { ecmaVersion: 'latest' }, rules: { 'no-dupe-args': 'error', 'no-unsafe-finally': 'error', 'no-unreachable': 'error', 'valid-typeof': 'error' } },
  // BenneScript: timed actions where nothing waits for them, `await` in handlers (§6.3).
  gameScriptsConfig({ parser: tseslint.parser, tsconfigRootDir: import.meta.dirname }),
];
