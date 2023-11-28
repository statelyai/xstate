import { onDestroy } from 'svelte';
import { Readable, readable } from 'svelte/store';
import {
  AnyStateMachine,
  AreAllImplementationsAssumedToBeProvided,
  InternalMachineImplementations,
  createActor,
  ActorOptions,
  StateFrom,
  Actor,
  ContextFrom
} from 'xstate';

type Prop<T, K> = K extends keyof T ? T[K] : never;

type RestParams<TMachine extends AnyStateMachine> =
  AreAllImplementationsAssumedToBeProvided<
    TMachine['__TResolvedTypesMeta']
  > extends false
    ? [
        options: ActorOptions<TMachine> &
          InternalMachineImplementations<
            ContextFrom<TMachine>,
            TMachine['__TResolvedTypesMeta'],
            true
          >
      ]
    : [
        options?: ActorOptions<TMachine> &
          InternalMachineImplementations<
            ContextFrom<TMachine>,
            TMachine['__TResolvedTypesMeta']
          >
      ];

type UseMachineReturn<
  TMachine extends AnyStateMachine,
  TActor = Actor<TMachine>
> = {
  state: Readable<StateFrom<TMachine>>;
  send: Prop<TActor, 'send'>;
  service: TActor;
};

export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturn<TMachine> {
  const { guards, actions, actors, delays, ...actorOptions } = options;

  const machineConfig = {
    guards,
    actions,
    actors,
    delays
  };

  const resolvedMachine = machine.provide(machineConfig as any);

  const service = createActor(resolvedMachine, actorOptions).start();

  onDestroy(() => service.stop());

  let snapshot = service.getSnapshot();

  const state = readable(snapshot, (set) => {
    return service.subscribe((nextSnapshot) => {
      if (snapshot !== nextSnapshot) {
        snapshot = nextSnapshot;
        set(snapshot);
      }
    }).unsubscribe;
  });

  return { state, send: service.send, service } as any;
}
