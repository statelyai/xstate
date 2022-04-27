import {
  createMachine,
  interpret,
  MachineImplementationsFrom,
  ServiceFrom,
  StateFrom,
  StateMachine
} from '@xstate/fsm';
import { onDestroy } from 'svelte';
import { Readable, readable } from 'svelte/store';

export function useMachine<TMachine extends StateMachine.AnyMachine>(
  machine: TMachine,
  options?: MachineImplementationsFrom<TMachine>
): {
  state: Readable<StateFrom<TMachine>>;
  send: ServiceFrom<TMachine>['send'];
  service: ServiceFrom<TMachine>;
} {
  const resolvedMachine = createMachine(
    machine.config,
    options ? options : (machine as any)._options
  );

  const service = interpret(resolvedMachine).start();

  onDestroy(service.stop);

  const state = readable(service.state, (set) => {
    return service.subscribe((state) => {
      if (state.changed) {
        set(state);
      }
    }).unsubscribe;
  });

  return { state, send: service.send, service } as any;
}
