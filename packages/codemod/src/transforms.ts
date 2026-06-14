import ts from 'typescript';

/** Result of running codemod transforms over a single source file. */
export interface TransformResult {
  /** The transformed source text (unchanged if `changed` is false). */
  code: string;
  /** Whether any transform modified the source. */
  changed: boolean;
  /** Human-readable notes (e.g. flagged manual-migration sites). */
  notes: string[];
}

/** A single identifier rename applied to imports from `xstate`. */
interface Rename {
  from: string;
  to: string;
}

/**
 * Tier A renames (see CODEMOD_SPEC §2). Same-signature identifier swaps that
 * are 100% behavior-preserving. `fromPromise` is intentionally excluded — it
 * became config-based `createAsyncLogic({ run })`, which is a Tier B shape
 * change, not a rename.
 */
const XSTATE_RENAMES: Rename[] = [
  { from: 'interpret', to: 'createActor' },
  { from: 'fromCallback', to: 'createCallbackLogic' },
  { from: 'fromObservable', to: 'createObservableLogic' },
  { from: 'fromEventObservable', to: 'createEventObservableLogic' },
  { from: 'fromTransition', to: 'createTransitionLogic' }
];

const XSTATE_TYPE_RENAMES: Rename[] = [{ from: 'Interpreter', to: 'Actor' }];

const XSTATE_MODULES = new Set([
  'xstate',
  '@xstate/react',
  '@xstate/vue',
  '@xstate/svelte',
  '@xstate/solid'
]);

/**
 * Applies Tier A transforms to a source file. Only identifiers that are
 * actually imported from an xstate module are renamed, so unrelated local
 * symbols with the same name are left alone.
 */
export function transformSource(
  fileName: string,
  sourceText: string
): TransformResult {
  const notes: string[] = [];
  const scriptKind = fileName.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind
  );

  // 1. Determine which renameable identifiers are imported from xstate modules,
  //    and the set of removed `from*` value identifiers (for flagging).
  const valueRenames = new Map<string, string>();
  const typeRenames = new Map<string, string>();

  for (const stmt of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(stmt) ||
      !ts.isStringLiteral(stmt.moduleSpecifier) ||
      !XSTATE_MODULES.has(stmt.moduleSpecifier.text)
    ) {
      continue;
    }
    const named = stmt.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) {
      continue;
    }
    for (const el of named.elements) {
      // `el.propertyName` is the original name in `import { orig as alias }`.
      const imported = (el.propertyName ?? el.name).text;
      const v = XSTATE_RENAMES.find((r) => r.from === imported);
      if (v && !el.propertyName) {
        valueRenames.set(imported, v.to);
      } else if (v && el.propertyName) {
        // aliased import — rename the binding source only, leave local alias
        notes.push(
          `aliased import \`${imported} as ${el.name.text}\`: renamed import to \`${v.to}\`, local alias kept`
        );
      }
      const t = XSTATE_TYPE_RENAMES.find((r) => r.from === imported);
      if (t && !el.propertyName) {
        typeRenames.set(imported, t.to);
      }
    }
  }

  if (valueRenames.size === 0 && typeRenames.size === 0) {
    return { code: sourceText, changed: false, notes };
  }

  // 2. Transform: rename matching import specifiers and identifier references.
  const transformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
    const visit: ts.Visitor = (node) => {
      // Rename inside import specifiers (the import binding itself).
      if (ts.isImportSpecifier(node) && !node.propertyName) {
        const name = node.name.text;
        const to = valueRenames.get(name) ?? typeRenames.get(name);
        if (to) {
          return context.factory.updateImportSpecifier(
            node,
            node.isTypeOnly,
            undefined,
            context.factory.createIdentifier(to)
          );
        }
      }
      // Rename value/type references everywhere else.
      if (ts.isIdentifier(node)) {
        const to = valueRenames.get(node.text) ?? typeRenames.get(node.text);
        if (to && !isDeclarationName(node)) {
          return context.factory.createIdentifier(to);
        }
      }
      return ts.visitEachChild(node, visit, context);
    };
    return (sf) => ts.visitNode(sf, visit) as ts.SourceFile;
  };

  const result = ts.transform(sourceFile, [transformer]);
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const printed = printer.printFile(result.transformed[0]);
  result.dispose();

  return { code: printed, changed: true, notes };
}

/**
 * Avoid renaming the _declaration_ of a same-named local (e.g. a user's own
 * `function interpret() {}`); only references are renamed via import tracking,
 * but this guards the binding name of declarations defensively.
 */
function isDeclarationName(node: ts.Identifier): boolean {
  const parent = node.parent;
  return (
    (ts.isFunctionDeclaration(parent) ||
      ts.isVariableDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isParameter(parent)) &&
    (parent as any).name === node
  );
}
