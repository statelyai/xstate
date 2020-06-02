import { useMemo } from 'react';
import { EventObject, State, Interpreter, Typestate } from 'xstate';
import { useSubscription, Subscription } from 'use-subscription';

export function useService<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = any
>(
  service: Interpreter<TContext, any, TEvent, TTypestate>
): [
  State<TContext, TEvent, any, TTypestate>,
  Interpreter<TContext, any, TEvent, TTypestate>['send'],
  Interpreter<TContext, any, TEvent, TTypestate>
] {
  const subscription: Subscription<State<
    TContext,
    TEvent,
    any,
    TTypestate
  >> = useMemo(
    () => ({
      getCurrentValue: () => service.state || service.initialState,
      subscribe: (callback) => {
        const { unsubscribe } = service.subscribe((state) => {
          if (state.changed !== false) {
            callback();
          }
        });
        return unsubscribe;
      }
    }),
    [service]
  );

  const state = useSubscription(subscription);

  return [state, service.send, service];
}
