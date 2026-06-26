import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Regras novas do React Compiler (eslint-plugin-react-hooks v6): sinalizam
      // padrões intencionais de data-fetching/efeitos neste projeto. Mantidas como
      // aviso/desligadas para não falhar o lint sem reescritas arriscadas.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/incompatible-library': 'off',
      // Contexts exportam o provider + hook/constantes de propósito.
      'react-refresh/only-export-components': 'off',
      // `any` pontual em queries do Supabase (builder com tipos complexos).
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
])
