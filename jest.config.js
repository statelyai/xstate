const { jest: lernaAliases } = require('lerna-alias');

module.exports = {
  preset: 'ts-jest',
  moduleNameMapper: lernaAliases(),
  testPathIgnorePatterns: [
    '/node_modules/',
    // don't catch nested tests within this jest project
    // this avoids testing those nested ones twice by dev script
    '/packages/'
  ]
};
