'use strict';

module.exports = {
  module: {
    loaders: [
      { test: /\.js$/, loaders: ['babel-loader'], exclude: /node_modules/ },
      { test: /\.pegjs$/, loader: 'pegjs-loader!babel-loader' }
    ]
  },
  output: {
    library: 'Estado',
    libraryTarget: 'umd'
  },
  resolve: {
    extensions: ['', '.js']
  }
};