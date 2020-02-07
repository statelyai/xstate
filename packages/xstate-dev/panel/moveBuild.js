const path = require('path');
const fs = require('fs');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp')

const craBuildDir = path.join(__dirname, 'build');
const targetBuildDir = path.join(__dirname, '..', 'src', 'extension', 'panel', 'build');

console.log('targetBuildDir:', targetBuildDir)

rimraf(targetBuildDir, async () => {
  console.log('Cleaned previous target build directory');
  await mkdirp(targetBuildDir);

  fs.rename(craBuildDir, targetBuildDir, err => {
    if (err) {
      console.log(
        'Received error before managed to move build dir to target destination:',
        err
      );
    } else {
      console.log(`Moved build to ${targetBuildDir}`);
    }
  });
});
