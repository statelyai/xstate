import { useState, useEffect } from 'react';
import { StateMachine, EventObject, interpret } from '@xstate/fsm';
import useConstant from './useConstant';

export function useMachine<TC, TE extends EventObject = EventObject>(
  stateMachine: StateMachine.Machine<TC, TE, any>
): [
  StateMachine.State<TC, TE, any>,
  StateMachine.Service<TC, TE>['send'],
  StateMachine.Service<TC, TE>
] {
  const service = useConstant(() => interpret(stateMachine).start());
  const [current, setCurrent] = useState(stateMachine.initialState);

  useEffect(() => {
    service.subscribe(setCurrent);
    return () => {
      service.stop();
    };
  }, []);

  return [current, service.send, service];
}
