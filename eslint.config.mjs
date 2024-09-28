// @ts-check
import globals from 'globals';
import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  // plugins
  js.configs.recommended,
  ...ts.configs.recommendedTypeChecked,

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
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error'
    }
  },

  // global rule overrides
  {
    rules: {
      '@typescript-eslint/no-empty-object-type': [
        'error',
        {
          allowInterfaces: 'with-single-extends',
          allowObjectTypes: 'always'
        }
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
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
      '@typescript-eslint/unbound-method': 'off',
      'prefer-const': [
        'error',
        {
          destructuring: 'all'
        }
      ]
    }
  },

  // disable type-checking for js files
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...ts.configs.disableTypeChecked
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
