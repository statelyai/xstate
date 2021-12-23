const { constants } = require('jest-config');
const os = require('os');

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
      },
      // https://github.com/vuejs/vue-jest/issues/431
      // redirect tsconfig lookup elsewhere so vue-jest doesn't attempt to load ts-jest at all
      tsConfig: os.tmpdir()
    }
  },
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};
