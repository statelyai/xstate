import { useState, useEffect, useMemo } from 'react';
import {
  StateMachine,
  EventObject,
  Typestate,
  interpret,
  createMachine
} from '@xstate/fsm';
import { useSubscription, Subscription } from 'use-subscription';
import useConstant from './useConstant';

const getServiceState = <
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = { value: any; context: TContext }
>(
  service: StateMachine.Service<TContext, TEvent, TState>
): StateMachine.State<TContext, TEvent, TState> => {
  let currentValue: StateMachine.State<TContext, TEvent, TState>;
  service
    .subscribe((state) => {
      currentValue = state;
    })
    .unsubscribe();
  return currentValue!;
};

export function useMachine<
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = { value: any; context: TContext }
>(
  stateMachine: StateMachine.Machine<TContext, TEvent, TState>,
  options?: {
    actions?: StateMachine.ActionMap<TContext, TEvent>;
  }
): [
  StateMachine.State<TContext, TEvent, TState>,
  StateMachine.Service<TContext, TEvent, TState>['send'],
  StateMachine.Service<TContext, TEvent, TState>
] {
  if (process.env.NODE_ENV !== 'production') {
    const [initialMachine] = useState(stateMachine);

    if (stateMachine !== initialMachine) {
      console.warn(
        'Machine given to `useMachine` has changed between renders. This is not supported and might lead to unexpected results.\n' +
          'Please make sure that you pass the same Machine as argument each time.'
      );
    }
  }

  const service = useConstant(() =>
    interpret(
      createMachine(
        stateMachine.config,
        options ? options : (stateMachine as any)._options
      )
    ).start()
  );

  const [state, setState] = useState(() => getServiceState(service));

  useEffect(() => {
    if (options) {
      (service as any)._machine._options = options;
    }
  });

  useEffect(() => {
    service.subscribe(setState);
    return () => {
      service.stop();
    };
  }, []);

  return [state, service.send, service];
}

export function useService<
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = { value: any; context: TContext }
>(
  service: StateMachine.Service<TContext, TEvent, TState>
): [
  StateMachine.State<TContext, TEvent, TState>,
  StateMachine.Service<TContext, TEvent, TState>['send'],
  StateMachine.Service<TContext, TEvent, TState>
] {
  const subscription: Subscription<
    StateMachine.State<TContext, TEvent, TState>
  > = useMemo(() => {
    let currentState = getServiceState(service);

    return {
      getCurrentValue: () => currentState,
      subscribe: (callback) => {
        const { unsubscribe } = service.subscribe((state) => {
          if (state.changed !== false) {
            currentState = state;
            callback();
          }
        });
        return unsubscribe;
      }
    };
  }, [service]);

  const state = useSubscription(subscription);

  return [state, service.send, service];
}
