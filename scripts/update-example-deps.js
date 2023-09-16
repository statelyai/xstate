// @ts-check
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const examplesDir = path.resolve(__dirname, '..', 'examples');
const templatesDir = path.resolve(__dirname, '..', 'templates');

const examples = fs.readdirSync(examplesDir);
const templates = fs.readdirSync(templatesDir);

templates.forEach(function (template) {
  console.log('Updating template: ' + template);
  const dirPath = path.join(templatesDir, template);

  if (!fs.existsSync(path.join(dirPath, 'package.json'))) {
    console.log('Skipping ' + template + ' (no package.json)');
    return;
  }

  const templateDir = path.join(
    path.resolve(__dirname, '..', 'templates', template)
  );

  cp.execSync('pnpm update', { cwd: templateDir, stdio: 'inherit' });
});

examples.forEach(function (example) {
  console.log('Updating example: ' + example);
  const dirPath = path.join(examplesDir, example);

  if (!fs.existsSync(path.join(dirPath, 'package.json'))) {
    console.log('Skipping ' + example + ' (no package.json)');
    return;
  }

  const exampleDir = path.join(
    path.resolve(__dirname, '..', 'examples', example)
  );

  try {
    cp.execSync('pnpm update', { cwd: exampleDir, stdio: 'inherit' });
  } catch (err) {
    console.error(err);
  }
});
