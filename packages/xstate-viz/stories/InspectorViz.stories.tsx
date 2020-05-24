import React from 'react';
import { createMachine } from 'xstate';

import { InspectorViz } from '../src/InspectorViz';
import '../themes/dark.scss';
import { interpret } from 'xstate';

export default {
  title: 'InspectorViz',
  component: InspectorViz
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

const register = (service) => {
  window.postMessage(
    {
      type: 'service.register',
      machine: JSON.stringify(service.machine),
      state: JSON.stringify(service.state),
      id: service.id
    },
    '*'
  );

  service.subscribe((state) => {
    window.postMessage(
      {
        type: 'service.state',
        state: JSON.stringify(state),
        id: service.id
      },
      '*'
    );
  });
};

const simpleService = interpret(simpleMachine).start();

setTimeout(() => {
  register(simpleService);
}, 1000);

export const SimpleInspector = () => {
  return <InspectorViz />;
};
