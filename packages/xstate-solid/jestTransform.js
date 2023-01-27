const babelJest = require('babel-jest');

// Ensures babel presets are loaded for jest when running from monorepo root
module.exports = babelJest.createTransformer({
  presets: [
    '@babel/preset-typescript',
    [
      '@babel/preset-env',
      {
        targets: {
          node: 'current',
          esmodules: false
        }
      }
    ],
    'babel-preset-solid'
  ]
});
