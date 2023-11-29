import { StateMachine } from './StateMachine.ts';
import {
  ResolveTypegenMeta,
  TypegenConstraint,
  TypegenDisabled
} from './typegenTypes.ts';
import {
  AnyActorRef,
  AnyEventObject,
  Cast,
  InternalMachineImplementations,
  IsNever,
  MachineConfig,
  MachineContext,
  NonReducibleUnknown,
  ParameterizedObject,
  Prop,
  ProvidedActor,
  StateValue,
  ToChildren
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
  // it's important to have at least one default type parameter here
  // it allows us to benefit from contextual type instantiation as it makes us to pass the hasInferenceCandidatesOrDefault check in the compiler
  // we should be able to remove this when we start inferring TConfig, with it we'll always have an inference candidate
  TTypesMeta extends TypegenConstraint = TypegenDisabled
>(
  config: MachineConfig<
    TContext,
    TEvent,
    TActor,
    TAction,
    TGuard,
    TDelay,
    TTag,
    TInput,
    TOutput,
    TTypesMeta
  >,
  implementations?: InternalMachineImplementations<
    TContext,
    ResolveTypegenMeta<
      TTypesMeta,
      TEvent,
      TActor,
      TAction,
      TGuard,
      TDelay,
      TTag
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
  'matchesStates' extends keyof TTypesMeta
    ? ToStateValue<Cast<TTypesMeta['matchesStates'], TestValue>>
    : StateValue,
  Prop<
    ResolveTypegenMeta<
      TTypesMeta,
      TEvent,
      TActor,
      TAction,
      TGuard,
      TDelay,
      TTag
    >['resolved'],
    'tags'
  > &
    string,
  TInput,
  TOutput,
  ResolveTypegenMeta<TTypesMeta, TEvent, TActor, TAction, TGuard, TDelay, TTag>
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
    any
  >(config as any, implementations as any);
}
