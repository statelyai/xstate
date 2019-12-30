module.exports = {
  projects: ['<rootDir>/packages/!(xstate-dev)'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};
