import React, { useEffect } from 'react';
import { createMachine, assign, interpret } from 'xstate';

import { InspectorViz } from '../src/InspectorViz';
import '../themes/dark.scss';

export default {
  title: 'InspectorViz',
  component: InspectorViz
};

const simpleMachine = createMachine<{ count: number }>({
  id: 'simple',
  initial: 'inactive',
  context: {
    count: 0
  },
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      entry: assign({ count: (ctx) => ctx.count + 1 }),
      on: { TOGGLE: 'inactive' }
    }
  }
});

const register = (service) => {
  window.postMessage(
    {
      type: 'service.register',
      machine: JSON.stringify(service.machine),
      state: JSON.stringify(service.state || service.initialState),
      id: service.sessionId
    },
    '*'
  );

  service.subscribe((state) => {
    window.postMessage(
      {
        type: 'service.state',
        state: JSON.stringify(state),
        id: service.sessionId
      },
      '*'
    );
  });
};

export const SimpleInspector = () => {
  useEffect(() => {
    (window as any).__xstate__ = {
      register: (service) => {
        register(service);
      }
    };

    setTimeout(() => {
      console.log('registering');
      const simpleService = interpret(simpleMachine, {
        devTools: true
      }).start();

      const anotherService = interpret(simpleMachine, {
        devTools: true
      }).start();

      setInterval(() => {
        simpleService.send('TOGGLE');
      }, 2000);
      // register(simpleService);
    }, 1000);
  }, []);
  return <InspectorViz />;
};
