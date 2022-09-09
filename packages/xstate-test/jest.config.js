const { jest: lernaAliases } = require('lerna-alias');

/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: 'ts-jest',
  moduleNameMapper: lernaAliases()
};
