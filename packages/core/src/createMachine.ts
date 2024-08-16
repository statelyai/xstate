import { StateMachine } from './StateMachine.ts';
import {
  AnyActorRef,
  AnyEventObject,
  Cast,
  EventObject,
  InternalMachineImplementations,
  IsNever,
  MachineConfig,
  MachineContext,
  MachineTypes,
  MetaObject,
  NonReducibleUnknown,
  ParameterizedObject,
  ProvidedActor,
  ResolvedStateMachineTypes,
  StateValue,
  ToChildren,
  TODO,
  type MachineTypesWithInput
} from './types.ts';

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
type GroupTestValues<TTestValue extends string | TestValue> = {
  leafCandidates: _GroupTestValues<TTestValue>[0];
  nonLeaf: _GroupTestValues<TTestValue>[1];
};

type FilterLeafValues<
  TLeafCandidate extends string,
  TNonLeaf extends { [k: string]: TestValue | undefined }
> = IsNever<TNonLeaf> extends true
  ? TLeafCandidate
  : TLeafCandidate extends string
    ? TLeafCandidate extends keyof TNonLeaf
      ? never
      : TLeafCandidate
    : never;

// this is not 100% accurate since we can't make parallel regions required in the result
// `TTestValue` doesn't encode this information anyhow for us to be able to do that
// this is fine for most practical use cases anyway though
type ToStateValue<TTestValue extends string | TestValue> =
  | FilterLeafValues<
      GroupTestValues<TTestValue>['leafCandidates'],
      GroupTestValues<TTestValue>['nonLeaf']
    >
  | (IsNever<GroupTestValues<TTestValue>['nonLeaf']> extends false
      ? {
          [K in keyof GroupTestValues<TTestValue>['nonLeaf']]: ToStateValue<
            NonNullable<GroupTestValues<TTestValue>['nonLeaf'][K]>
          >;
        }
      : never);

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
    types: MachineTypesWithInput<
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
): (input: NonNullable<TInput>) => StateMachine<
  TContext,
  TEvent,
  Cast<ToChildren<TActor>, Record<string, AnyActorRef | undefined>>,
  TActor,
  TAction,
  TGuard,
  TDelay,
  StateValue,
  TTag & string,
  NonNullable<TInput>,
  TOutput,
  TEmitted,
  TMeta, // TMeta
  TODO // TStateSchema
>;
export function createMachine<
  TContext extends MachineContext,
  TEvent extends AnyEventObject, // TODO: consider using a stricter `EventObject` here
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TTag extends string,
  TInput extends never,
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
>;
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
):
  | StateMachine<
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
    >
  | ((input: NonNullable<TInput>) => StateMachine<
      TContext,
      TEvent,
      Cast<ToChildren<TActor>, Record<string, AnyActorRef | undefined>>,
      TActor,
      TAction,
      TGuard,
      TDelay,
      StateValue,
      TTag & string,
      NonNullable<TInput>,
      TOutput,
      TEmitted,
      TMeta, // TMeta
      TODO // TStateSchema
    >) {
  if (config.types?.input !== undefined) {
    return (input: TInput) =>
      new StateMachine<
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
      >(config, implementations as any, input);
  }
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
  >(config, implementations as any);
}
