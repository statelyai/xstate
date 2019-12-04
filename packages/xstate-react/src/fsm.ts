import { useState, useEffect } from 'react';
import {
  StateMachine,
  EventObject,
  interpret,
  InterpreterStatus
} from '@xstate/fsm';
import { AnyEventObject } from 'xstate';

const interpretDev: typeof interpret = machine => {
  const service = interpret(machine);

  const statusMap = {
    [InterpreterStatus.NotStarted]: 'not started',
    [InterpreterStatus.Running]: 'running',
    [InterpreterStatus.Stopped]: 'stopped'
  };

  const { send } = service;

  service.send = event => {
    if (service.status !== InterpreterStatus.Running) {
      console.error(
        `Sending events to a machine in "${
          statusMap[service.status]
        }" state might lead to unexpected results.\n` +
          `If you want to send events to a machine you should do it after React's commit phase (so after the moment when the interpreter actually starts).`
      );
    }
    send(event);
  };

  return service;
};

export function useMachine<TC, TE extends EventObject = AnyEventObject>(
  stateMachine: StateMachine.Machine<TC, TE, any>
): [
  StateMachine.State<TC, TE, any>,
  StateMachine.Service<TC, TE>['send'],
  StateMachine.Service<TC, TE>
] {
  const initializeState = () => ({
    machine: stateMachine,
    service:
      process.env.NODE_ENV !== 'production'
        ? interpretDev(stateMachine)
        : interpret(stateMachine),
    state: stateMachine.initialState
  });
  const [{ state, service, machine }, setState] = useState(initializeState);

  if (stateMachine !== machine) {
    setState(initializeState());
  }

  useEffect(() => {
    service.subscribe(state =>
      setState(prevState => ({ ...prevState, state }))
    );
    service.start();
    return () => {
      service.stop();
    };
  }, [service]);

  return [state, service.send, service];
}
