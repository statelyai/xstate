const { constants } = require('jest-config');
const { defaultTransformerOptions } = require('jest-preset-angular/presets');

const esModules = ['@angular'].join('|');

// eslint-disable-next-line no-undef
globalThis.ngJest = {
  tsconfig: 'tsconfig.spec.json'
};
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
    '^.+\\.(mjs)$': [
      'jest-preset-angular',
      {
        ...defaultTransformerOptions,
        useESM: true
      }
    ],
    '^.+xstate-angular/.+\\.(ts|js)$': [
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
  transformIgnorePatterns: [`/node_modules/(?!(${esModules}|.*.mjs$))`],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment'
  ],
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
