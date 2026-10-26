import { Data, Effect, Schema } from 'effect';
import type {
  AnyStateMachine,
  RestorablePersistedSnapshotFor,
  Snapshot
} from 'xstate';

type SnapshotData<TMachine extends AnyStateMachine> = {
  readonly status: Snapshot<unknown>['status'];
  readonly context: unknown;
  readonly value: unknown;
  readonly children: Readonly<Record<string, unknown>>;
  readonly machine: { readonly id: TMachine['id']; readonly version: string };
};

/** A malformed transport, unsupported JSON value or missing persistence metadata. */
export class SnapshotCodecError extends Data.TaggedError('SnapshotCodecError')<{
  readonly stage: 'encode' | 'decode';
  readonly path: string;
  readonly reason: string;
}> {
  override get message(): string {
    return `${this.stage} at ${this.path}: ${this.reason}`;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(
  stage: SnapshotCodecError['stage'],
  path: string,
  reason: string
): never {
  throw new SnapshotCodecError({ stage, path, reason });
}

function checkJson(
  value: unknown,
  stage: SnapshotCodecError['stage'],
  path = '$',
  ancestors = new Set<object>()
): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return;
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    !Object.is(value, -0)
  )
    return;
  if (typeof value !== 'object')
    invalid(
      stage,
      path,
      'Expected lossless JSON; encode this value with a schema'
    );
  if (ancestors.has(value)) invalid(stage, path, 'Cyclic value');
  if (Array.isArray(value) && Object.getPrototypeOf(value) !== Array.prototype)
    invalid(stage, path, 'Unsupported array prototype');
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    invalid(
      stage,
      path,
      'Unsupported object prototype; supply a reversible schema'
    );
  }
  if (Object.getOwnPropertySymbols(value).length)
    invalid(stage, path, 'Symbol properties are not JSON');
  ancestors.add(value);
  if (Array.isArray(value)) {
    if (Object.keys(value).length !== value.length)
      invalid(stage, path, 'Array holes or extra properties are not JSON');
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !('value' in descriptor))
        invalid(
          stage,
          `${path}[${index}]`,
          'Array accessor or hole is not JSON'
        );
      checkJson(descriptor.value, stage, `${path}[${index}]`, ancestors);
    }
    if (Object.getOwnPropertyNames(value).length !== value.length + 1)
      invalid(stage, path, 'Extra array properties are not JSON');
  } else {
    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
      if (!descriptor.enumerable || !('value' in descriptor))
        invalid(
          stage,
          `${path}.${key}`,
          'Non-enumerable or accessor property is not JSON'
        );
      checkJson(descriptor.value, stage, `${path}.${key}`, ancestors);
    }
  }
  ancestors.delete(value);
}

function checkSnapshot(
  value: unknown,
  stage: SnapshotCodecError['stage'],
  path = '$.snapshot',
  machineId?: string
): asserts value is Record<string, unknown> {
  if (!record(value)) invalid(stage, path, 'Expected a persisted snapshot');
  if (!['active', 'done', 'stopped', 'error'].includes(String(value.status)))
    invalid(stage, path, 'Invalid snapshot status');
  if (value.status === 'error')
    invalid(
      stage,
      path,
      'Errored snapshots require an explicit error recovery policy before persistence'
    );
  if (machineId !== undefined || 'machine' in value) {
    if (
      !record(value.machine) ||
      typeof value.machine.id !== 'string' ||
      typeof value.machine.version !== 'string' ||
      !value.machine.version
    )
      invalid(
        stage,
        `${path}.machine`,
        'Expected a versioned machine identity'
      );
    if (machineId !== undefined && value.machine.id !== machineId)
      invalid(stage, `${path}.machine.id`, 'Machine identity mismatch');
  }
  if ('value' in value || 'machine' in value) {
    for (const key of [
      'context',
      'value',
      'children',
      'historyValue',
      'timers'
    ]) {
      if (!(key in value))
        invalid(
          stage,
          `${path}.${key}`,
          'Missing machine persistence metadata'
        );
    }
    if (
      !record(value.children) ||
      !record(value.historyValue) ||
      !Array.isArray(value.timers)
    )
      invalid(stage, path, 'Invalid machine persistence metadata');
  }
  if (record(value.children)) {
    for (const [id, child] of Object.entries(value.children)) {
      if (
        !record(child) ||
        (child.src !== undefined && typeof child.src !== 'string')
      )
        invalid(stage, `${path}.children.${id}`, 'Invalid persisted child');
      if (child.remote === true) {
        if (child.snapshot !== undefined)
          invalid(
            stage,
            `${path}.children.${id}`,
            'Remote children cannot contain snapshots'
          );
        continue;
      }
      checkSnapshot(child.snapshot, stage, `${path}.children.${id}.snapshot`);
    }
  }
}

function sameData(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right))
    return (
      left.length === right.length &&
      left.every((item, index) => sameData(item, right[index]))
    );
  if (record(left) && record(right)) {
    const keys = Object.keys(left);
    return (
      keys.length === Object.keys(right).length &&
      keys.every(
        (key) => Object.hasOwn(right, key) && sameData(left[key], right[key])
      )
    );
  }
  return false;
}

