const webpack = require('webpack');

module.exports = {
  output: {
    library: 'xstate',
    libraryTarget: 'umd'
  },
  plugins: [new webpack.optimize.ModuleConcatenationPlugin()]
};
