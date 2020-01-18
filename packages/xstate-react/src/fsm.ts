import { useState, useEffect, useMemo } from 'react';
import { StateMachine, EventObject, Typestate, interpret } from '@xstate/fsm';
import { useSubscription, Subscription } from 'use-subscription';
import useConstant from './useConstant';

export function useMachine<
  TC extends object,
  TE extends EventObject = EventObject
>(
  stateMachine: StateMachine.Machine<TC, TE, any>,
  options?: StateMachine.ActionMap<TC, TE>
): [
  StateMachine.State<TC, TE, any>,
  StateMachine.Service<TC, TE>['send'],
  StateMachine.Service<TC, TE>
] {
  if (process.env.NODE_ENV !== 'production') {
    const [initialMachine] = useState(stateMachine);

    if (stateMachine !== initialMachine) {
      throw new Error(
        'Machine given to `useMachine` has changed between renders. This is not supported and might lead to unexpected results.\n' +
          'Please make sure that you pass the same Machine as argument each time.'
      );
    }
  }

  const service = useConstant(() => {
    const service = interpret(stateMachine);
    if (options) {
      (service as any)._machine._options = options;
    }
    return service.start();
  });
  const [current, setCurrent] = useState(stateMachine.initialState);

  useEffect(() => {
    if (options) {
      (service as any)._machine._options = options;
    }
  });

  useEffect(() => {
    service.subscribe(setCurrent);
    return () => {
      service.stop();
    };
  }, []);

  return [current, service.send, service];
}

export function useService<
  TContext extends object,
  TEvent extends EventObject = EventObject,
  TState extends Typestate<TContext> = any
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
    let currentValue: StateMachine.State<TContext, TEvent, TState>;

    service
      .subscribe(state => {
        currentValue = state;
      })
      .unsubscribe();

    return {
      getCurrentValue: () => currentValue,
      subscribe: callback => {
        const { unsubscribe } = service.subscribe(state => {
          if (state.changed !== false) {
            currentValue = state;
            callback();
          }
        });
        return unsubscribe;
      }
    };
  }, [service]);

  const current = useSubscription(subscription);

  return [current, service.send, service];
}
