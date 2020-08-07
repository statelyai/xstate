const { jest: lernaAliases } = require('lerna-alias');

module.exports = {
  preset: 'ts-jest',
  moduleNameMapper: lernaAliases(),
  transform: {
    '^.+\\.svelte$': 'svelte-jester'
  }
};
