const path = require('path');
const { defaults, constants } = require('jest-config');
const { replacePathSepForRegex } = require('jest-regex-util');

module.exports = {
  transform: {
    [constants.DEFAULT_JS_PATTERN]: 'babel-jest',
    '^.+\\.vue$': 'vue-jest',
    '^.+\\.svelte$': [
      'svelte-jester',
      {
        preprocess: true,
        rootMode: 'upward'
      }
    ]
  },
  testPathIgnorePatterns: [
    ...defaults.testPathIgnorePatterns,
    replacePathSepForRegex(
      `${path.sep}packages${path.sep}xstate-dev${path.sep}`
    )
  ],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};
