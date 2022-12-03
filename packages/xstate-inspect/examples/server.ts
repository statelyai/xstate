import WebSocket from 'ws';
import { createMachine, interpret, send } from 'xstate';
import { toSCXMLEvent } from 'xstate';
import { inspect } from '@xstate/inspect/lib/server';

inspect({
  server: new WebSocket.Server({
    port: 8888
  })
});

const machine = createMachine({
  initial: 'inactive',
  invoke: {
    id: 'ponger',
    src: () => (cb, receive) => {
      receive((event) => {
        if (event.type === 'PING') {
          cb(
            toSCXMLEvent(
              {
                type: 'PONG',
                arr: [1, 2, 3]
              },
              { origin: 'ponger' }
            )
          );
        }
      });
    }
  },
  states: {
    inactive: {
      after: {
        1000: 'active'
      }
    },
    active: {
      entry: send('PING', { to: 'ponger', delay: 1000 }),
      on: {
        PONG: 'inactive'
      }
    }
  }
});

interpret(machine, { devTools: true })
  .onTransition((s) => console.log(s.value))
  .start();
