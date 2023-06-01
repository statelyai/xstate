import { Ref, shallowRef } from 'vue';
import {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  InterpreterFrom,
  InterpreterOptions,
  StateFrom,
  TODO
} from 'xstate';
import { MaybeLazy, Prop } from './types.ts';
import { useInterpret } from './useInterpret.ts';

type RestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [
        options: InterpreterOptions<TMachine> &
          InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TODO,
            TODO,
            TMachine['__TResolvedTypesMeta'],
            true
          >
      ]
    : [
        options?: InterpreterOptions<TMachine> &
          InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TODO,
            TODO,
            TMachine['__TResolvedTypesMeta']
          >
      ];

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = InterpreterFrom<TMachine>
> = {
  state: Ref<StateFrom<TMachine>>;
  send: Prop<TInterpreter, 'send'>;
  service: TInterpreter;
};

export function useMachine<TMachine extends AnyStateMachine>(
  getMachine: MaybeLazy<TMachine>,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturn<TMachine> {
  function listener(nextState: StateFrom<TMachine>) {
    if (nextState.changed) {
      state.value = nextState;
    }
  }

  const service = useInterpret(getMachine, options, listener);

  const state = shallowRef(service.getSnapshot());

  return { state, send: service.send, service } as any;
}
