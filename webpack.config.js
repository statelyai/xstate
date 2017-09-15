module.exports = {
  entry: './lib/index.js',
  output: {
    library: 'xstate',
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
