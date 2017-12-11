module.exports = {
  entry: './lib/graph.js',
  output: {
    library: 'xstateUtils',
    libraryTarget: 'umd',
  },
  // module: {
  //   loaders: [
  //     // all files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'
  //     { test: /\.ts$/, loader: 'ts-loader' }
  //   ]
  // },
  // plugins: []
};
