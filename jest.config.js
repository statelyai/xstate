const { constants } = require('jest-config');
const { defaultTransformerOptions } = require('jest-preset-angular/presets');

/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  setupFilesAfterEnv: [
    '@xstate-repo/jest-utils/setup',
    'jest-preset-angular/setup-jest'
  ],
  moduleFileExtensions: ['ts', 'html', 'js', 'json', 'mjs'],
  transform: {
    '^.+\\.(mjs)$|^.+xstate-angular/.+\\.(ts|js)$': [
      'jest-preset-angular',
      {
        ...defaultTransformerOptions,
        useESM: true
      }
    ],
    [constants.DEFAULT_JS_PATTERN]: 'babel-jest',
    '^.+\\.vue$': '@vue/vue3-jest',
    '^.+\\.svelte$': [
      'svelte-jester',
      {
        preprocess: true,
        rootMode: 'upward'
      }
    ]
  },
  transformIgnorePatterns: [`/node_modules/(?!(@angular|.*.mjs$))`],
  resolver: '<rootDir>/scripts/jest-resolver.js',
  globals: {
    'vue-jest': {
      // weird way of disabling ts-jest-based transformer
      transform: {
        '^typescript$': 'babel-jest',
        '^tsx?$': 'babel-jest'
      }
    }
  },
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  testEnvironment: 'jsdom'
};
