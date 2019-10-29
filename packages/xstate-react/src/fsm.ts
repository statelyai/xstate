import { useState, useRef, useEffect } from 'react';
import { StateMachine, EventObject, interpret } from '@xstate/fsm';

export function useMachine<TC, TE extends EventObject>(
  stateMachine: StateMachine.Machine<TC, TE, any>
): [
  StateMachine.State<TC, TE, any>,
  StateMachine.Service<TC, TE>['send'],
  StateMachine.Service<TC, TE>
] {
  const [state, setState] = useState(stateMachine.initialState);
  const ref = useRef<StateMachine.Service<TC, TE, any> | null>(null);

  if (ref.current === null) {
    ref.current = interpret(stateMachine);
  }

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    ref.current.subscribe(setState);
    ref.current.start();

    return () => {
      ref.current!.stop();
      // reset so next call re-initializes
      ref.current = null;
    };
  }, [stateMachine]);

  return [state, ref.current.send, ref.current];
}
