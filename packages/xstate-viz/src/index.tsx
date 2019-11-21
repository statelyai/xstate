import * as React from 'react';
import { StateMachine, Interpreter } from 'xstate';
import { useService } from '@xstate/react';

export const MachineViz: React.FC<{
  machine: StateMachine<any, any, any>;
}> = ({ machine }) => {
  return (
    <div>
      <pre>{JSON.stringify(machine.initialState, null, 2)}</pre>
    </div>
  );
};

export const ServiceViz: React.FC<{
  service: Interpreter<any, any>;
}> = ({ service }) => {
  const [state] = useService(service);

  return (
    <div>
      <pre>{JSON.stringify(state, null, 2)}</pre>
    </div>
  );
};
