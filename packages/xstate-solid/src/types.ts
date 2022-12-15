import type {
  AnyState,
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventObject,
  InternalMachineOptions,
  InterpreterOptions,
  State,
  StateConfig,
  StateSchema,
  TypegenDisabled,
  Typestate
} from 'xstate';

type StateObject<
  TContext,
  TEvent extends EventObject = EventObject,
  TStateSchema extends StateSchema<TContext> = any,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext },
  TResolvedTypesMeta = TypegenDisabled
> = Pick<
  State<TContext, TEvent, TStateSchema, TTypestate, TResolvedTypesMeta>,
  keyof AnyState
>;

// Converts a State class type to a POJO State type. This reflects that the state
// is being spread into a new object for reactive tracking in SolidJS
export type CheckSnapshot<Snapshot> = Snapshot extends State<
  infer C,
  infer E,
  infer S,
  infer T,
  infer R
>
  ? StateObject<C, E, S, T, R>
  : Snapshot;

interface UseMachineOptions<TContext, TEvent extends EventObject> {
  /**
   * If provided, will be merged with machine's `context`.
   */
  context?: Partial<TContext>;
  /**
   * The state to rehydrate the machine to. The machine will
   * start at this state instead of its `initialState`.
   */
  state?: StateConfig<TContext, TEvent>;
}

type InternalMachineOpts<
  TMachine extends AnyStateMachine,
  RequireMissing extends boolean = false
> = InternalMachineOptions<
  TMachine['__TContext'],
  TMachine['__TEvent'],
  TMachine['__TResolvedTypesMeta'],
  RequireMissing
>;

export type RestParams<
  TMachine extends AnyStateMachine,
  UseMachineOpts = UseMachineOptions<
    TMachine['__TContext'],
    TMachine['__TEvent']
  >
> = AreAllImplementationsAssumedToBeProvided<
  TMachine['__TResolvedTypesMeta']
> extends false
  ? [
      options: InterpreterOptions &
        UseMachineOpts &
        InternalMachineOpts<TMachine, true>
    ]
  : [
      options?: InterpreterOptions &
        UseMachineOpts &
        InternalMachineOpts<TMachine>
    ];
