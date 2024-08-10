// @ts-check
import globals from 'globals';
import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  // plugins
  js.configs.recommended,
  ...ts.configs.recommended,

  // global ignore
  {
    ignores: [
      '{docs,examples,templates}/',
      '**/dist',
      '**/*.test.*',
      'scripts/jest-utils/'
    ]
  },

  // global language and linter options
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    }
  },

  // global rules
  {
    rules: {
      '@typescript-eslint/no-empty-object-type': [
        'error',
        {
          allowInterfaces: 'with-single-extends'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ],
      'prefer-const': [
        'error',
        {
          destructuring: 'all'
        }
      ]
    }
  },

  // js-specific config and rules
  {
    files: ['**/*.{js,cjs}'],
    languageOptions: {
      sourceType: 'commonjs'
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  }
);
