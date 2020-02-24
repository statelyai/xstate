import * as React from 'react';
import { MachineViz } from '../src';
// import {
//   Machine,
//   assign,
//   Interpreter,
//   spawn,
//   doneInvoke,
//   State,
//   createMachine
// } from 'xstate';
import {
  render,
  // fireEvent,
  cleanup
  // waitForElement
} from '@testing-library/react';
import { createMachine } from 'xstate';

describe('MachineViz', () => {
  afterEach(cleanup);

  const machine = createMachine({
    id: 'simple',
    initial: 'active',
    states: {
      active: {
        on: {
          TOGGLE: 'inactive'
        }
      },
      inactive: {}
    }
  });

  it('should render the machine', async () => {
    const { getByTitle } = render(
      <MachineViz machine={machine} state={machine.initialState} />
    );
    const machineEl = getByTitle(/machine:/i);

    expect(machineEl).not.toBeNull();
  });

  it('should render the states', async () => {
    const { getByTitle } = render(
      <MachineViz machine={machine} state={machine.initialState} />
    );
    const activeStateEl = getByTitle(/state node: #simple.active/i);
    const inactiveStateEl = getByTitle(/state node: #simple.inactive/i);

    expect(activeStateEl).not.toBeNull();
    expect(inactiveStateEl).not.toBeNull();
  });

  it('should render the events', async () => {
    const { getByTitle } = render(
      <MachineViz machine={machine} state={machine.initialState} />
    );
    const eventEl = getByTitle(/event: TOGGLE/i);

    expect(eventEl).not.toBeNull();
  });
});
