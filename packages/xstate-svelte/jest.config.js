const { jest: lernaAliases } = require('lerna-alias');

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  moduleNameMapper: lernaAliases(),
  transform: {
    '^.+\\.svelte$': [
      'svelte-jester',
      {
        preprocess: true,
        rootMode: 'upward'
      }
    ],
    '^.+\\.ts$': 'ts-jest'
  },
  testEnvironment: 'jsdom'
};
