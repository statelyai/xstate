const { execSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

const examplesDir = path.resolve(__dirname, '../../examples');

const exampleFiles = [
  'package.json',
  'tsconfig.json',
  'index.html',
  'src/App.tsx',
  'src/main.tsx',
  'src/vite-env.d.ts'
];

module.exports = function (plop) {
  plop.setActionType('install', function (answers, config, plop) {
    const toDashCase = plop.getHelper('dashCase');

    const dir = path.resolve(examplesDir, toDashCase(answers.name));
    try {
      execSync(`yarn --cwd ${dir}`, {
        stdio: 'inherit'
      });
    } catch (e) {
      console.log(e);
      throw 'Could not install dependencies';
    }
    return 'Installed dependencies successfully';
  });

  plop.setGenerator('example', {
    description: 'Create new example in examples directory',
    prompts: [
      {
        type: 'input',
        name: 'name',
        message: 'Example name'
      }
    ],
    actions: (data) => [
      ...exampleFiles.map((file) => {
        return {
          type: 'add',
          path: path.resolve(examplesDir, `{{dashCase name}}`, file),
          templateFile: path.join('example', `${file}.hbs`)
        };
      }),
      {
        type: 'install'
      }
    ]
  });
};
