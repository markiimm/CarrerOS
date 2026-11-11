import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'lib/db/database.types.ts', '.claude/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Documento 11 §7 — dependência entre camadas.
      'import/no-restricted-paths': ['error', { zones: [
        { target: './lib', from: './features', message: 'lib não pode depender de features' },
        { target: './lib', from: './app', message: 'lib não pode depender de app' },
        { target: './features', from: './app', message: 'features não pode depender de app' },
        { target: './components', from: './features', message: 'components é agnóstico de domínio' },
      ] }],
      'no-restricted-imports': ['error', { patterns: [
        { group: ['**/lib/db/service'], message: 'service_role só em app/api/cron/** e lib/radar/**' },
      ] }],
    },
  },
  {
    files: ['app/api/cron/**', 'lib/radar/**', 'tests/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    // T4 — nenhuma string de interface fora de lib/i18n/pt-BR.ts.
    files: ['app/**/*.tsx', 'features/**/*.tsx', 'components/**/*.tsx'],
    rules: {
      'react/jsx-no-literals': ['error', {
        noStrings: false,
        ignoreProps: true,
        allowedStrings: ['·', '—', '%', '/', ':', '*', '(', ')', '+'],
      }],
    },
  },
];

export default config;
