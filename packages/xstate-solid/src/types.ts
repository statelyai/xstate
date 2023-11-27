import type {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  ActorOptions,
  ContextFrom
} from 'xstate';

type InternalMachineOpts<
  TMachine extends AnyStateMachine,
  RequireMissing extends boolean = false
> = InternalMachineImplementations<
  ContextFrom<TMachine>,
  TMachine['__TResolvedTypesMeta'],
  RequireMissing
>;

export type RestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [options: ActorOptions<TMachine> & InternalMachineOpts<TMachine, true>]
    : [options?: ActorOptions<TMachine> & InternalMachineOpts<TMachine>];
