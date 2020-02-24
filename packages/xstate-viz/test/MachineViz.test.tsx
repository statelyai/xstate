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

describe('useMachine hook', () => {
  afterEach(cleanup);

  it('should render the machine', async () => {
    const machine = createMachine({
      id: 'simple',
      initial: 'active',
      states: {
        active: {}
      }
    });

    const { getByTitle } = render(
      <MachineViz machine={machine} state={machine.initialState} />
    );
    const machineEl = getByTitle(/machine:/i);
    const activeStateEl = getByTitle(/state node: #simple.active/i);

    expect(machineEl).not.toBeNull();
    expect(activeStateEl).not.toBeNull();
  });
});
