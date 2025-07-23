import js from '@eslint/js'
import globals from 'globals'
import * as tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'tests', 'test'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: {
        ...globals.node,
        ...globals.browser
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'prefer-const': 'off',
      'no-var': 'off',
      'no-case-declarations': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'require-yield': 'off',
      'no-empty': 'off',
      'no-constant-condition': 'off',
      'no-useless-escape': 'off'
    },
  },
) 