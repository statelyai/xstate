# @xstate/codemod

<!-- CLI commands and transforms from src/cli.ts and src/transforms/index.ts -->
Run `xstate-codemod migrate [globs...] --dry` to review a v5-to-v6 migration. Omit `--dry` to save changes. The default scan includes TypeScript and JavaScript files, excluding `node_modules` and `dist`.

The transforms rename imports, wrap string targets, convert inline `types` declarations to schemas, report APIs requiring manual migration, and report `#id.path` targets that v6 no longer resolves. `--transform name,name` selects transforms.

<!-- helper binding and output validation from src/util.ts, src/transforms/types-to-schemas.ts and src/runner.ts -->
The codemod supports named, namespace and type-only imports. It checks transformed syntax before saving. Run your application's typecheck and tests after migration, and review any reported manual migration steps.
