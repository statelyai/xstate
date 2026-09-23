import {
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
  SyntaxKind,
  TypeNode
} from 'ts-morph';
import type { Transform, TransformResult } from '../types.ts';
import { ensureNamedImport, findMachineConfigObjects } from '../util.ts';

/**
 * Extracts the `T` type node from a `{} as T` (AsExpression) initializer of a
 * `types:` property. Returns undefined if the shape isn't recognized.
 */
function getTypesAsTypeNode(init: Node): TypeNode | undefined {
  if (!Node.isAsExpression(init)) {
    return undefined;
  }
  return init.getTypeNode();
}

/**
 * Given a union type node written as an inline literal union of object types,
 * each with a `type: '...'` discriminant, returns a map entry list of
 * `[eventType, remainingObjectTypeText]`. Returns undefined when the union is
 * not a literal inline union of object types with string-literal `type` props.
 */
function unionToEventMap(
  typeNode: TypeNode
): Array<{ eventType: string; payload: string }> | undefined {
  const members: TypeNode[] = Node.isUnionTypeNode(typeNode)
    ? typeNode.getTypeNodes()
    : [typeNode];

  const entries: Array<{ eventType: string; payload: string }> = [];

  for (const member of members) {
    if (!Node.isTypeLiteral(member)) {
      return undefined; // e.g. a type reference — bail out entirely
    }
    const lit = member;
    const props = lit.getProperties();
    const typeProp = props.find((p) => p.getName() === 'type');
    if (!typeProp) {
      return undefined;
    }
    const typePropTypeNode = typeProp.getTypeNode();
    if (
      !typePropTypeNode ||
      typePropTypeNode.getKind() !== SyntaxKind.LiteralType
    ) {
      return undefined;
    }
    const literal = typePropTypeNode.getFirstChild();
    if (!literal || !Node.isStringLiteral(literal)) return undefined;
    const eventType = literal.getLiteralValue();

    // Build payload object type text from the remaining props.
    const payloadProps = props
      .filter((p) => p.getName() !== 'type')
      .map((p) => p.getText().replace(/[;,]\s*$/, ''));
    const payload = payloadProps.length
      ? `{ ${payloadProps.join('; ')} }`
      : `{}`;
    entries.push({ eventType, payload });
  }

  return entries;
}

function getKey(prop: PropertyAssignment): string | undefined {
  const nameNode = prop.getNameNode();
  if (Node.isIdentifier(nameNode)) {
    return nameNode.getText();
  }
  if (Node.isStringLiteral(nameNode)) {
    return nameNode.getLiteralText();
  }
  return undefined;
}

/**
 * Converts a single `types: {} as { ... }` property into a `schemas: { ... }`
 * property. Mutates the containing config object literal.
 */
function convertTypesProperty(
  configObj: ObjectLiteralExpression,
  typesProp: PropertyAssignment,
  notes: string[]
): boolean {
  const init = typesProp.getInitializerOrThrow();
  const typeNode = getTypesAsTypeNode(init);

  if (!typeNode) {
    return false;
  }

  // `types: {} as any` (or non-object) — cannot infer a shape; leave a note.
  if (!Node.isTypeLiteral(typeNode)) {
    notes.push(
      `left 'types' unchanged: initializer is not an inline object type ({} as ${typeNode.getText()})`
    );
    typesProp.replaceWithText(
      `${typesProp.getText()} /* TODO(xstate-codemod): could not migrate 'types' to 'schemas' automatically */`
    );
    return false;
  }

  const lit = typeNode;
  const schemaEntries: Array<(helper: string) => string> = [];
  let usedTypes = false;
  let eventsLeftBehind = false;

  for (const member of lit.getProperties()) {
    const key = member.getName();
    const valueTypeNode = member.getTypeNode();
    if (!valueTypeNode) {
      continue;
    }

    if (key === 'events') {
      const map = unionToEventMap(valueTypeNode);
      if (!map) {
        // Not a literal inline union — leave events in `types`, add a TODO.
        eventsLeftBehind = true;
        notes.push(
          `could not migrate 'events' to schemas.events map (not a literal inline union); left in place`
        );
        continue;
      }
      schemaEntries.push((helper) => {
        const mapEntries = map.map(
          (e) => `${JSON.stringify(e.eventType)}: ${helper}<${e.payload}>()`
        );
        return `events: {\n    ${mapEntries.join(',\n    ')}\n  }`;
      });
      usedTypes = true;
    } else {
      // context, input, output, emitted, tags, meta, ... → types<T>()
      const valueType = valueTypeNode.getText();
      schemaEntries.push((helper) => `${key}: ${helper}<${valueType}>()`);
      usedTypes = true;
    }
  }

  if (schemaEntries.length === 0) {
    return false;
  }

  const helper = usedTypes
    ? ensureNamedImport(configObj.getSourceFile(), 'types', configObj)
    : undefined;
  if (!helper) {
    notes.push("left 'types' unchanged: no xstate runtime import available");
    return false;
  }

  const schemasText = `schemas: {\n  ${schemaEntries.map((entry) => entry(helper)).join(',\n  ')}\n}`;

  if (eventsLeftBehind) {
    // Keep the original `types` property (holding only the un-migratable
    // events) alongside the new `schemas` property.
    // Rebuild `types` with only the `events` member preserved.
    const eventsMember = lit
      .getProperties()
      .find((p) => p.getName() === 'events');
    const preservedTypes = eventsMember
      ? `types: {} as { ${eventsMember.getText()} } /* TODO(xstate-codemod): migrate events to schemas.events map */`
      : typesProp.getText();
    typesProp.replaceWithText(`${schemasText},\n  ${preservedTypes}`);
  } else {
    typesProp.replaceWithText(schemasText);
  }

  notes.push(
    `converted 'types' → 'schemas' (${schemaEntries.length} key(s))${
      eventsLeftBehind ? "; 'events' left as types (manual)" : ''
    }`
  );
  return true;
}

/**
 * Converts `types: {} as { context; events; input; ... }` inside machine config
 * objects into `schemas: { context: types<...>(), ... }`.
 */
export const typesToSchemas: Transform = {
  name: 'types-to-schemas',
  description:
    'Convert `types: {} as {...}` into `schemas: { context: types<C>(), events: { ... }, input: types<I>() }`. Events are converted to a map only when written as a literal inline union.',
  apply(sourceFile: SourceFile): TransformResult {
    const notes: string[] = [];
    let changed = false;

    for (const configObj of findMachineConfigObjects(sourceFile, [
      'createMachine',
      'createStateConfig',
      'setup'
    ])) {
      for (const prop of configObj.getProperties()) {
        if (Node.isPropertyAssignment(prop) && getKey(prop) === 'types') {
          if (convertTypesProperty(configObj, prop, notes)) {
            changed = true;
          }
        }
      }
    }

    return { changed, notes };
  }
};
