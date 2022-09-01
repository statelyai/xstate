const path = require('path');
const { jest: lernaAliases } = require('lerna-alias');

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  moduleNameMapper: lernaAliases(),
  transform: {
    // process *.vue files with vue-jest
    '^.+\\.vue$': require.resolve('@vue/vue3-jest')
  },
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons']
  },
  globals: {
    'vue-jest': {
      tsConfig: path.join(__dirname, 'test', 'tsconfig.json')
    }
  }
};
