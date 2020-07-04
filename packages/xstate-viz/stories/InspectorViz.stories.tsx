import React, { useEffect, useRef } from 'react';
import { createMachine, assign, interpret, sendParent, send } from 'xstate';

import { InspectorViz, createReceiver } from '../src/InspectorViz';
import '../themes/dark.scss';

export default {
  title: 'InspectorViz',
  component: InspectorViz
};

const pongMachine = createMachine({
  id: 'pong',
  initial: 'pending',
  states: {
    ponging: {
      after: {
        1000: { actions: sendParent('PONG'), target: 'pending' }
      }
    },
    pending: {
      on: {
        PING: 'ponging'
      }
    }
  }
});

const pingMachine = createMachine({
  id: 'ping',
  initial: 'pinging',
  invoke: {
    src: pongMachine,
    id: 'pong'
  },
  states: {
    pinging: {
      after: {
        1000: {
          target: 'pending',
          actions: send('PING', { to: 'pong' })
        }
      }
    },
    pending: {
      on: { PONG: 'pinging' }
    }
  }
});

const simpleMachine = createMachine<{ count: number }>({
  id: 'simple',
  initial: 'inactive',
  context: {
    count: 0
  },
  invoke: {
    src: createMachine({
      initial: 'foo',
      states: { foo: {} }
    })
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
      id: service.id,
      parent: service.parent?.id
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

export const SimpleInspector = () => {
  const receiver = useRef(createReceiver<MessageEvent<any>>());

  useEffect(() => {
    (window as any).__xstate__ = {
      register: (service) => {
        register(service);
      }
    };

    const timeout = setTimeout(() => {
      const simpleService = interpret(simpleMachine, {
        devTools: true
      }).start();
      setInterval(() => {
        simpleService.send('TOGGLE');
      }, 2000);
    }, 1000);

    return () => {
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (
        typeof event.data === 'object' &&
        event.data !== null &&
        'type' in event.data
      ) {
        receiver.current.send(event);
      }
    };

    window.addEventListener('message', handler);

    return () => {
      window.removeEventListener('message', handler);
    };
  }, []);

  return <InspectorViz receiver={receiver.current} />;
};
