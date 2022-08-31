const { jest: lernaAliases } = require('lerna-alias');

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  moduleNameMapper: lernaAliases(),
  moduleFileExtensions: ['js', 'vue'],
  transform: {
    '^.+\\.js$': 'babel-jest',
    // process *.vue files with vue-jest
    '^.+\\.vue$': require.resolve('@vue/vue3-jest')
  },
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons']
  }
};
