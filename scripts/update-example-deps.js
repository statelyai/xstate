// @ts-check
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const examplesDir = path.resolve(__dirname, '..', 'examples');
const templatesDir = path.resolve(__dirname, '..', 'templates');

const examples = fs.readdirSync(examplesDir);
const templates = fs.readdirSync(templatesDir);

[...examples, ...templates].forEach(function (example) {
  const dirPath = path.join(examplesDir, example);

  if (!fs.existsSync(path.join(dirPath, 'package.json'))) {
    return;
  }

  const exampleDir = path.join(
    path.resolve(__dirname, '..', 'examples', example)
  );

  cp.execSync('pnpm update', { cwd: exampleDir, stdio: 'inherit' });
});
