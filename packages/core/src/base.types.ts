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

/** The full definition of an event, with a string `type`. */
export type EventObject = {
  /** The type of event that is sent. */
  type: string;
};

export type MachineContext = Record<string, any>;

export type Values<T> = T[keyof T];

export type ActionSchemas = Record<string, { params: StandardSchemaV1 }>;

export type GuardSchemas = Record<string, { params: StandardSchemaV1 }>;

/** State node types that can be declared in a setup state contract. */
export type SetupStateType =
  | 'atomic'
  | 'compound'
  | 'parallel'
  | 'final'
  | 'history'
  | 'choice';

export type SetupSchemas = {
  context?: StandardSchemaV1;
  events?: Record<string, StandardSchemaV1>;
  internalEvents?: Record<string, StandardSchemaV1>;
  actions?: ActionSchemas;
  guards?: GuardSchemas;
  emitted?: Record<string, StandardSchemaV1>;
  input?: StandardSchemaV1;
  output?: StandardSchemaV1;
  meta?: StandardSchemaV1;
  tags?: StandardSchemaV1;
  children?: Record<string, StandardSchemaV1>;
};

/**
 * State schema with optional input/output schemas, structural metadata, and
 * nested states.
 *
 * Structural fields are contracts/defaults for `createMachine(...)`; machine
 * behavior remains authored in the machine config.
 */
export interface SetupStateSchema {
  type?: SetupStateType;
  id?: string;
  initial?: string;
  history?: 'shallow' | 'deep' | true;
  target?: string | readonly [string, ...string[]];
  route?: true;
  schemas?: SetupStateSchemas;
  states?: Record<string, SetupStateSchema>;
}

/**
 * Event payloads from schemas (e.g. Zod) are often inferred as optional in
 * output types. Wrapping in Required<> ensures properties defined in the schema
 * are required on the event. Type-only schemas created with the `types()`
 * helper are exempt: their declared type is authoritative, so optional
 * properties stay optional.
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
