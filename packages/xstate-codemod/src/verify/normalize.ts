import type { NormalizedEvent, Stats } from './types.ts';

// v5 spawn (`x:3`), v5 invoke (`0.root.a`), v6 invoke/spawn (`root.a:0`, `child:0`).
const ANON_ID = /^(x:\d+|\d+\..+|.+:\d+)$/;

export function normalizeId(id: string): string {
  return ANON_ID.test(id) ? '(anon)' : id;
}

/**
 * v5 gives an id-less machine the root id `(machine)` and prefixes every
 * implicit state id with it; v6 leaves the prefix out.
 */
function normalizeStateId(id: string): string {
  if (id === '(machine)') return '';
  return id.startsWith('(machine).') ? id.slice('(machine).'.length) : id;
}

function isActorRef(value: any): boolean {
  return (
    typeof value.send === 'function' &&
    typeof value.getSnapshot === 'function' &&
    typeof value.id === 'string'
  );
}

/**
 * JSON round-trip that marks functions/symbols and replaces actor refs.
 * Objects nested deeper than `maxDepth` become `'[deep]'`.
 */
export function toJson(
  value: unknown,
  stats: Stats,
  seen = new Set<object>(),
  maxDepth = Infinity
): unknown {
  switch (typeof value) {
    case 'undefined':
    case 'string':
    case 'boolean':
      return value;
    case 'number':
      return Number.isFinite(value) ? value : null;
    case 'bigint':
      return String(value);
    case 'function':
      stats.nonSerializable++;
      return '[fn]';
    case 'symbol':
      stats.nonSerializable++;
      return '[symbol]';
  }
  if (value === null) return null;
  const obj = value as any;
  if (isActorRef(obj)) return { '@actor': normalizeId(obj.id) };
  if (obj instanceof Error) return String(obj);
  if (typeof obj.toJSON === 'function')
    return toJson(obj.toJSON(), stats, seen, maxDepth);
  if (seen.has(obj)) return '[circular]';
  if (seen.size >= maxDepth) return '[deep]';
  seen.add(obj);
  try {
    if (Array.isArray(obj)) {
      return obj.map((item) => toJson(item, stats, seen, maxDepth) ?? null);
    }
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(obj)) {
      const item = toJson(obj[key], stats, seen, maxDepth);
      if (item !== undefined) out[key] = item;
    }
    return out;
  } finally {
    seen.delete(obj);
  }
}

function withOutput(
  event: NormalizedEvent,
  output: unknown,
  stats: Stats
): NormalizedEvent {
  const json = toJson(output, stats);
  return json === undefined ? event : { ...event, output: json };
}

/** Maps v5 suffixed and v6 payload-identified lifecycle events to one shape. */
export function normalizeEvent(event: any, stats: Stats): NormalizedEvent {
  const {
    type,
    sessionId: _sessionId,
    ...rest
  } = event as {
    type: string;
    [key: string]: any;
  };
  let match: RegExpExecArray | null;
  if (
    type === 'xstate.done.actor' ||
    (match = /^xstate\.done\.actor\.(.+)$/.exec(type))
  ) {
    const actorId = normalizeId(rest.actorId ?? match![1]);
    return withOutput(
      { type: 'xstate.done.actor', actorId },
      rest.output,
      stats
    );
  }
  if (
    type === 'xstate.error.actor' ||
    (match = /^xstate\.error\.actor\.(.+)$/.exec(type))
  ) {
    return {
      type: 'xstate.error.actor',
      actorId: normalizeId(rest.actorId ?? match![1]),
      error: String(rest.error)
    };
  }
  if (
    type === 'xstate.done.state' ||
    (match = /^xstate\.done\.state\.(.+)$/.exec(type))
  ) {
    const stateId = normalizeStateId(rest.stateId ?? match![1]);
    return withOutput(
      { type: 'xstate.done.state', stateId },
      rest.output,
      stats
    );
  }
  if (type === 'xstate.after') {
    return { type, delay: rest.delay, stateId: normalizeStateId(rest.stateId) };
  }
  if ((match = /^xstate\.after\.([^.]+)\.(.+)$/.exec(type))) {
    const delay = Number(match[1]);
    return {
      type: 'xstate.after',
      delay: Number.isFinite(delay) ? delay : match[1],
      stateId: normalizeStateId(match[2])
    };
  }
  return { type, ...(toJson(rest, stats) as object) };
}

/** JSON with sorted object keys, for order-insensitive equality. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]])
        )
      : item
  );
}

export function isEqual(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}
