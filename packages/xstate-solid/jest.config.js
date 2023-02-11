const { jest: lernaAliases } = require('lerna-alias');
const path = require('path');

module.exports = {
  preset: 'solid-jest/preset/browser',
  transform: {
    '^.+\\.(js|ts|tsx)?$': path.resolve(__dirname, 'jestTransform.js')
  },
  moduleNameMapper: lernaAliases()
};
