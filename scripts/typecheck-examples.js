// @ts-check
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const examplesDir = path.resolve(__dirname, '..', 'examples');

const examples = fs.readdirSync(examplesDir);

// run tsc on each subdirectory in /examples/*
for (const example of examples) {
  console.log('Updating example: ' + example);
  const dirPath = path.join(examplesDir, example);

  if (!fs.existsSync(path.join(dirPath, 'package.json'))) {
    console.log('Skipping' + example + '(no package.json)');
    continue;
  }

  const exampleDir = path.join(
    path.resolve(__dirname, '..', 'examples', example)
  );

  cp.execSync('tsc --noEmit', { cwd: exampleDir, stdio: 'inherit' });
}
