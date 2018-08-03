const webpack = require('webpack');

module.exports = {
  output: {
    library: 'xstateInterpreter',
    libraryTarget: 'umd'
  },
  plugins: [new webpack.optimize.ModuleConcatenationPlugin()]
};
