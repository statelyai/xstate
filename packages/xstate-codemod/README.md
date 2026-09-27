# @xstate/codemod

<!-- CLI commands and transforms from src/cli.ts and src/transforms/index.ts -->
Run `xstate-codemod migrate [globs...] --dry` to review a v5-to-v6 migration. Omit `--dry` to save changes. The default scan includes TypeScript and JavaScript files, excluding `node_modules` and `dist`.

The transforms rename imports, wrap string targets, convert inline `types` declarations to schemas, and report APIs requiring manual migration. `--transform name,name` selects transforms.

<!-- helper binding and output validation from src/util.ts, src/transforms/types-to-schemas.ts and src/runner.ts -->
Schema helpers use value imports, preserve usable aliases, and avoid conflicting local names. Namespace and type-only imports are supported. Event payload separators and escaped event names retain their meaning. The runner checks transformed syntax before saving; generated code still needs your application's typecheck and tests, and reported manual migrations still need review.
