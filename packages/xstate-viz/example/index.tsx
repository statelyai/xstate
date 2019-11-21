import 'react-app-polyfill/ie11';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { MachineViz, ServiceViz } from '../src/index';
import { createMachine, interpret } from 'xstate';

const machine = createMachine({
  initial: 'off',
  states: {
    off: {
      after: {
        5000: 'on',
      },
    },
    on: {},
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
