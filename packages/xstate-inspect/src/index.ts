import {
  Interpreter,
  createMachine,
  assign,
  interpret,
  SCXML,
  EventObject
} from 'xstate';
import { XStateDevInterface } from 'xstate/src/dev';
import { toSCXMLEvent, toEventObject } from 'xstate/src/utils';
import safeStringify from 'fast-safe-stringify';

export type ServiceListener = (service: Interpreter<any>) => void;

type MaybeLazy<T> = T | (() => T);

export interface InspectorOptions {
  url: string;
  iframe: MaybeLazy<HTMLIFrameElement | null | false>;
  devTools: MaybeLazy<XStateDevInterface>;
}

const serviceMap = new Map<string, Interpreter<any>>();

export function createDevTools(): XStateDevInterface {
  const services = new Set<Interpreter<any>>();
  const serviceListeners = new Set<ServiceListener>();

  return {
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
    unregister: (service) => {
      services.delete(service);
      serviceMap.delete(service.sessionId);
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

export const createInspectMachine = (
  devTools: XStateDevInterface = globalThis.__xstate__
) =>
  createMachine<{
    client?: any;
  }>({
    initial: 'pendingConnection',
    context: {
      client: undefined
    },
    states: {
      pendingConnection: {},
      connected: {
        on: {
          'service.state': {
            actions: (ctx, e) => ctx.client!.send(e)
          },
          'service.event': {
            actions: (ctx, e) => ctx.client!.send(e)
          },
          'service.register': {
            actions: (ctx, e) => ctx.client!.send(e)
          },
          'service.stop': {
            actions: (ctx, e) => ctx.client!.send(e)
          },
          'xstate.event': {
            actions: (_, e) => {
              const { event } = e;
              const scxmlEventObject = JSON.parse(event) as SCXML.Event<any>;
              const service =
                typeof scxmlEventObject.origin! === 'string'
                  ? serviceMap.get((scxmlEventObject.origin as any) as string) // v4
                  : scxmlEventObject.origin!;

              service?.send(scxmlEventObject);
            }
          },
          unload: {
            actions: (ctx) => {
              ctx.client!.send({ type: 'xstate.disconnect' });
            }
          },
          disconnect: 'disconnected'
        }
      },
      disconnected: {
        type: 'final'
      }
    },
    on: {
      'xstate.inspecting': {
        target: '.connected',
        actions: [
          assign({ client: (_, e) => e.client }),
          (ctx) => {
            devTools.services.forEach((service) => {
              ctx.client.send({
                type: 'service.register',
                machine: stringify(service.machine),
                state: stringify(service.state || service.initialState),
                sessionId: service.sessionId
              });
            });
          }
        ]
      }
    }
  });

const defaultInspectorOptions: InspectorOptions = {
  url: 'https://statecharts.io/inspect',
  iframe: () =>
    document.querySelector<HTMLIFrameElement>('iframe[data-xstate]'),
  devTools: () => {
    const devTools = createDevTools();
    globalThis.__xstate__ = devTools;
    return devTools;
  }
};

function getLazy<T>(value: MaybeLazy<T>): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

function stringify(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return safeStringify(value);
  }
}

export function inspect(
  options?: Partial<InspectorOptions>
): {
  send: (event: EventObject) => void;
  /**
   * Disconnects the inspector.
   */
  disconnect: () => void;
} {
  const { iframe, url, devTools } = { ...defaultInspectorOptions, ...options };
  const resolvedDevTools = getLazy(devTools);
  const resolvedIframe = getLazy(iframe);

  const inspectMachine = createInspectMachine(resolvedDevTools);

  let targetWindow: Window | null | undefined;

  const inspectService = interpret(inspectMachine).start();

  if (resolvedIframe === null) {
    console.warn(
      'No suitable <iframe> found to embed the inspector. Please pass an <iframe> element to `inspect(iframe)` or create an <iframe data-xstate></iframe> element.'
    );

    inspectService.send('disconnect');

    return { send: () => void 0, disconnect: () => void 0 };
  }

  let client: any;

  const messageHandler = (event) => {
    if (
      typeof event.data === 'object' &&
      event.data !== null &&
      'type' in event.data
    ) {
      if (resolvedIframe && !targetWindow) {
        targetWindow = resolvedIframe.contentWindow;
      }

      if (!client) {
        client = {
          send: (e: any) => {
            targetWindow!.postMessage(e, url);
          }
        };
      }

      inspectService.send({
        ...event.data,
        client
      });
    }
  };

  window.addEventListener('message', messageHandler);

  window.addEventListener('unload', () => {
    inspectService.send({ type: 'unload' });
  });

  if (resolvedIframe === false) {
    targetWindow = window.open(url, 'xstateinspector');
  }

  resolvedDevTools.onRegister((service) => {
    inspectService.send({
      type: 'service.register',
      machine: stringify(service.machine),
      state: stringify(service.state || service.initialState),
      sessionId: service.sessionId,
      id: service.id,
      parent: (service.parent as Interpreter<any>)?.sessionId
    });

    inspectService.send({
      type: 'service.event',
      event: stringify((service.state || service.initialState)._event),
      sessionId: service.sessionId
    });

    // monkey-patch service.send so that we know when an event was sent
    // to a service *before* it is processed, since other events might occur
    // while the sent one is being processed, which throws the order off
    const originalSend = service.send.bind(service);

    service.send = function inspectSend(event: EventObject, payload?: any) {
      inspectService.send({
        type: 'service.event',
        event: stringify(
          toSCXMLEvent(toEventObject(event as EventObject, payload))
        ),
        sessionId: service.sessionId
      });

      return originalSend(event, payload);
    };

    service.subscribe((state) => {
      inspectService.send({
        type: 'service.state',
        state: stringify(state),
        sessionId: service.sessionId
      });
    });

    service.onStop(() => {
      inspectService.send({
        type: 'service.stop',
        sessionId: service.sessionId
      });
    });
  });

  if (resolvedIframe) {
    resolvedIframe.addEventListener('load', () => {
      targetWindow = resolvedIframe.contentWindow!;
    });

    resolvedIframe.setAttribute('src', url);
  }

  return {
    send: (event) => {
      inspectService.send(event);
    },
    disconnect: () => {
      inspectService.send('disconnect');
      window.removeEventListener('message', messageHandler);
    }
  };
}
