// @ts-check
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const examplesDir = path.resolve(__dirname, '..', 'examples');

const examples = fs.readdirSync(examplesDir);

// run tsc on each subdirectory in /examples/*
for (const example of examples) {
  console.log('Checking example: ' + example);
  const dirPath = path.join(examplesDir, example);

  if (!fs.existsSync(path.join(dirPath, 'package.json'))) {
    console.log('Skipping ' + example + ' (no package.json)');
    continue;
  }

  const exampleDir = path.join(
    path.resolve(__dirname, '..', 'examples', example)
  );
  const tscPath = path.join(process.cwd(), 'node_modules', '.bin', 'tsc');

  try {
    cp.execSync(`${tscPath} --noEmit --skipLibCheck`, {
      cwd: exampleDir,
      stdio: 'inherit'
    });
  } catch (err) {
    console.error(exampleDir);
    console.error(err);
  }
}
