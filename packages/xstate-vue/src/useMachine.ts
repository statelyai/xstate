import { Ref, shallowRef } from 'vue';
import {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  Actor,
  ActorOptions,
  StateFrom,
  TODO,
  SnapshotFrom
} from 'xstate';
import { MaybeLazy, Prop } from './types.ts';
import { useInterpret } from './useInterpret.ts';

type RestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [
        options: ActorOptions<TMachine> &
          InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TODO,
            TODO,
            TODO,
            TMachine['__TResolvedTypesMeta'],
            true
          >
      ]
    : [
        options?: ActorOptions<TMachine> &
          InternalMachineImplementations<
            TMachine['__TContext'],
            TMachine['__TEvent'],
            TODO,
            TODO,
            TODO,
            TMachine['__TResolvedTypesMeta']
          >
      ];

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TInterpreter = Actor<TMachine>
> = {
  state: Ref<StateFrom<TMachine>>;
  send: Prop<TInterpreter, 'send'>;
  service: TInterpreter;
};

export function useMachine<TMachine extends AnyStateMachine>(
  getMachine: MaybeLazy<TMachine>,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturn<TMachine> {
  function listener(nextSnapshot: SnapshotFrom<TMachine>) {
    if (nextSnapshot !== snapshot) {
      snapshot = nextSnapshot;
      state.value = snapshot;
    }
  }

  // @ts-ignore
  const service = useInterpret(getMachine, options, listener);

  let snapshot = service.getSnapshot();
  const state = shallowRef(snapshot);

  return { state, send: service.send, service } as any;
}
