import {
  Node,
  ObjectLiteralExpression,
  PropertyAssignment,
  SourceFile,
  SyntaxKind,
  TypeNode
} from 'ts-morph';
import type { ManualSite, Transform, TransformResult } from '../types.ts';
import { ensureNamedImport, findMachineConfigObjects } from '../util.ts';

type EventEntry = { eventType: string; payload: string };

/**
 * Flattens an events type into `[eventType, payloadTypeText]` entries. Accepts
 * inline object literal members with a string-literal `type`, and references
 * to non-generic type aliases declared in the same file. Returns undefined for
 * any other member (imported types, interfaces, mapped types, ...).
 */
function eventsToEventMap(
  typeNode: TypeNode,
  seen = new Set<string>()
): EventEntry[] | undefined {
  if (Node.isParenthesizedTypeNode(typeNode)) {
    return eventsToEventMap(typeNode.getTypeNode(), seen);
  }
  if (Node.isUnionTypeNode(typeNode)) {
    const entries: EventEntry[] = [];
    for (const member of typeNode.getTypeNodes()) {
      const memberEntries = eventsToEventMap(member, seen);
      if (!memberEntries) return undefined;
      entries.push(...memberEntries);
    }
    return entries;
  }
  if (Node.isTypeReference(typeNode)) {
    const name = typeNode.getTypeName();
    if (!Node.isIdentifier(name) || typeNode.getTypeArguments().length) {
      return undefined;
    }
    const alias = typeNode.getSourceFile().getTypeAlias(name.getText());
    const aliased = alias?.getTypeNode();
    if (!alias || !aliased || alias.getTypeParameters().length) {
      return undefined;
    }
    if (seen.has(alias.getName())) return undefined;
    return eventsToEventMap(aliased, new Set(seen).add(alias.getName()));
  }
  if (!Node.isTypeLiteral(typeNode)) return undefined;

  const props = typeNode.getProperties();
  if (props.length !== typeNode.getMembers().length) return undefined;
  const typePropTypeNode = props
    .find((p) => p.getName() === 'type')
    ?.getTypeNode();
  if (!typePropTypeNode || !Node.isLiteralTypeNode(typePropTypeNode)) {
    return undefined;
  }
  const literal = typePropTypeNode.getLiteral();
  if (!Node.isStringLiteral(literal)) return undefined;

  // Build payload object type text from the remaining props.
  const payloadProps = props
    .filter((p) => p.getName() !== 'type')
    .map((p) => p.getText().replace(/[;,]\s*$/, ''));
  const payload = payloadProps.length ? `{ ${payloadProps.join('; ')} }` : `{}`;
  return [{ eventType: literal.getLiteralValue(), payload }];
}

/**
 * Reads the members of a `types` initializer, written either as
 * `{} as { context: C; events: E }` or per key as
 * `{ context: {} as C, events: {} as E }`. Returns `'opaque'` for `{} as T`
 * where `T` is not an inline object type, and undefined for any other shape.
 */
function getTypesMembers(
  init: Node
): Array<{ key: string; typeNode: TypeNode }> | 'opaque' | undefined {
  if (Node.isAsExpression(init)) {
    const typeNode = init.getTypeNode();
    if (!typeNode) return undefined;
    if (!Node.isTypeLiteral(typeNode)) return 'opaque';
    return typeNode.getProperties().flatMap((member) => {
      const memberType = member.getTypeNode();
      return memberType
        ? [{ key: member.getName(), typeNode: memberType }]
        : [];
    });
  }
  if (!Node.isObjectLiteralExpression(init)) return undefined;
  const members: Array<{ key: string; typeNode: TypeNode }> = [];
  for (const prop of init.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) return undefined;
    const key = getKey(prop);
    const value = prop.getInitializer();
    const typeNode =
      value && Node.isAsExpression(value) ? value.getTypeNode() : undefined;
    if (!key || !typeNode) return undefined;
    members.push({ key, typeNode });
  }
  return members;
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

const LEFTOVER_TYPES_HINT =
  '`types` was replaced by `schemas`; declare events as a map `schemas: { events: { TYPE: types<Payload>() } }`, or use `types<EventUnion>()` when the union is not inline.';

const EVENTS_FALLBACK_HINT =
  '`events: types<E>()` loads but does not type-check as a v6 event map; expand `E` into `events: { TYPE: types<Payload>(), ... }`.';

/** Records a manual site for a `types` property left at `pos`. */
function pushLeftoverSite(
  sourceFile: SourceFile,
  pos: number,
  sites: ManualSite[]
): void {
  const { line, column } = sourceFile.getLineAndColumnAtPos(pos);
  sites.push({
    file: sourceFile.getFilePath(),
    line,
    column,
    api: 'types',
    hint: LEFTOVER_TYPES_HINT
  });
}

