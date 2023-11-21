import {
  MachineConfig,
  MachineContext,
  InternalMachineImplementations,
  ParameterizedObject,
  ProvidedActor,
  NonReducibleUnknown,
  Prop,
  AnyEventObject,
  ActorRefFrom,
  AnyActorRef,
  Compute,
  Cast
} from './types.ts';
import {
  TypegenConstraint,
  ResolveTypegenMeta,
  TypegenDisabled
} from './typegenTypes.ts';
import { StateMachine } from './StateMachine.ts';

type ToConcreteChildren<TActor extends ProvidedActor> = {
  [A in TActor as 'id' extends keyof A
    ? A['id'] & string
    : never]?: ActorRefFrom<A['logic']>;
};

type ToChildren<TActor extends ProvidedActor> =
  // only proceed further if all configured `src`s are literal strings
  string extends TActor['src']
    ? // TODO: replace with UnknownActorRef~
      // TODO: consider adding `| undefined` here
      Record<string, AnyActorRef>
    : Compute<
        ToConcreteChildren<TActor> &
          // check if all actors have IDs
          (undefined extends TActor['id']
            ? // if they don't we need to create an index signature containing all possible actor types
              {
                [id: string]: TActor extends any
                  ? ActorRefFrom<TActor['logic']> | undefined
                  : never;
              }
            : {})
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
    any
  >(config as any, implementations as any);
}
