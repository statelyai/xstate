import type { AnyStateMachine, StateFrom } from 'xstate';
import { createStore, reconcile } from 'solid-js/store';
import type { RestParams, UseMachineReturn } from './types';
import { createService } from './createService';
import { batch, onCleanup, onMount } from 'solid-js';

export function useMachine<TMachine extends AnyStateMachine>(
  machine: TMachine,
  ...[options = {}]: RestParams<TMachine>
): UseMachineReturn<TMachine> {
  const service = createService(machine, options);

  const [state, setState] = createStore<StateFrom<TMachine>>({
    ...service.state,
    toJSON() {
      return service.state.toJSON();
    },
    toStrings(...args: Parameters<StateFrom<TMachine>['toStrings']>) {
      return service.state.toStrings(args[0], args[1]);
    },
    can(...args: Parameters<StateFrom<TMachine>['can']>) {
      // tslint:disable-next-line:no-unused-expression
      state.value; // sets state.value to be tracked
      return service.state.can(args[0]);
    },
    hasTag(...args: Parameters<StateFrom<TMachine>['hasTag']>) {
      // tslint:disable-next-line:no-unused-expression
      state.tags; // sets state.tags to be tracked
      return service.state.hasTag(args[0]);
    },
    matches(...args: Parameters<StateFrom<TMachine>['matches']>) {
      // tslint:disable-next-line:no-unused-expression
      state.value; // sets state.value to be tracked
      return service.state.matches(args[0] as never);
    }
  } as StateFrom<TMachine>);

  onMount(() => {
    const { unsubscribe } = service.subscribe((nextState) => {
      batch(() => {
        setState(reconcile(nextState as StateFrom<TMachine>));
      });
    });

    onCleanup(unsubscribe);
  });

  return [state, service.send, service] as UseMachineReturn<TMachine>;
}
