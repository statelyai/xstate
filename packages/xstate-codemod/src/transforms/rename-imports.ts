import { Node, SourceFile, SyntaxKind } from 'ts-morph';
import type { Transform, TransformResult } from '../types.ts';

/** Map of v5 xstate exports → v6 replacement names. */
const RENAMES: Record<string, string> = {
  interpret: 'createActor',
  Interpreter: 'Actor',
  fromCallback: 'createCallbackLogic',
  fromObservable: 'createObservableLogic',
  fromEventObservable: 'createEventObservableLogic'
};

/**
 * Renames imports (and their usages) from `'xstate'` to their v6 equivalents.
 * Preserves aliases: `import { interpret as x }` keeps `x` but renames the
 * imported binding to `createActor`.
 */
export const renameImports: Transform = {
  name: 'rename-imports',
  description:
    "Rename renamed 'xstate' imports (interpret→createActor, Interpreter→Actor, fromCallback/fromObservable/fromEventObservable→create*Logic) and their usages.",
  apply(sourceFile: SourceFile): TransformResult {
    const notes: string[] = [];
    let changed = false;

    const xstateImports = sourceFile
      .getImportDeclarations()
      .filter((imp) => imp.getModuleSpecifierValue() === 'xstate');

    for (const imp of xstateImports) {
      for (const spec of imp.getNamedImports()) {
        const importedName = spec.getNameNode().getText();
        const replacement = RENAMES[importedName];
        if (!replacement) {
          continue;
        }

        const aliasNode = spec.getAliasNode();
        if (aliasNode) {
          // Aliased: rename only the imported binding, keep the alias.
          // `interpret as x` → `createActor as x`
          spec.getNameNode().replaceWithText(replacement);
          notes.push(
            `renamed import '${importedName}' → '${replacement}' (alias '${aliasNode.getText()}' preserved)`
          );
        } else {
          // Not aliased: rename the binding and every reference to it.
          const nameNode = spec.getNameNode();
          const refs = Node.isIdentifier(nameNode)
            ? nameNode
                .findReferencesAsNodes()
                .filter((n) => n !== nameNode)
            : [];
          for (const ref of refs) {
            if (ref.getKind() === SyntaxKind.Identifier) {
              ref.replaceWithText(replacement);
            }
          }
          nameNode.replaceWithText(replacement);
          notes.push(
            `renamed '${importedName}' → '${replacement}'${
              refs.length ? ` and ${refs.length} usage(s)` : ''
            }`
          );
        }
        changed = true;
      }
    }

    return { changed, notes };
  }
};
