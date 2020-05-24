import React from 'react';
import { linkTo } from '@storybook/addon-links';
import { Welcome } from '@storybook/react/demo';
import { createMachine } from 'xstate';

import { MachineViz } from '../src/MachineViz';
import '../themes/dark.scss';

export default {
  title: 'MachineViz',
  component: MachineViz
};

const simpleMachine = createMachine({
  id: 'simple',
  initial: 'inactive',
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      on: { TOGGLE: 'inactive' }
    }
  }
});

export const SimpleMachine = () => {
  return (
    <MachineViz machine={simpleMachine} state={simpleMachine.initialState} />
  );
};