function checkMetadata(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  stage: SnapshotCodecError['stage'],
  path = '$.snapshot'
): void {
  for (const [key, value] of Object.entries(before)) {
    if (
      ['context', 'input', 'output', 'error', 'stateInputs'].includes(key) ||
      value === undefined
    )
      continue;
    if (key === 'children' && record(value) && record(after.children)) {
      if (
        !sameData(Object.keys(value).sort(), Object.keys(after.children).sort())
      )
        invalid(stage, `${path}.children`, 'Schema changed persisted children');
      for (const [id, child] of Object.entries(value)) {
        const next = after.children[id];
        if (!record(child) || !record(next))
          invalid(
            stage,
            `${path}.children.${id}`,
            'Schema changed child metadata'
          );
        for (const childKey of Object.keys(child)) {
          if (
            childKey !== 'snapshot' &&
            child[childKey] !== undefined &&
            !sameData(child[childKey], next[childKey])
          )
            invalid(
              stage,
              `${path}.children.${id}.${childKey}`,
              'Schema changed child metadata'
            );
        }
        if (record(child.snapshot) && record(next.snapshot))
          checkMetadata(
            child.snapshot,
            next.snapshot,
            stage,
            `${path}.children.${id}.snapshot`
          );
      }
    } else if (!sameData(value, after[key])) {
      invalid(
        stage,
        `${path}.${key}`,
        'Schema changed machine persistence metadata'
      );
    }
  }
  if (before.input !== undefined && !('input' in after))
    invalid(stage, `${path}.input`, 'Schema removed input');
  if (before.output !== undefined && !('output' in after))
    invalid(stage, `${path}.output`, 'Schema removed output');
  if (
    record(before.stateInputs) &&
    (!record(after.stateInputs) ||
      !sameData(
        Object.keys(before.stateInputs).sort(),
        Object.keys(after.stateInputs).sort()
      ))
  )
    invalid(stage, `${path}.stateInputs`, 'Schema changed state input owners');
  if ('stateInputs' in before && !('stateInputs' in after))
    invalid(stage, `${path}.stateInputs`, 'Schema removed state inputs');
}

function checked<A>(
  stage: SnapshotCodecError['stage'],
  run: () => A
): Effect.Effect<A, SnapshotCodecError> {
  return Effect.try({
    try: run,
    catch: (error) =>
      error instanceof SnapshotCodecError
        ? error
        : new SnapshotCodecError({
            stage,
            path: '$',
            reason: error instanceof Error ? error.message : String(error)
          })
  });
}

/**
 * Binds a full bidirectional snapshot schema to a versioned machine. The schema
 * owns rich values and supported historical versions. Decoding never migrates;
 * restore or `machineVersions` remains responsible for migration.
 */
export function createSnapshotCodec<
  TMachine extends AnyStateMachine & { readonly version: string },
  P extends SnapshotData<TMachine>,
  Encoded,
  RD,
  RE
>(
  machine: TMachine,
  schema: Schema.Codec<P, Encoded, RD, RE> &
    (unknown extends RE
      ? { readonly 'A bidirectional codec is required': never }
      : unknown)
) {
  const format = '@xstate/effect/snapshot';
  return {
    encode(
      snapshot:
        | P
        | (Snapshot<unknown> &
            RestorablePersistedSnapshotFor<TMachine> & {
              readonly context: P['context'];
            })
    ): Effect.Effect<string, SnapshotCodecError | Schema.SchemaError, RE> {
      return Effect.gen(function* () {
        yield* checked('encode', () =>
          checkSnapshot(snapshot, 'encode', '$.snapshot', machine.id)
        );
        const encoded = yield* Schema.encodeUnknownEffect(schema)(snapshot);
        return yield* checked('encode', () => {
          checkJson(encoded, 'encode');
          checkSnapshot(encoded, 'encode', '$.snapshot', machine.id);
          checkMetadata(snapshot, encoded, 'encode');
          return JSON.stringify({
            format,
            version: 1,
            logicId: machine.id,
            snapshot: encoded
          });
        });
      });
    },
    decode(
      json: string
    ): Effect.Effect<
      P & Snapshot<unknown> & RestorablePersistedSnapshotFor<TMachine>,
      SnapshotCodecError | Schema.SchemaError,
      RD
    > {
      return Effect.gen(function* () {
        const encoded = yield* checked('decode', () => {
          const envelope: unknown = JSON.parse(json);
          checkJson(envelope, 'decode');
          if (
            !record(envelope) ||
            envelope.format !== format ||
            envelope.version !== 1
          )
            invalid('decode', '$', 'Unsupported snapshot format or version');
          if (envelope.logicId !== machine.id)
            invalid('decode', '$.logicId', 'Machine identity mismatch');
          checkSnapshot(envelope.snapshot, 'decode', '$.snapshot', machine.id);
          return envelope.snapshot;
        });
        const snapshot = yield* Schema.decodeUnknownEffect(schema)(encoded);
        yield* checked('decode', () => {
          checkSnapshot(snapshot, 'decode', '$.snapshot', machine.id);
          checkMetadata(encoded, snapshot, 'decode');
        });
        return snapshot as unknown as P &
          Snapshot<unknown> &
          RestorablePersistedSnapshotFor<TMachine>;
      });
    }
  };
}