/**
 * Converts a single `types` property into a `schemas: { ... }` property.
 * Mutates the containing config object literal.
 */
function convertTypesProperty(
  configObj: ObjectLiteralExpression,
  typesProp: PropertyAssignment,
  notes: string[],
  sites: ManualSite[],
  getHelper: (location: Node) => string | undefined
): boolean {
  const sourceFile = configObj.getSourceFile();
  const start = typesProp.getStart();
  const members = getTypesMembers(typesProp.getInitializerOrThrow());

  if (!members) {
    pushLeftoverSite(sourceFile, start, sites);
    return false;
  }

  // `types: {} as any` (or non-object) — cannot infer a shape; leave a note.
  if (members === 'opaque') {
    notes.push(
      `left 'types' unchanged: initializer is not an inline object type (${typesProp.getInitializerOrThrow().getText()})`
    );
    pushLeftoverSite(sourceFile, start, sites);
    typesProp.replaceWithText(
      `${typesProp.getText()} /* TODO(xstate-codemod): could not migrate 'types' to 'schemas' automatically */`
    );
    return false;
  }

  if (members.length === 0) return false;

  const helper = getHelper(configObj);
  if (!helper) {
    notes.push("left 'types' unchanged: no xstate runtime import available");
    pushLeftoverSite(sourceFile, start, sites);
    return false;
  }

  let eventsFallback = false;
  const schemaEntries = members.map(({ key, typeNode }) => {
    if (key === 'events') {
      const map = eventsToEventMap(typeNode);
      if (map) {
        const mapEntries = map.map(
          (e) => `${JSON.stringify(e.eventType)}: ${helper}<${e.payload}>()`
        );
        return `events: {\n    ${mapEntries.join(',\n    ')}\n  }`;
      }
      notes.push(
        `'events' is not an inline literal union or a same-file alias of one; wrote it as a single ${helper}<...>() schema`
      );
      eventsFallback = true;
    }
    // context, input, output, emitted, tags, meta, ... → types<T>()
    return `${key}: ${helper}<${typeNode.getText()}>()`;
  });

  typesProp.replaceWithText(`schemas: {\n  ${schemaEntries.join(',\n  ')}\n}`);
  if (eventsFallback) {
    // `events: types<E>()` loads but is not a valid v6 event map type.
    const schemas = configObj.getProperty('schemas');
    const events =
      schemas && Node.isPropertyAssignment(schemas)
        ? schemas
            .getInitializerIfKind(SyntaxKind.ObjectLiteralExpression)
            ?.getProperty('events')
        : undefined;
    const { line, column } = sourceFile.getLineAndColumnAtPos(
      (events ?? schemas ?? configObj).getStart()
    );
    sites.push({
      file: sourceFile.getFilePath(),
      line,
      column,
      api: 'types',
      hint: EVENTS_FALLBACK_HINT
    });
  }
  notes.push(`converted 'types' → 'schemas' (${schemaEntries.length} key(s))`);
  return true;
}

/**
 * Converts `types: {} as { context; events; input; ... }` (or the per-key
 * `types: { context: {} as C, ... }` form) inside machine config objects into
 * `schemas: { context: types<...>(), ... }`.
 */
export const typesToSchemas: Transform = {
  name: 'types-to-schemas',
  description:
    'Convert `types: {} as {...}` and `types: { context: {} as C, ... }` into `schemas: { context: types<C>(), events: { ... }, input: types<I>() }`. Events become a map when written as a literal union, inline or in a same-file type alias; otherwise `events: types<E>()`.',
  apply(sourceFile: SourceFile): TransformResult {
    const notes: string[] = [];
    const sites: ManualSite[] = [];
    let changed = false;
    // `ensureNamedImport` reads stale scope after adding an import, so resolve
    // the helper binding once per file.
    let helper: string | undefined;
    const getHelper = (location: Node) =>
      (helper ??= ensureNamedImport(sourceFile, 'types', location));

    for (const configObj of findMachineConfigObjects(sourceFile, [
      'createMachine',
      'createStateConfig',
      'setup'
    ])) {
      for (const prop of configObj.getProperties()) {
        if (Node.isPropertyAssignment(prop) && getKey(prop) === 'types') {
          if (convertTypesProperty(configObj, prop, notes, sites, getHelper)) {
            changed = true;
          }
        }
      }
    }

    return { changed, notes, sites };
  }
};
