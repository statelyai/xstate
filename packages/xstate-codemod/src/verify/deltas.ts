import { isEqual } from './normalize.ts';

export interface DeltaRule {
  rule: string;
  section: string;
  note: string;
  matches(
    field: string,
    expected: unknown,
    actual: unknown,
    step: number
  ): boolean;
}

function mapDeep(
  value: unknown,
  fn: (key: string, item: unknown) => unknown
): unknown {
  if (Array.isArray(value)) return value.map((item) => mapDeep(item, fn));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      const mapped = fn(key, item);
      if (mapped !== undefined) out[key] = mapDeep(mapped, fn);
    }
    return out;
  }
  return value;
}

const stripAnonSuffix = (value: unknown) =>
  mapDeep(value, (key, item) =>
    (key === 'id' || key === 'to') && typeof item === 'string'
      ? item.replace(/(:\d+|\[\d+\])$/, '').replace(/^(x:\d+|\d+\.)/, '')
      : item
  );

const isActorMarker = (item: unknown) =>
  !!item && typeof item === 'object' && '$actor' in item;

const stripErrorPrefix = (message: string) =>
  message.replace(/^(\w*Error:\s*)+/, '').trim();

export const INTENTIONAL_DELTAS: DeltaRule[] = [
  {
    rule: 'anonymous-child-id',
    section: '§12',
    note: 'anonymous child ids are generated differently',
    matches: (field, expected, actual) =>
      (field === 'children' || field === 'sent') &&
      isEqual(stripAnonSuffix(expected), stripAnonSuffix(actual))
  },
  {
    rule: 'error-string-shape',
    section: '§16',
    note: 'same error message, different error class or prefix',
    matches: (field, expected, actual) =>
      field === 'error' &&
      typeof expected === 'string' &&
      typeof actual === 'string' &&
      expected !== '' &&
      actual !== '' &&
      stripErrorPrefix(expected) === stripErrorPrefix(actual)
  },
  {
    rule: 'context-reference',
    section: '§20',
    note: 'context differs only in stored actor references',
    matches: (field, expected, actual) =>
      field === 'context' &&
      isEqual(
        mapDeep(expected, (_key, item) =>
          isActorMarker(item) ? undefined : item
        ),
        mapDeep(actual, (_key, item) =>
          isActorMarker(item) ? undefined : item
        )
      )
  },
  {
    rule: 'done-event-session',
    section: '§12',
    note: 'done events differ only by sessionId',
    matches: (field, expected, actual) =>
      field === 'processed' &&
      isEqual(
        mapDeep(expected, (key, item) =>
          key === 'sessionId' ? undefined : item
        ),
        mapDeep(actual, (key, item) => (key === 'sessionId' ? undefined : item))
      )
  },
  {
    rule: 'final-state-output',
    section: '§3',
    note: "v6 promotes a top-level final state's output to snapshot.output when the root has none; v5 left it undefined",
    matches: (field, expected, actual) =>
      field === 'output' && expected === undefined && actual !== undefined
  }
];
