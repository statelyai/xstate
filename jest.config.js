const path = require('path');
const { defaults, constants } = require('jest-config');
const { replacePathSepForRegex } = require('jest-regex-util');

module.exports = {
  transform: {
    [constants.DEFAULT_JS_PATTERN]: 'babel-jest',
    '^.+\\.vue$': 'vue-jest'
  },
  testPathIgnorePatterns: [
    ...defaults.testPathIgnorePatterns,
    replacePathSepForRegex(
      `${path.sep}packages${path.sep}xstate-dev${path.sep}`
    )
  ],
  projects: ['<rootDir>/packages/!(xstate-dev|xstate-inspect)'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};
