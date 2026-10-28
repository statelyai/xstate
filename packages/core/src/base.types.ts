/**
 * Lean type primitives shared by the main `xstate` entry and the compact
 * `xstate/fsm` entry. This module (plus `schema.types.ts`) must stay free of
 * imports from the rest of the package so that `xstate/fsm` consumers do not
 * pull the full type surface into their program.
 */
import type {
  SetupStateSchemas,
  StandardSchemaV1,
  TypeSchema
} from './schema.types.ts';

declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}

/**
 * The full definition of an event, with a string `type`.
 *
 * @public
 */
export type EventObject = {
  /** The type of event that is sent. */
  type: string;
};

/** @public */
export type MachineContext = Record<string, any>;

/** @public */
export type Values<T> = T[keyof T];

export type ActionSchemas = Record<string, { params: StandardSchemaV1 }>;

export type GuardSchemas = Record<string, { params: StandardSchemaV1 }>;

/**
 * State node types that can be declared in a setup state contract.
 *
 * @public
 */
export type SetupStateType =
  | 'atomic'
  | 'compound'
  | 'parallel'
  | 'final'
  | 'history'
  | 'choice';

/** @public */
export type SetupSchemas = {
  context?: StandardSchemaV1 | undefined;
  events?: Record<string, StandardSchemaV1> | undefined;
  internalEvents?: Record<string, StandardSchemaV1> | undefined;
  actions?: ActionSchemas | undefined;
  guards?: GuardSchemas | undefined;
  emitted?: Record<string, StandardSchemaV1> | undefined;
  input?: StandardSchemaV1 | undefined;
  output?: StandardSchemaV1 | undefined;
  meta?: StandardSchemaV1 | undefined;
  transitionMeta?: StandardSchemaV1 | undefined;
  tags?: StandardSchemaV1 | undefined;
  children?: Record<string, StandardSchemaV1> | undefined;
};

/**
 * State schema with optional input/output schemas, structural metadata, and
 * nested states.
 *
 * Structural fields are contracts/defaults for `createMachine(...)`; machine
 * behavior remains authored in the machine config.
 *
 * @public
 */
export interface SetupStateSchema {
  type?: SetupStateType | undefined;
  id?: string | undefined;
  initial?: string | undefined;
  history?: 'shallow' | 'deep' | true | undefined;
  target?: string | readonly [string, ...string[]] | undefined;
  route?: true | undefined;
  schemas?: SetupStateSchemas | undefined;
  states?: Record<string, SetupStateSchema> | undefined;
}

/**
 * Event payloads from schemas (e.g. Zod) are often inferred as optional in
 * output types. Wrapping in Required<> ensures properties defined in the schema
 * are required on the event. Type-only schemas created with the `types()`
 * helper are exempt: their declared type is authoritative, so optional
 * properties stay optional.
 *
 * @public
 */
export type InferEvents<
  TEventSchemaMap extends Record<string, StandardSchemaV1>
> = Values<{
  [K in keyof TEventSchemaMap & string]: StandardSchemaV1.InferOutput<
    TEventSchemaMap[K]
  > extends infer O
    ? [O] extends [never]
      ? never
      : unknown extends O
        ? O & { type: K }
        : [O] extends [void]
          ? { type: K }
          : string extends keyof O
            ? [O[string]] extends [never]
              ? { type: EventTypeFromSchemaKey<K> }
              : NormalizeEventPayload<TEventSchemaMap[K], O> & {
                  type: EventTypeFromSchemaKey<K>;
                }
            : NormalizeEventPayload<TEventSchemaMap[K], O> & {
                type: EventTypeFromSchemaKey<K>;
              }
    : never;
}>;

/** Infers internal events only from explicitly declared schema keys. */
export type InferInternalEvents<
  TEventSchemaMap extends Record<string, StandardSchemaV1>
> = string extends keyof TEventSchemaMap ? never : InferEvents<TEventSchemaMap>;

type EventTypeFromSchemaKey<TKey extends string> = TKey extends '*'
  ? string
  : TKey extends `${infer TLeading}.*`
    ? `${TLeading}.${string}`
    : TKey;

/**
 * Keeps a type-only schema's payload verbatim; applies Required<> to payloads
 * from validator libraries (see {@link InferEvents}).
 */
type NormalizeEventPayload<TSchema extends StandardSchemaV1, O> =
  TSchema extends TypeSchema<any> ? O : Required<O>;
