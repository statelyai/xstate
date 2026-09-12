// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const selected = process.argv.slice(2);
const examples = selected.length
  ? selected.map((name) =>
      path.isAbsolute(name) || name.includes('/')
        ? path.resolve(name)
        : path.join(root, 'examples', name)
    )
  : fs
      .readdirSync(path.join(root, 'examples'))
      .map((name) => path.join(root, 'examples', name));

let failed = false;
for (const directory of examples) {
  const config = path.join(directory, 'tsconfig.json');
  if (!fs.existsSync(config)) {
    console.error(`Skipping ${directory}: no tsconfig.json`);
    failed ||= selected.length > 0;
    continue;
  }

  console.log(`Checking ${directory}`);
  try {
    const manifestPath = require.resolve('typescript/package.json', {
      paths: [directory, root]
    });
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const compiler = path.resolve(
      path.dirname(manifestPath),
      manifest.bin.tsc ?? manifest.bin.tsc6
    );
    const ts = require(path.dirname(manifestPath));
    const checked = new Set();
    // A solution config can contain no files; check its referenced projects too.
    /** @param {string} project */
    function checkProject(project) {
      if (checked.has(project)) return;
      checked.add(project);
      const source = ts.readConfigFile(project, ts.sys.readFile);
      if (source.error) throw new Error(`Cannot read ${project}`);
      const parsed = ts.parseJsonConfigFileContent(
        source.config,
        ts.sys,
        path.dirname(project),
        undefined,
        project
      );
      for (const reference of parsed.projectReferences ?? []) {
        checkProject(ts.resolveProjectReferencePath(reference));
      }
      execFileSync(
        process.execPath,
        [compiler, '--project', project, '--noEmit'],
        { cwd: path.dirname(project), stdio: 'inherit' }
      );
    }
    checkProject(config);
  } catch {
    failed = true;
    console.error(`Typecheck failed: ${directory}`);
  }
}
process.exitCode = failed ? 1 : 0;
