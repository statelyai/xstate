import {
  createMachine,
  interpret,
  MachineImplementationsFrom,
  ServiceFrom,
  StateMachine
} from '@xstate/fsm';
import { Observable } from 'rxjs';

export function fromMachine<TMachine extends StateMachine.AnyMachine>(
  machine: TMachine,
  options?: MachineImplementationsFrom<TMachine>
): {
  state$: Observable<ServiceFrom<TMachine>['state']>;
  send: ServiceFrom<TMachine>['send'];
  service: ServiceFrom<TMachine>;
} {
  const machineWithConfig = createMachine(
    machine.config,
    options ? options : (machine as any)._options
  );

  const service = interpret(machineWithConfig).start();
  const state$ = new Observable((subscriber) => {
    const subscription = service.subscribe((state) => {
      if (state.changed) {
        subscriber.next(state);
      }
    });

    return () => {
      service.stop();
      subscription.unsubscribe();
    };
  });

  return { state$, send: service.send, service } as any;
}
