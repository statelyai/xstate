import {
  ActorLogic,
  AnyActorLogic,
  DoneActorEvent,
  DoNotInfer,
  ErrorActorEvent,
  EventObject,
  InputFrom,
  MachineContext,
  Mapper,
  MetaObject,
  NonReducibleUnknown,
  OutputFrom,
  ParameterizedObject,
  ProvidedActor,
  SingleOrArray,
  SnapshotEvent,
  SnapshotFrom,
  TransitionConfigOrTarget
} from './types';

export type InvokeObject<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TEmitted extends EventObject,
  TMeta extends MetaObject
> = {
  (context: TContext): void;
  id?: string;
  systemId?: string;
  src: AnyActorLogic;
  input?:
    | Mapper<TContext, TEvent, NonReducibleUnknown, TEvent>
    | NonReducibleUnknown;
  onDone?:
    | string
    | SingleOrArray<
        TransitionConfigOrTarget<
          TContext,
          DoneActorEvent<any>, // TODO: consider replacing with `unknown`
          TEvent,
          TActor,
          TAction,
          TGuard,
          TDelay,
          TEmitted,
          TMeta
        >
      >;
  onError?:
    | string
    | SingleOrArray<
        TransitionConfigOrTarget<
          TContext,
          ErrorActorEvent,
          TEvent,
          TActor,
          TAction,
          TGuard,
          TDelay,
          TEmitted,
          TMeta
        >
      >;

  onSnapshot?:
    | string
    | SingleOrArray<
        TransitionConfigOrTarget<
          TContext,
          SnapshotEvent,
          TEvent,
          TActor,
          TAction,
          TGuard,
          TDelay,
          TEmitted,
          TMeta
        >
      >;
};

export function createInvoke<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TActor extends ProvidedActor,
  TAction extends ParameterizedObject,
  TGuard extends ParameterizedObject,
  TDelay extends string,
  TEmitted extends EventObject,
  TMeta extends MetaObject,
  // Logic-specific types
  TSrc extends AnyActorLogic
>(_config: {
  id?: string;
  systemId?: string;
  src: TSrc;
  input?: Mapper<TContext, TEvent, InputFrom<TSrc>, TEvent> | InputFrom<TSrc>;
  onDone?:
    | string
    | SingleOrArray<
        TransitionConfigOrTarget<
          TContext,
          DoneActorEvent<OutputFrom<TSrc>>,
          TEvent,
          TActor,
          TAction,
          TGuard,
          TDelay,
          TEmitted,
          TMeta
        >
      >;
  onError?:
    | string
    | SingleOrArray<
        TransitionConfigOrTarget<
          TContext,
          ErrorActorEvent,
          TEvent,
          TActor,
          TAction,
          TGuard,
          TDelay,
          TEmitted,
          TMeta
        >
      >;

  onSnapshot?:
    | string
    | SingleOrArray<
        TransitionConfigOrTarget<
          TContext,
          SnapshotFrom<TSrc>,
          TEvent,
          TActor,
          TAction,
          TGuard,
          TDelay,
          TEmitted,
          TMeta
        >
      >;
}): InvokeObject<
  TContext,
  TEvent,
  TActor,
  TAction,
  TGuard,
  TDelay,
  TEmitted,
  TMeta
> {
  return null!;
}
