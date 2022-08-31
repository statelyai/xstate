/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  projects: ['<rootDir>/packages/*'],
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ]
};
