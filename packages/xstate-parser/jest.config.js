const { jest: lernaAliases } = require('lerna-alias');

module.exports = {
  moduleNameMapper: lernaAliases(),
  transform: {
    '\\.[jt]sx?$': [
      'babel-jest',
      { configFile: './packages/xstate-parser/babel.config.js' }
    ]
  }
};
