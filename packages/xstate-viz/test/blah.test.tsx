import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ServiceViz } from '../src';
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

describe('it', () => {
  it('renders without crashing', () => {
    const div = document.createElement('div');
    ReactDOM.render(<ServiceViz service={service} />, div);
    ReactDOM.unmountComponentAtNode(div);
  });
});
