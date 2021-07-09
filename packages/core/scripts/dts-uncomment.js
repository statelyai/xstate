const globby = require('globby');
const fs = require('fs-extra');
const path = require('path');

const cwd = process.cwd();

(async () => {
  const files = await globby(['**/*.d.ts', '!node_modules']);

  for (const file of files) {
    const filePath = path.join(cwd, file);
    const content = await fs.readFile(filePath, 'utf8');
    let matched = false;
    const newContent = content.replace(
      /\/\*\*\s*@dts-uncomment:(.+)\*\//g,
      (match, p1) => {
        matched = true;
        return p1;
      }
    );
    if (matched) {
      await fs.writeFile(filePath, newContent);
    }
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
