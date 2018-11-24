import React, { useState, useMemo, useEffect, useRef } from 'react';
import { interpret } from 'xstate/lib/interpreter';

export function useMachine(machine, log) {
  const [current, setCurrent] = useState(machine.initialState);
  const service = useMemo(
    () =>
      interpret(machine)
        .onTransition(state => {
          log && console.log('CONTEXT:', state.context);
          setCurrent(state);
        })
        .onEvent(e => log && console.log('EVENT:', e))
        .start(),
    []
  );

  useEffect(() => {
    return () => service.stop();
  }, []);

  return [current, service.send];
}
