const { constants } = require('jest-config');
const os = require('os');

/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  transform: {
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
