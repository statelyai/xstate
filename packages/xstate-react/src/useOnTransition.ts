import { useEffect } from 'react';
import { EventObject, Typestate } from 'xstate';
import { Interpreter, StateListener } from 'xstate/lib/interpreter';

interface UseOnTransitionOptions {
  ignoreInitEvent: boolean;
}
export function useOnTransition<
  TContext,
  TEvent extends EventObject,
  TTypestate extends Typestate<TContext> = { value: any; context: TContext }
>(
  listener: StateListener<TContext, TEvent, any, TTypestate>,
  service: Interpreter<TContext, any, TEvent, TTypestate>,
  options?: UseOnTransitionOptions
) {
  useEffect(() => {
    service.onTransition((state, event) => {
      if (options?.ignoreInitEvent && event.type === 'xstate.init') {
        return;
      }
      listener(state, event);
    });
  }, [service]);
}
