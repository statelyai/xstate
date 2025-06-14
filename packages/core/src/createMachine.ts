import { StandardSchemaV1 } from '../../xstate-store/src/schema.ts';
import { StateMachine } from './StateMachine.ts';
import { ResolvedStateMachineTypes, TODO } from './types.ts';
import {
  AnyActorRef,
  EventObject,
  AnyEventObject,
  Cast,
  InternalMachineImplementations,
  MachineConfig,
  MachineContext,
  MachineTypes,
  NonReducibleUnknown,
  ParameterizedObject,
  ProvidedActor,
  StateValue,
  ToChildren,
  MetaObject
} from './types.ts';
import { Next_MachineConfig } from './types.v6.ts';

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
  TContext extends MachineContext,
  TEvent extends AnyEventObject, // TODO: consider using a stricter `EventObject` here
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TTag extends string,
  TInput,
  TOutput extends NonReducibleUnknown,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  // it's important to have at least one default type parameter here
  // it allows us to benefit from contextual type instantiation as it makes us to pass the hasInferenceCandidatesOrDefault check in the compiler
  // we should be able to remove this when we start inferring TConfig, with it we'll always have an inference candidate
  _ = any
>(
  config: {
    types?: MachineTypes<
      TContext,
      TEvent,
      TActor,
      TAction,
      TGuard,
      TDelay,
      TTag,
      TInput,
      TOutput,
      TEmitted,
      TMeta
    >;
    schemas?: unknown;
  } & MachineConfig<
    TContext,
    TEvent,
    TActor,
    TAction,
    TGuard,
    TDelay,
    TTag,
    TInput,
    TOutput,
    TEmitted,
    TMeta
  >,
  implementations?: InternalMachineImplementations<
    ResolvedStateMachineTypes<
      TContext,
      TEvent,
      TActor,
      TAction,
      TGuard,
      TDelay,
      TTag,
      TEmitted
    >
  >
): StateMachine<
  TContext,
  TEvent,
  Cast<ToChildren<TActor>, Record<string, AnyActorRef | undefined>>,
  TActor,
  TAction,
  TGuard,
  TDelay,
  StateValue,
  TTag & string,
  TInput,
  TOutput,
  TEmitted,
  TMeta, // TMeta
  TODO // TStateSchema
> {
  return new StateMachine<
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any, // TEmitted
    any, // TMeta
    any // TStateSchema
  >(config as any, implementations as any);
}

export function next_createMachine<
  TContextSchema extends StandardSchemaV1,
  TEventSchema extends StandardSchemaV1,
  TContext extends MachineContext,
  TEvent extends StandardSchemaV1.InferOutput<TEventSchema> & EventObject, // TODO: consider using a stricter `EventObject` here
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TTag extends string,
  TInput,
  TOutput extends NonReducibleUnknown,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  // it's important to have at least one default type parameter here
  // it allows us to benefit from contextual type instantiation as it makes us to pass the hasInferenceCandidatesOrDefault check in the compiler
  // we should be able to remove this when we start inferring TConfig, with it we'll always have an inference candidate
  _ = any
>(
  config: Next_MachineConfig<
    TContextSchema,
    TEventSchema,
    TContext,
    TEvent,
    TDelay,
    TTag,
    TInput,
    TOutput,
    TEmitted,
    TMeta
  >
): StateMachine<
  TContext,
  TEvent,
  Cast<ToChildren<TActor>, Record<string, AnyActorRef | undefined>>,
  TActor,
  TAction,
  TGuard,
  TDelay,
  StateValue,
  TTag & string,
  TInput,
  TOutput,
  TEmitted,
  TMeta, // TMeta
  TODO // TStateSchema
> {
  return new StateMachine<
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any, // TEmitted
    any, // TMeta
    any // TStateSchema
  >(config as any);
}
