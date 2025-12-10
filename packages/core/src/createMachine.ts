import { StandardSchemaV1 } from './schema.types.ts';
import { StateMachine } from './StateMachine.ts';
import {
  AnyActorRef,
  EventObject,
  AnyEventObject,
  Cast,
  MachineContext,
  ProvidedActor,
  StateValue,
  ToChildren,
  MetaObject,
  StateSchema,
  DoNotInfer
} from './types.ts';
import {
  Implementations,
  InferOutput,
  InferEvents,
  Next_MachineConfig,
  Next_StateNodeConfig,
  WithDefault
} from './types.v6.ts';

type TestValue =
  | string
  | {
      [k: string]: TestValue | undefined;
    };

type _GroupTestValues<TTestValue extends string | TestValue> =
  TTestValue extends string
    ? TTestValue extends `${string}.${string}`
      ? [never, never]
      : [TTestValue, never]
    : [never, TTestValue];

/**
 * Creates a state machine (statechart) with the given configuration.
 *
 * The state machine represents the pure logic of a state machine actor.
 *
 * @example
 *
 * ```ts
 * import { createMachine } from 'xstate';
 *
 * const lightMachine = createMachine({
 *   id: 'light',
 *   initial: 'green',
 *   states: {
 *     green: {
 *       on: {
 *         TIMER: { target: 'yellow' }
 *       }
 *     },
 *     yellow: {
 *       on: {
 *         TIMER: { target: 'red' }
 *       }
 *     },
 *     red: {
 *       on: {
 *         TIMER: { target: 'green' }
 *       }
 *     }
 *   }
 * });
 *
 * const lightActor = createActor(lightMachine);
 * lightActor.start();
 *
 * lightActor.send({ type: 'TIMER' });
 * ```
 *
 * @param config The state machine configuration.
 * @param options DEPRECATED: use `setup({ ... })` or `machine.provide({ ... })`
 *   to provide machine implementations instead.
 */
export function createMachine<
  TContextSchema extends StandardSchemaV1,
  TEventSchemaMap extends Record<string, StandardSchemaV1>,
  TEmittedSchemaMap extends Record<string, StandardSchemaV1>,
  TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TMetaSchema extends StandardSchemaV1,
  TTagSchema extends StandardSchemaV1,
  // TContext extends MachineContext,
  _TEvent extends EventObject,
  TActor extends ProvidedActor,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TDelays extends string,
  TTag extends StandardSchemaV1.InferOutput<TTagSchema> & string,
  TInput,
  const TSS extends StateSchema
>(
  config: TSS &
    Next_MachineConfig<
      TContextSchema,
      TEventSchemaMap,
      TEmittedSchemaMap,
      TInputSchema,
      TOutputSchema,
      TMetaSchema,
      TTagSchema,
      InferOutput<TContextSchema, MachineContext>,
      InferEvents<TEventSchemaMap>,
      TDelays,
      TTag,
      TActionMap,
      TActorMap,
      TGuardMap,
      TDelayMap
    >
): StateMachine<
  InferOutput<TContextSchema, MachineContext>,
  InferEvents<TEventSchemaMap>,
  Cast<ToChildren<TActor>, Record<string, AnyActorRef | undefined>>,
  StateValue,
  TTag & string,
  TInput,
  InferOutput<TOutputSchema, unknown>,
  WithDefault<InferEvents<TEmittedSchemaMap>, AnyEventObject>,
  InferOutput<TMetaSchema, MetaObject>, // TMeta
  TSS, // TStateSchema
  TActionMap,
  TActorMap,
  TGuardMap,
  TDelayMap
> & {
  states: TSS;
} {
  return new StateMachine<
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any, // TEmitted
    any, // TMeta
    any, // TStateSchema
    any,
    any,
    any,
    any
  >(config as any) as any;
}

export function createStateConfig<
  TContextSchema extends StandardSchemaV1,
  TEventSchema extends StandardSchemaV1,
  TEmittedSchema extends StandardSchemaV1,
  _TInputSchema extends StandardSchemaV1,
  TOutputSchema extends StandardSchemaV1,
  TMetaSchema extends StandardSchemaV1,
  TTagSchema extends StandardSchemaV1,
  // TContext extends MachineContext,
  _TEvent extends StandardSchemaV1.InferOutput<TEventSchema> & EventObject, // TODO: consider using a stricter `EventObject` here
  _TActor extends ProvidedActor,
  TActionMap extends Implementations['actions'],
  TActorMap extends Implementations['actors'],
  TGuardMap extends Implementations['guards'],
  TDelayMap extends Implementations['delays'],
  TDelays extends string,
  _TTag extends StandardSchemaV1.InferOutput<TTagSchema> & string,
  _TInput,
  const TSS extends StateSchema
>(
  config: TSS &
    Next_StateNodeConfig<
      InferOutput<TContextSchema, MachineContext>,
      DoNotInfer<StandardSchemaV1.InferOutput<TEventSchema> & EventObject>,
      DoNotInfer<TDelays>,
      DoNotInfer<StandardSchemaV1.InferOutput<TTagSchema> & string>,
      DoNotInfer<StandardSchemaV1.InferOutput<TOutputSchema>>,
      DoNotInfer<StandardSchemaV1.InferOutput<TEmittedSchema> & EventObject>,
      DoNotInfer<InferOutput<TMetaSchema, MetaObject>>,
      DoNotInfer<TActionMap>,
      DoNotInfer<TActorMap>,
      DoNotInfer<TGuardMap>,
      DoNotInfer<TDelayMap>
    >
): typeof config {
  return config;
}
