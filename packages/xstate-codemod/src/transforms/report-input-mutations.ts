import {
  Node,
  SourceFile,
  SyntaxKind,
  VariableDeclarationKind
} from 'ts-morph';
import type { ManualSite, Transform, TransformResult } from '../types.ts';

const LOGIC_CREATORS = new Set([
  'fromPromise',
  'fromCallback',
  'createAsyncLogic',
  'createCallbackLogic'
]);

const ARRAY_MUTATORS = new Set([
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse',
  'fill',
  'copyWithin'
]);

const HINT =
  'v6 development builds deep-freeze context, and `input` built from context shares those frozen objects, so this write throws `TypeError: Cannot assign to read only property`. Return a new object instead of mutating `input`, or copy it before handing it to UI that binds to it. See "Context is frozen in development" in docs/xstate-v5-to-v6.md.';

const COMPOUND_ASSIGNMENTS = new Set([
  SyntaxKind.EqualsToken,
  SyntaxKind.PlusEqualsToken,
  SyntaxKind.MinusEqualsToken,
  SyntaxKind.AsteriskEqualsToken,
  SyntaxKind.AsteriskAsteriskEqualsToken,
  SyntaxKind.SlashEqualsToken,
  SyntaxKind.PercentEqualsToken,
  SyntaxKind.LessThanLessThanEqualsToken,
  SyntaxKind.GreaterThanGreaterThanEqualsToken,
  SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken,
  SyntaxKind.AmpersandEqualsToken,
  SyntaxKind.BarEqualsToken,
  SyntaxKind.CaretEqualsToken,
  SyntaxKind.AmpersandAmpersandEqualsToken,
  SyntaxKind.BarBarEqualsToken,
  SyntaxKind.QuestionQuestionEqualsToken
]);

function unwrap(node: Node): Node {
  let current = node;
  while (
    Node.isParenthesizedExpression(current) ||
    Node.isNonNullExpression(current) ||
    Node.isAsExpression(current) ||
    Node.isTypeAssertion(current) ||
    Node.isSatisfiesExpression(current)
  ) {
    current = current.getExpression();
  }
  return current;
}

/** Resolves an in-file function declaration or `const f = () => ...`. */
function resolveFunction(node: Node | undefined): Node | undefined {
  if (!node) return undefined;
  const value = unwrap(node);
  if (Node.isArrowFunction(value) || Node.isFunctionExpression(value)) {
    return value;
  }
  if (!Node.isIdentifier(value)) return undefined;
  for (const decl of value.getSymbol()?.getDeclarations() ?? []) {
    if (Node.isFunctionDeclaration(decl)) return decl;
    if (Node.isVariableDeclaration(decl)) {
      const init = decl.getInitializer();
      if (init && !Node.isIdentifier(unwrap(init))) {
        return resolveFunction(init);
      }
    }
  }
  return undefined;
}

/** The logic function passed to a creator: `fn` or `{ run: fn }`. */
function getLogicFunction(arg: Node | undefined): Node | undefined {
  if (!arg) return undefined;
  const value = unwrap(arg);
  if (Node.isObjectLiteralExpression(value)) {
    const run = value.getProperty('run');
    if (Node.isPropertyAssignment(run)) {
      return resolveFunction(run.getInitializer());
    }
    if (Node.isShorthandPropertyAssignment(run)) {
      for (const decl of run.getValueSymbol()?.getDeclarations() ?? []) {
        if (Node.isFunctionDeclaration(decl)) return decl;
        if (Node.isVariableDeclaration(decl)) {
          return resolveFunction(decl.getInitializer());
        }
      }
      return undefined;
    }
    if (Node.isMethodDeclaration(run)) return run;
    return undefined;
  }
  return resolveFunction(value);
}

/**
 * Reports (does NOT transform) in-place writes to `input` inside promise and
 * callback logic. Input is usually built from context, which v6 deep-freezes
 * in development, so these writes throw at runtime.
 */
