type PartialEventDescriptor<TEventType extends string> =
  TEventType extends `${infer TLeading}.${infer TTail}`
    ? `${TLeading}.*` | `${TLeading}.${PartialEventDescriptor<TTail>}`
    : never;

/**
 * An exact event type, `'*'`, or a trailing-token wildcard such as `'todo.*'`.
 */
export type EventDescriptor<TEventType extends string> =
  | TEventType
  | PartialEventDescriptor<TEventType>
  | '*';

export function isWildcard(descriptor: string): boolean {
  return descriptor === '*' || descriptor.endsWith('.*');
}

function assertValidDescriptor(descriptor: string): void {
  const valid =
    descriptor === '*' ||
    !descriptor.includes('*') ||
    (descriptor.endsWith('.*') && !descriptor.slice(0, -2).includes('*'));

  if (!valid) {
    throw new Error(
      `Invalid event descriptor "${descriptor}". Wildcards must be the entire descriptor or the final token.`
    );
  }
}

/**
 * Returns `true` if `eventType` matches an exact, `'*'`, or trailing-token
 * wildcard descriptor. `'todo.*'` matches `'todo'` and every `'todo.…'` event.
 */
export function matchesEventDescriptor(
  eventType: string,
  descriptor: string
): boolean {
  if (descriptor === eventType || descriptor === '*') {
    return true;
  }

  if (!descriptor.endsWith('.*')) {
    return false;
  }

  const prefixTokens = descriptor.slice(0, -2).split('.');
  const eventTokens = eventType.split('.');

  return prefixTokens.every((token, index) => token === eventTokens[index]);
}

/**
 * Expands descriptors against the known event types. Throws for an exact
 * descriptor that names an unknown event type.
 */
export function resolveEventTypes(
  eventTypes: readonly string[],
  descriptors: readonly string[]
): string[] {
  for (const descriptor of descriptors) {
    assertValidDescriptor(descriptor);

    if (!isWildcard(descriptor) && !eventTypes.includes(descriptor)) {
      throw new Error(
        `Cannot expose event "${descriptor}": it has no event schema. Add a schema for it in \`schemas.events\`.`
      );
    }
  }

  return eventTypes.filter((eventType) =>
    descriptors.some((descriptor) =>
      matchesEventDescriptor(eventType, descriptor)
    )
  );
}
