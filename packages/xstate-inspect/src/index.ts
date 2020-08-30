import { Interpreter, createMachine, assign, interpret, SCXML } from 'xstate';

export type ServiceListener = (service: Interpreter<any>) => void;

type MaybeLazy<T> = T | (() => T);

export interface InspectorOptions {
  url: string;
  iframe: MaybeLazy<HTMLIFrameElement | null | false>;
}

declare global {
  interface Window {
    __xstate__: {
      register: (service: Interpreter<any>) => void;
      onRegister: (
        listener: ServiceListener
      ) => {
        unsubscribe: () => void;
      };
      services: Set<Interpreter<any>>;
    };
  }
}

const serviceMap = new Map<string, Interpreter<any>>();

export function createDevTools() {
  const services = new Set<Interpreter<any>>();
  const serviceListeners = new Set<ServiceListener>();

  window.__xstate__ = {
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

export const inspectMachine = createMachine<{
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
            const service = serviceMap.get(scxmlEventObject.origin!);
            service?.send(JSON.parse(event));
          }
        },
        unload: {
          actions: (ctx) => {
            ctx.client!.send({ type: 'xstate.disconnect' });
          }
        },
        disconnect: 'pendingConnection'
      }
    }
  },
  on: {
    'xstate.inspecting': {
      target: '.connected',
      actions: [
        assign({ client: (_, e) => e.client }),
        (ctx) => {
          globalThis.__xstate__.services.forEach((service) => {
            ctx.client.send({
              type: 'service.register',
              machine: JSON.stringify(service.machine),
              state: JSON.stringify(service.state || service.initialState),
              id: service.id
            });
          });
        }
      ]
    }
  }
});

const defaultInspectorOptions: InspectorOptions = {
  url: 'https://embed.statecharts.io',
  iframe: () => document.querySelector<HTMLIFrameElement>('iframe[data-xstate]')
};

export function inspect(
  options?: Partial<InspectorOptions>
): {
  disconnect: () => void;
} {
  createDevTools();

  const { iframe, url } = { ...defaultInspectorOptions, ...options };
  const resolvedIframe = typeof iframe === 'function' ? iframe() : iframe;

  let targetWindow: Window | null | undefined;

  const inspectService = interpret(inspectMachine).start();

  if (resolvedIframe === null) {
    console.warn(
      'No suitable <iframe> found to embed the inspector. Please pass an <iframe> element to `inspect(iframe)` or create an <iframe data-xstate></iframe> element.'
    );

    return { disconnect: () => void 0 };
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

    service.onStop(() => {
      inspectService.send({
        type: 'service.stop',
        id: service.id
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
    disconnect: () => {
      inspectService.send('disconnect');
      window.removeEventListener('message', messageHandler);
    }
  };
}
