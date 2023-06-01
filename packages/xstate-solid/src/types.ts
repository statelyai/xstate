import type {
  AnyActorLogic,
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
> = Pick<State<TContext, TEvent, TResolvedTypesMeta>, keyof AnyState>;

// Converts a State class type to a POJO State type. This reflects that the state
// is being spread into a new object for reactive tracking in SolidJS
export type CheckSnapshot<Snapshot> = Snapshot extends State<
  infer C,
  infer E,
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

export type RestParams<TLogic extends AnyActorLogic> =
  TLogic extends AnyStateMachine
    ? AreAllImplementationsAssumedToBeProvided<
        TLogic['__TResolvedTypesMeta']
      > extends false
      ? [
          options: InterpreterOptions<TLogic> &
            InternalMachineOpts<TLogic, true>
        ]
      : [options?: InterpreterOptions<TLogic> & InternalMachineOpts<TLogic>]
    : [options?: InterpreterOptions<TLogic>];
