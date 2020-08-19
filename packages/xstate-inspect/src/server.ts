// @ts-nocheck
import * as WebSocket from 'ws';
import {
  createMachine,
  interpret,
  Interpreter,
  send,
  sendParent
} from 'xstate';

import { inspectMachine } from './';

const wss = new WebSocket.Server({
  port: 8888
});

const services = new Set<Interpreter<any>>();
const serviceMap = new Map<string, Interpreter<any>>();
const serviceListeners = new Set<any>();

function createDevTools() {
  globalThis.__xstate__ = {
    services,
    register: (service) => {
      services.add(service);
      serviceMap.set(service.sessionId, service);
      serviceListeners.forEach((listener) => listener(service));

      service.onStop(() => {
        services.delete(service);
        serviceMap.delete(service.sessionId);
      });
    },
    onRegister: (listener) => {
      serviceListeners.add(listener);
      services.forEach((service) => listener(service));

      return {
        unsubscribe: () => {
          serviceListeners.delete(listener);
        }
      };
    }
  };
}

export function inspectServer() {
  createDevTools();
  const inspectService = interpret(inspectMachine).start();
  let client: any;

  wss.on('connection', function connection(ws) {
    client = {
      send: (e: any) => {
        wss.clients.forEach((c) => {
          if (c.readyState === WebSocket.OPEN) {
            c.send(JSON.stringify(e));
          }
        });
      }
    };
    // console.log('connected', ws);
    ws.on('message', function incoming(message) {
      const jsonMessage = JSON.parse(message);
      inspectService.send({
        ...jsonMessage,
        client
      });
    });

    ws.send('something');
  });

  globalThis.__xstate__.onRegister((service) => {
    inspectService.send({
      type: 'service.register',
      machine: JSON.stringify(service.machine),
      state: JSON.stringify(service.state || service.initialState),
      id: service.id
    });

    service.subscribe((state) => {
      inspectService.send({
        type: 'service.state',
        state: JSON.stringify(state),
        id: service.id
      });
    });
  });
}

inspectServer();

const machine = createMachine({
  initial: 'inactive',
  invoke: {
    id: 'ponger',
    src: () => (cb, receive) => {
      receive((event) => {
        if (event.type === 'PING') {
          cb('PONG');
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

globalThis.window = globalThis;

interpret(machine, { devTools: true })
  .onTransition((s) => console.log(s.value, s._event))
  .start();
