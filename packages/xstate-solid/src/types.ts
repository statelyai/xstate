import type {
  AnyState,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventObject,
  InternalMachineImplementations,
  InterpreterOptions,
  MachineContext,
  State,
  TypegenDisabled
} from 'xstate';

type StateObject<
  TContext extends MachineContext,
  TEvent extends EventObject = EventObject,
  TResolvedTypesMeta = TypegenDisabled
> = Pick<State<TContext, TEvent, any, any, TResolvedTypesMeta>, keyof AnyState>;

// Converts a State class type to a POJO State type. This reflects that the state
// is being spread into a new object for reactive tracking in SolidJS
export type CheckSnapshot<Snapshot> = Snapshot extends State<
  infer C,
  infer E,
  infer _TActions,
  infer _TActors,
  infer R
>
  ? StateObject<C, E, R>
  : Snapshot;

type InternalMachineOpts<
  TMachine extends AnyStateMachine,
  RequireMissing extends boolean = false
> = InternalMachineImplementations<
  TMachine['__TContext'],
  TMachine['__TEvent'],
  TMachine['__TResolvedTypesMeta'],
  RequireMissing
>;

export type RestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [
        options: InterpreterOptions<TMachine> &
          InternalMachineOpts<TMachine, true>
      ]
    : [options?: InterpreterOptions<TMachine> & InternalMachineOpts<TMachine>];
