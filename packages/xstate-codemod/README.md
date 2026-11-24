# @xstate/codemod

<!-- CLI commands and transforms from src/cli.ts and src/transforms/index.ts -->
Run `xstate-codemod migrate [globs...] --dry` to review a v5-to-v6 migration. Omit `--dry` to save changes. The default scan includes TypeScript and JavaScript files, excluding `node_modules` and `dist`.

The transforms rename imports, wrap string targets, convert inline `types` declarations to schemas, report APIs requiring manual migration, and report `#id.path` targets that v6 no longer resolves. `--transform name,name` selects transforms.

`--json` prints a single JSON report to stdout, including a `manualSites` list with the file, line, column, API and hint for each manual migration step. The command exits with `0` when no manual migration is needed, `1` on a usage error or invalid migration output, and `2` when manual migration is needed.

<!-- helper binding and output validation from src/util.ts, src/transforms/types-to-schemas.ts and src/runner.ts -->
The codemod supports named, namespace and type-only imports. It checks transformed syntax before saving. Run your application's typecheck and tests after migration, and review any reported manual migration steps.

The `string-targets` transform also wraps inline `xstate/fsm` targets in `on` and `always`, including `setup(...).createFSM` and aliased `createFSM` imports. It preserves string `initial` values. Review separately stored configurations and string-returning transition functions manually.