export const reportInputMutations: Transform = {
  name: 'report-input-mutations',
  description:
    'Detect (report only) assignments, `delete`, and array mutator calls on `input` inside fromPromise/fromCallback/createAsyncLogic/createCallbackLogic bodies, which throw on frozen context in v6 development builds.',
  apply(sourceFile: SourceFile): TransformResult {
    const notes: string[] = [];
    const sites: ManualSite[] = [];
    const filePath = sourceFile.getFilePath();

    const creators = new Set<string>();
    for (const imp of sourceFile.getImportDeclarations()) {
      if (imp.getModuleSpecifierValue() !== 'xstate') continue;
      for (const spec of imp.getNamedImports()) {
        if (LOGIC_CREATORS.has(spec.getNameNode().getText())) {
          creators.add((spec.getAliasNode() ?? spec.getNameNode()).getText());
        }
      }
    }
    if (creators.size === 0) return { changed: false, notes, sites };

    // Declarations whose binding refers to (part of) `input`.
    const inputBindings = new Set<Node>();
    // Declarations of the whole first parameter, e.g. `args` in `args.input`.
    const argBindings = new Set<Node>();
    const bodies: Node[] = [];

    const trackPattern = (pattern: Node) => {
      if (Node.isIdentifier(pattern)) {
        const parent = pattern.getParent();
        if (parent) inputBindings.add(parent);
        return;
      }
      if (
        Node.isObjectBindingPattern(pattern) ||
        Node.isArrayBindingPattern(pattern)
      ) {
        for (const element of pattern.getElements()) {
          if (Node.isBindingElement(element) && !element.getDotDotDotToken()) {
            const name = element.getNameNode();
            if (Node.isIdentifier(name)) inputBindings.add(element);
            else trackPattern(name);
          }
        }
      }
    };

    for (const call of sourceFile.getDescendantsOfKind(
      SyntaxKind.CallExpression
    )) {
      const callee = call.getExpression();
      if (!Node.isIdentifier(callee) || !creators.has(callee.getText())) {
        continue;
      }
      const fn = getLogicFunction(call.getArguments()[0]);
      if (
        !fn ||
        !(
          Node.isArrowFunction(fn) ||
          Node.isFunctionExpression(fn) ||
          Node.isFunctionDeclaration(fn) ||
          Node.isMethodDeclaration(fn)
        )
      ) {
        continue;
      }
      const param = fn.getParameters()[0];
      if (!param) continue;
      const name = param.getNameNode();
      if (Node.isIdentifier(name)) {
        argBindings.add(param);
      } else if (Node.isObjectBindingPattern(name)) {
        for (const element of name.getElements()) {
          const key = (
            element.getPropertyNameNode() ?? element.getNameNode()
          ).getText();
          if (key !== 'input') continue;
          const binding = element.getNameNode();
          if (Node.isIdentifier(binding)) inputBindings.add(element);
          else trackPattern(binding);
        }
      }
      const body = fn.getBody();
      if (body) bodies.push(body);
    }

    const declaredBy = (ident: Node, set: Set<Node>) =>
      (Node.isIdentifier(ident) &&
        ident
          .getSymbol()
          ?.getDeclarations()
          .some((d) => set.has(d))) ??
      false;

    /** Whether `node` is `input`, an alias of it, or `args.input`. */
    const isInputRoot = (node: Node): boolean => {
      const value = unwrap(node);
      if (Node.isIdentifier(value)) return declaredBy(value, inputBindings);
      if (
        Node.isPropertyAccessExpression(value) &&
        value.getName() === 'input'
      ) {
        return declaredBy(unwrap(value.getExpression()), argBindings);
      }
      return false;
    };

    /** Whether `node` is a member path strictly below an input root. */
    const isInputPath = (node: Node): boolean => {
      const value = unwrap(node);
      if (
        !Node.isPropertyAccessExpression(value) &&
        !Node.isElementAccessExpression(value)
      ) {
        return false;
      }
      const object = value.getExpression();
      return isInputRoot(object) || isInputPath(object);
    };

    /** Whether `node` is an input root or any path below one. */
    const refersToInput = (node: Node) =>
      isInputRoot(node) || isInputPath(node);

    // `const note = input.note` and `const { note } = input` alias input.
    // Fixed point so aliases of aliases are found too.
    let grew = true;
    while (grew) {
      grew = false;
      for (const body of bodies) {
        for (const decl of body.getDescendantsOfKind(
          SyntaxKind.VariableDeclaration
        )) {
          const list = decl.getParent();
          if (
            !Node.isVariableDeclarationList(list) ||
            list.getDeclarationKind() !== VariableDeclarationKind.Const
          ) {
            continue;
          }
          const init = decl.getInitializer();
          if (!init || !refersToInput(init)) continue;
          const before = inputBindings.size;
          trackPattern(decl.getNameNode());
          if (inputBindings.size > before) grew = true;
        }
      }
    }

    const seen = new Set<Node>();
    const report = (node: Node, api: string) => {
      if (seen.has(node)) return;
      seen.add(node);
      const { line, column } = sourceFile.getLineAndColumnAtPos(
        node.getStart()
      );
      sites.push({ file: filePath, line, column, api, hint: HINT });
    };

    for (const body of bodies) {
      body.forEachDescendant((node) => {
        if (Node.isBinaryExpression(node)) {
          const op = node.getOperatorToken().getKind();
          if (COMPOUND_ASSIGNMENTS.has(op) && isInputPath(node.getLeft())) {
            report(node, 'input-assignment');
          }
          return;
        }
        if (
          Node.isPrefixUnaryExpression(node) ||
          Node.isPostfixUnaryExpression(node)
        ) {
          const op = node.getOperatorToken();
          if (
            (op === SyntaxKind.PlusPlusToken ||
              op === SyntaxKind.MinusMinusToken) &&
            isInputPath(node.getOperand())
          ) {
            report(node, 'input-assignment');
          }
          return;
        }
        if (Node.isDeleteExpression(node)) {
          if (isInputPath(node.getExpression())) report(node, 'input-delete');
          return;
        }
        if (Node.isCallExpression(node)) {
          const callee = unwrap(node.getExpression());
          if (Node.isPropertyAccessExpression(callee)) {
            const method = callee.getName();
            if (
              ARRAY_MUTATORS.has(method) &&
              refersToInput(callee.getExpression())
            ) {
              report(node, `input-${method}`);
            } else if (
              method === 'assign' &&
              unwrap(callee.getExpression()).getText() === 'Object' &&
              node.getArguments()[0] &&
              refersToInput(node.getArguments()[0])
            ) {
              report(node, 'input-object-assign');
            }
          }
        }
      });
    }

    sites.sort((a, b) => a.line - b.line || a.column - b.column);
    for (const site of sites) {
      notes.push(
        `${site.file}:${site.line}:${site.column} — '${site.api}' → ${site.hint}`
      );
    }

    // Never mutates the file.
    return { changed: false, notes, sites };
  }
};
