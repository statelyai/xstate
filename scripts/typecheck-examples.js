// @ts-check
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const selected = process.argv.slice(2);

/** The workspace globs that hold examples, mirroring `pnpm-workspace.yaml`. */
const exampleParents = [
  path.join(root, 'examples'),
  path.join(root, 'examples', '_shared')
];

/** @param {string} parent */
function childDirectories(parent) {
  if (!fs.existsSync(parent)) return [];
  return fs
    .readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
    .map((entry) => path.join(parent, entry.name));
}

const examples = selected.length
  ? selected.map((name) =>
      path.isAbsolute(name) || name.includes('/')
        ? path.resolve(name)
        : path.join(root, 'examples', name)
    )
  : exampleParents.flatMap(childDirectories);

/**
 * `tsc` cannot parse `.vue` or `.svelte` single-file components: it fails to
 * resolve their imports, and where an ambient `declare module '*.svelte'` hides
 * that, it reports success without ever reading the component. Each project
 * picks the checker that understands the sources it actually includes.
 *
 * @param {string} directory
 * @param {'svelte-check' | 'vue-tsc' | 'typescript'} tool
 */
function resolveTool(directory, tool) {
  const manifestPath = require.resolve(`${tool}/package.json`, {
    paths: [directory, root]
  });
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const bin = manifest.bin;
  return path.resolve(
    path.dirname(manifestPath),
    typeof bin === 'string' ? bin : (bin[tool] ?? bin.tsc ?? bin.tsc6)
  );
}

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
    const ts = require(
      path.dirname(
        require.resolve('typescript/package.json', { paths: [directory, root] })
      )
    );
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

      const sources = [
        ...(source.config.include ?? []),
        ...(source.config.files ?? [])
      ];
      const [command, args] = sources.some((glob) => glob.endsWith('.svelte'))
        ? [resolveTool(directory, 'svelte-check'), ['--tsconfig', project]]
        : sources.some((glob) => glob.endsWith('.vue'))
          ? [
              resolveTool(directory, 'vue-tsc'),
              ['--project', project, '--noEmit']
            ]
          : [
              resolveTool(directory, 'typescript'),
              ['--project', project, '--noEmit']
            ];

      execFileSync(process.execPath, [command, ...args], {
        cwd: path.dirname(project),
        stdio: 'inherit'
      });
    }
    checkProject(config);
  } catch {
    failed = true;
    console.error(`Typecheck failed: ${directory}`);
  }
}
process.exitCode = failed ? 1 : 0;
