import { WebSocketServer } from 'ws';
import { ActorRef, EventObject, createActor, Actor } from 'xstate';
import { toActorRef } from 'xstate/actors';
import { createInspectMachine, InspectMachineEvent } from './inspectMachine.ts';
import { Inspector, Replacer } from './types.ts';
import { stringify } from './utils.ts';
import { XStateDevInterface } from 'xstate/dev';

const services = new Set<Actor<any>>();
const serviceMap = new Map<string, Actor<any>>();
const serviceListeners = new Set<any>();

function createDevTools() {
  const unregister: XStateDevInterface['unregister'] = (service) => {
    services.delete(service);
    serviceMap.delete(service.sessionId);
  };
  const devTools: XStateDevInterface = {
    services,
    register: (service) => {
      services.add(service);
      serviceMap.set(service.sessionId, service);
      serviceListeners.forEach((listener) => listener(service));

      service.subscribe({
        complete: () => unregister(service),
        error: () => unregister(service)
      });
    },
    unregister,
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
  (globalThis as any).__xstate__ = devTools;
  return devTools;
}

interface ServerInspectorOptions {
  server: WebSocketServer;
  serialize?: Replacer | undefined;
}

export function inspect(options: ServerInspectorOptions): Inspector {
  const { server } = options;
  const devTools = createDevTools();
  const inspectService = createActor(
    createInspectMachine(devTools, options)
  ).start();
  let client: ActorRef<any, undefined> = toActorRef({
    name: '@@xstate/ws-client',
    send: (event: any) => {
      server.clients.forEach((wsClient) => {
        if (wsClient.readyState === wsClient.OPEN) {
          wsClient.send(JSON.stringify(event));
        }
      });
    },
    subscribe: () => {
      return { unsubscribe: () => void 0 };
    },
    getSnapshot: () => undefined
  });

  server.on('connection', function connection(wsClient) {
    wsClient.on('message', function incoming(data, isBinary) {
      if (isBinary) {
        return;
      }

      const jsonMessage = JSON.parse(data.toString());
      inspectService.send({
        ...jsonMessage,
        client
      });
    });
  });

  devTools.onRegister((service: Actor<any>) => {
    inspectService.send({
      type: 'service.register',
      machine: JSON.stringify(service.logic), // TODO: rename `machine` property
      state: JSON.stringify(service.getSnapshot()),
      id: service.id,
      sessionId: service.sessionId
    });

    inspectService.send({
      type: 'service.event',
      event: stringify(service.getSnapshot().event),
      sessionId: service.sessionId
    });

    // monkey-patch service.send so that we know when an event was sent
    // to a service *before* it is processed, since other events might occur
    // while the sent one is being processed, which throws the order off
    const originalSend = service.send.bind(service);

    service.send = function inspectSend(event: EventObject) {
      inspectService.send({
        type: 'service.event',
        event: stringify(event),
        sessionId: service.sessionId
      });

      return originalSend(event);
    };

    service.subscribe((state) => {
      inspectService.send({
        type: 'service.state',
        state: stringify(state),
        sessionId: service.sessionId
      });
    });

    service.subscribe({
      complete() {
        inspectService.send({
          type: 'service.stop',
          sessionId: service.sessionId
        });
      }
    });
  });

  const inspector: Inspector = toActorRef({
    name: '@@xstate/inspector',
    send: (event: InspectMachineEvent) => {
      inspectService.send(event);
    },
    subscribe: () => {
      return {
        unsubscribe: () => void 0
      };
    },
    disconnect: () => {
      server.close();
      inspectService.stop();
    },
    getSnapshot: () => undefined
  });

  server.on('close', () => {
    inspectService.stop();
    server.clients.forEach((client) => client.terminate());
  });

  return inspector;
}
