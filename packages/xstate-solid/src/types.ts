import type {
  AnyState,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventObject,
  InternalMachineImplementations,
  ActorOptions,
  MachineContext,
  ProvidedActor,
  State,
  TypegenDisabled
} from 'xstate';

type StateObject<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject,
  TActor extends ProvidedActor = ProvidedActor,
  TResolvedTypesMeta = TypegenDisabled
> = Pick<
  State<TContext, TEvent, TActor, any, TResolvedTypesMeta>,
  keyof AnyState
>;

// Converts a State class type to a POJO State type. This reflects that the state
// is being spread into a new object for reactive tracking in SolidJS
export type CheckSnapshot<Snapshot> = Snapshot extends State<
  infer TContext,
  infer TEvents,
  infer TActor,
  infer TResolvedTypesMeta
>
  ? StateObject<TContext, TEvents, TActor, TResolvedTypesMeta>
  : Snapshot;

type InternalMachineOpts<
  TMachine extends AnyStateMachine,
  RequireMissing extends boolean = false
> = InternalMachineImplementations<
  TMachine['__TContext'],
  TMachine['__TEvent'],
  TMachine['__TAction'],
  TMachine['__TActor'],
  TMachine['__TGuards'],
  TMachine['__TResolvedTypesMeta'],
  RequireMissing
>;

export type RestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [options: ActorOptions<TMachine> & InternalMachineOpts<TMachine, true>]
    : [options?: ActorOptions<TMachine> & InternalMachineOpts<TMachine>];
