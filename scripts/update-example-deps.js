// @ts-check
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const examplesDir = path.resolve(__dirname, '..', 'examples');

fs.readdirSync(examplesDir).forEach(function (example) {
  const dirPath = path.join(examplesDir, example);

  if (!fs.existsSync(path.join(dirPath, 'package.json'))) {
    return;
  }

  const exampleDir = path.join(
    path.resolve(__dirname, '..', 'examples', example)
  );

  cp.execSync('pnpm update', { cwd: exampleDir, stdio: 'inherit' });
});
