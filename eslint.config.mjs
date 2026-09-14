// cursor-kit quality gates — measure-only. Promote max-file-lines to "error" after count hits zero.
// MAX_LINES=350 npx eslint .
// node scripts/verify-quality-gates.mjs

import tseslint from 'typescript-eslint';
import cursorKitGates from './eslint-rules/index.cjs';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      'scripts/verify-quality-gates.mjs',
      'eslint-rules/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
    },
    plugins: {
      'cursor-kit-gates': cursorKitGates,
    },
    rules: {
      'cursor-kit-gates/max-file-lines': [
        'warn',
        { max: 350, skipBlankLines: true, skipComments: false },
      ],
    },
  },
);
