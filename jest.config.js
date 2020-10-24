module.exports = {
  projects: ['<rootDir>/packages/!(xstate-dev|xstate-inspect)'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};
