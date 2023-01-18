import { inspect } from '@xstate/inspect/server';
import WebSocket from 'ws';
import { createMachine, interpret, send, toSCXMLEvent } from 'xstate';
import { fromCallback } from 'xstate/actors';

inspect({
  server: new WebSocket.Server({
    port: 8888
  })
});

const machine = createMachine({
  initial: 'inactive',
  invoke: {
    id: 'ponger',
    src: () =>
      fromCallback((cb, receive) => {
        receive((event) => {
          if (event.type === 'PING') {
            cb(
              toSCXMLEvent({
                type: 'PONG',
                arr: [1, 2, 3]
              })
            );
          }
        });
      })
  },
  states: {
    inactive: {
      after: {
        1000: 'active'
      }
    },
    active: {
      entry: send({ type: 'PING' }, { to: 'ponger', delay: 1000 }),
      on: {
        PONG: 'inactive'
      }
    }
  }
});

interpret(machine, { devTools: true })
  .onTransition((s) => console.log(s.value))
  .start();
