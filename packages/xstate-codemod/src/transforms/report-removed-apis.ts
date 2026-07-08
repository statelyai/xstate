import { SourceFile, SyntaxKind } from 'ts-morph';
import type { Transform, TransformResult } from '../types.ts';

/**
 * v5 `'xstate'` exports that require structural rewrites in v6 and are too
 * risky to automate. Value is a one-line hint for the v6 replacement.
 */
const REMOVED_APIS: Record<string, string> = {
  assign: 'return a `{ context }` patch from the transition/action function',
  raise: 'use `enq.raise(...)` inside an action',
  sendTo: 'use `enq.sendTo(...)` inside an action',
  sendParent: 'use `enq.sendTo(...)` with the parent ref inside an action',
  forwardTo: 'use `enq.sendTo(target, event)` inside an action',
  emit: 'use `enq.emit(...)` inside an action',
  log: 'use `enq.log(...)` inside an action',
  cancel: 'use `enq.cancel(...)` inside an action',
  spawnChild: 'use `enq.spawn(...)` inside an action',
  stop: 'use `enq.stop(...)` inside an action',
  stopChild: 'use `enq.stop(...)` inside an action',
  enqueueActions: 'action functions now receive an `enq` enqueue object directly',
  and: 'inline the guard as `(...) => a(...) && b(...)`',
  or: 'inline the guard as `(...) => a(...) || b(...)`',
  not: 'inline the guard as `(...) => !a(...)`',
  stateIn: 'use `self.getSnapshot().matches(...)` or `checkStateIn(snapshot, "#id")`',
  fromPromise: 'use `createAsyncLogic(...)`',
  fromTransition: 'use `createLogic({ context, run })`'
};

/**
 * Detects (does NOT transform) usages of v5 `'xstate'` APIs that were removed
 * or restructured in v6. Reports file:line + API + a replacement hint via the
 * returned notes.
 */
export const reportRemovedApis: Transform = {
  name: 'report-removed-apis',
  description:
    'Detect (report only) usages of removed/restructured v5 xstate APIs (assign, raise, sendTo, emit, fromPromise, and/or/not, etc.) that need manual migration.',
  apply(sourceFile: SourceFile): TransformResult {
    const notes: string[] = [];

    const xstateImports = sourceFile
      .getImportDeclarations()
      .filter((imp) => imp.getModuleSpecifierValue() === 'xstate');

    // Map local binding name → canonical API name (respecting aliases).
    const tracked = new Map<string, string>();
    for (const imp of xstateImports) {
      for (const spec of imp.getNamedImports()) {
        const original = spec.getNameNode().getText();
        if (REMOVED_APIS[original]) {
          const local = (spec.getAliasNode() ?? spec.getNameNode()).getText();
          tracked.set(local, original);
        }
      }
    }

    if (tracked.size === 0) {
      return { changed: false, notes };
    }

    const filePath = sourceFile.getFilePath();

    for (const ident of sourceFile.getDescendantsOfKind(
      SyntaxKind.Identifier
    )) {
      const local = ident.getText();
      const api = tracked.get(local);
      if (!api) {
        continue;
      }
      // Skip the import specifier declarations themselves.
      const parentKind = ident.getParent()?.getKind();
      if (
        parentKind === SyntaxKind.ImportSpecifier ||
        parentKind === SyntaxKind.ImportClause
      ) {
        continue;
      }
      const { line, column } = sourceFile.getLineAndColumnAtPos(ident.getPos());
      notes.push(
        `${filePath}:${line}:${column} — '${api}' → ${REMOVED_APIS[api]}`
      );
    }

    // Never mutates the file.
    return { changed: false, notes };
  }
};
