import 'react-app-polyfill/ie11';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { MachineViz, ServiceViz } from '../src/index';
import { createMachine, interpret } from 'xstate';

const machine = createMachine({
  initial: 'green',
  id: 'light',
  states: {
    green: {
      after: {
        1000: 'yellow',
      },
    },
    yellow: {
      after: {
        500: 'red',
      },
    },
    red: {
      after: {
        2000: 'green',
      },
    },
  },
});

const service = interpret(machine).start();

const App = () => {
  return (
    <div>
      <ServiceViz service={service} />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
