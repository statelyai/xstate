const fs = require('fs');
const path = require('path');

const interpreterDts = path.join(
  __dirname,
  '..',
  'packages',
  'core',
  'dist',
  'declarations',
  'src',
  'interpreter.d.ts'
);

fs.writeFileSync(
  interpreterDts,
  fs
    .readFileSync(interpreterDts, 'utf8')
    .replace('[symbolObservable]():', '[Symbol.observable]():')
);
