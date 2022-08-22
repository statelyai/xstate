import type {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  EventObject,
  InternalMachineOptions,
  InterpreterOptions,
  StateConfig
} from 'xstate';

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
