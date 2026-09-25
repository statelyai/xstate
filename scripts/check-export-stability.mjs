// Verifies that every public export of the `xstate` package carries a
// stability tag (`@public`, `@experimental`, `@internal`; `@deprecated` must
// be paired with `@public` or `@experimental`).
//
// Usage: node scripts/check-export-stability.mjs [--json] [--list]
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'package.json'));
const ts = require('typescript');

const coreSrc = join(root, 'packages/core/src');
const entries = [
  'index.ts',
  'actors/index.ts',
  'graph/index.ts',
  'fsm/index.ts',
  'scxml/index.ts',
  'durable/index.ts',
  'validation/index.ts'
].map((file) => join(coreSrc, file));

const STABILITY = ['public', 'experimental', 'internal'];

// Pure check on the set of JSDoc tag names attached to an export.
export function checkStabilityTags(tags) {
  const found = STABILITY.filter((name) => tags.has(name));
  const stability = found.length === 1 ? found[0] : undefined;
  const deprecated = tags.has('deprecated');
  let problem;
  if (found.length > 1) {
    problem = `conflicting stability tags: ${found
      .map((name) => `@${name}`)
      .join(', ')}`;
  } else if (!stability) {
    problem = deprecated
      ? '@deprecated without @public or @experimental'
      : 'missing stability tag';
  } else if (deprecated && stability === 'internal') {
    problem = '@deprecated must pair with @public or @experimental';
  }
  return { stability: stability ?? 'untagged', deprecated, problem };
}

let checker;

function tagsOf(declaration) {
  const names = new Set();
  for (const tag of ts.getJSDocTags(declaration)) {
    names.add(tag.tagName.escapedText.toString());
  }
  return names;
}

function classify(symbol) {
  const target =
    symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol;
  const declarations = target.declarations ?? [];
  const tags = new Set();
  for (const declaration of declarations) {
    for (const tag of tagsOf(declaration)) tags.add(tag);
  }
  const first = declarations[0];
  const file = first ? first.getSourceFile().fileName : '<unknown>';
  const location = first
    ? `${relative(root, file)}:${
        first.getSourceFile().getLineAndCharacterOfPosition(first.getStart())
          .line + 1
      }`
    : '<unknown>';
  const external = file.includes('/node_modules/');
  const { stability, deprecated, problem } = checkStabilityTags(tags);
  return {
    stability: external ? 'external' : stability,
    deprecated,
    location,
    problem: external ? undefined : problem
  };
}

function main() {
  const args = new Set(process.argv.slice(2));
  const asJson = args.has('--json');
  const listAll = args.has('--list');

  const program = ts.createProgram(entries, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    allowImportingTsExtensions: true,
    noEmit: true,
    skipLibCheck: true,
    resolveJsonModule: true,
    strict: true,
    lib: ['lib.es2024.d.ts', 'lib.dom.d.ts'],
    types: []
  });
  checker = program.getTypeChecker();

  const report = [];
  for (const entry of entries) {
    const sourceFile = program.getSourceFile(entry);
    const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) {
      console.error(`Could not resolve entry ${relative(root, entry)}`);
      process.exit(2);
    }
    const exports = checker
      .getExportsOfModule(moduleSymbol)
      .map((symbol) => ({ name: symbol.getName(), ...classify(symbol) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    report.push({ entry: relative(root, entry), exports });
  }

  const failures = report
    .map(({ entry, exports }) => ({
      entry,
      exports: exports.filter((item) => item.problem)
    }))
    .filter(({ exports }) => exports.length > 0);

  function counts(exports) {
    const result = { public: 0, experimental: 0, internal: 0, deprecated: 0 };
    for (const item of exports) {
      if (item.stability in result) result[item.stability]++;
      if (item.deprecated) result.deprecated++;
    }
    return result;
  }

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          ok: failures.length === 0,
          entries: report.map(({ entry, exports }) => ({
            entry,
            counts: counts(exports),
            exports: listAll ? exports : undefined
          })),
          failures
        },
        null,
        2
      )
    );
  } else {
    for (const { entry, exports } of report) {
      const c = counts(exports);
      console.log(
        `${entry}: ${exports.length} exports (public ${c.public}, experimental ${c.experimental}, internal ${c.internal}, deprecated ${c.deprecated})`
      );
      if (listAll) {
        for (const item of exports) {
          const tag = item.stability + (item.deprecated ? ' +deprecated' : '');
          console.log(
            `  ${item.name.padEnd(40)} ${tag.padEnd(24)} ${item.location}`
          );
        }
      }
    }
    for (const { entry, exports } of failures) {
      console.error(
        `\n${entry}: ${exports.length} export(s) need a stability tag`
      );
      for (const item of exports) {
        console.error(`  ${item.name} (${item.location}): ${item.problem}`);
      }
    }
    if (failures.length === 0)
      console.log('\nAll exports carry a stability tag.');
  }

  process.exitCode = failures.length === 0 ? 0 : 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
