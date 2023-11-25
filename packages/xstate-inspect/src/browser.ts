import {
  ActorRef,
  AnyInterpreter,
  EventData,
  EventObject,
  interpret,
  Interpreter,
  Observer,
  toActorRef,
  toEventObject,
  toObserver,
  toSCXMLEvent,
  XStateDevInterface
} from 'xstate';
import { createInspectMachine, InspectMachineEvent } from './inspectMachine';
import { stringifyMachine, stringifyState } from './serialize';
import type {
  Inspector,
  InspectorOptions,
  InspectReceiver,
  ParsedReceiverEvent,
  ServiceListener,
  WebSocketReceiverOptions,
  WindowReceiverOptions
} from './types';
import {
  getLazy,
  isReceiverEvent,
  parseReceiverEvent,
  stringify
} from './utils';

export const serviceMap = new Map<string, Interpreter<any>>();

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

const defaultInspectorOptions = {
  url: 'https://stately.ai/viz?inspect',
  iframe: () =>
    document.querySelector<HTMLIFrameElement>('iframe[data-xstate]'),
  devTools: () => {
    const devTools = createDevTools();
    globalThis.__xstate__ = devTools;
    return devTools;
  },
  serialize: undefined,
  targetWindow: undefined
};

const getFinalOptions = (options?: Partial<InspectorOptions>) => {
  const withDefaults = { ...defaultInspectorOptions, ...options };
  return {
    ...withDefaults,
    url: new URL(withDefaults.url),
    iframe: getLazy(withDefaults.iframe),
    devTools: getLazy(withDefaults.devTools)
  };
};

const patchedInterpreters = new Set<AnyInterpreter>();

export function inspect(options?: InspectorOptions): Inspector | undefined {
  const finalOptions = getFinalOptions(options);
  const { iframe, url, devTools } = finalOptions;

  if (options?.targetWindow === null) {
    throw new Error('Received a nullable `targetWindow`.');
  }
  let targetWindow: Window | null | undefined = finalOptions.targetWindow;

  if (iframe === null && !targetWindow) {
    console.warn(
      'No suitable <iframe> found to embed the inspector. Please pass an <iframe> element to `inspect(iframe)` or create an <iframe data-xstate></iframe> element.'
    );

    return undefined;
  }

  const inspectMachine = createInspectMachine(devTools, options);
  const inspectService = interpret(inspectMachine).start();
  const listeners = new Set<Observer<any>>();

  const sub = inspectService.subscribe((state) => {
    listeners.forEach((listener) => listener.next(state));
  });

  let client: Pick<ActorRef<any>, 'send'>;

  const messageHandler = (event: MessageEvent<unknown>) => {
    if (
      typeof event.data === 'object' &&
      event.data !== null &&
      'type' in event.data
    ) {
      if (iframe && !targetWindow) {
        targetWindow = iframe.contentWindow;
      }

      if (!client) {
        client = {
          send: (e: any) => {
            targetWindow!.postMessage(e, url.origin);
          }
        };
      }

      const inspectEvent = {
        ...(event.data as InspectMachineEvent),
        client
      };

      inspectService.send(inspectEvent);
    }
  };

  window.addEventListener('message', messageHandler);

  window.addEventListener('unload', () => {
    inspectService.send({ type: 'unload' });
  });

  const stringifyWithSerializer = (value: any) =>
    stringify(value, options?.serialize);

  devTools.onRegister((service) => {
    const state = service.state || service.initialState;
    inspectService.send({
      type: 'service.register',
      machine: stringifyMachine(service.machine, options?.serialize),
      state: stringifyState(state, options?.serialize),
      sessionId: service.sessionId,
      id: service.id,
      parent: service.parent?.sessionId
    });

    inspectService.send({
      type: 'service.event',
      event: stringifyWithSerializer(state._event),
      sessionId: service.sessionId
    });

    if (!patchedInterpreters.has(service)) {
      patchedInterpreters.add(service);

      // monkey-patch service.send so that we know when an event was sent
      // to a service *before* it is processed, since other events might occur
      // while the sent one is being processed, which throws the order off
      const originalSend = service.send.bind(service);

      service.send = function inspectSend(
        event: EventObject,
        payload?: EventData
      ) {
        inspectService.send({
          type: 'service.event',
          event: stringifyWithSerializer(
            toSCXMLEvent(toEventObject(event as EventObject, payload))
          ),
          sessionId: service.sessionId
        });

        return originalSend(event, payload);
      };
    }

    service.subscribe((state) => {
      // filter out synchronous notification from within `.start()` call
      // when the `service.state` has not yet been assigned
      if (state === undefined) {
        return;
      }
      inspectService.send({
        type: 'service.state',
        // TODO: investigate usage of structuredClone in browsers if available
        state: stringifyState(state, options?.serialize),
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

  if (iframe) {
    iframe.addEventListener('load', () => {
      targetWindow = iframe.contentWindow!;
    });

    iframe.setAttribute('src', String(url));
  } else if (!targetWindow) {
    targetWindow = window.open(String(url), 'xstateinspector');
  }

  return {
    send: (event) => {
      inspectService.send(event);
    },
    subscribe: (next, onError, onComplete) => {
      const observer = toObserver(next, onError, onComplete);

      listeners.add(observer);
      observer.next(inspectService.state);

      return {
        unsubscribe: () => {
          listeners.delete(observer);
        }
      };
    },
    disconnect: () => {
      inspectService.send('disconnect');
      window.removeEventListener('message', messageHandler);
      sub.unsubscribe();
    }
  } as Inspector;
}

export function createWindowReceiver(
  options?: Partial<WindowReceiverOptions>
): InspectReceiver {
  const {
    window: ownWindow = window,
    targetWindow = window.self === window.top ? window.opener : window.parent
  } = options || {};
  const observers = new Set<Observer<ParsedReceiverEvent>>();
  let latestEvent: ParsedReceiverEvent;

  const handler = (event: MessageEvent) => {
    const { data } = event;
    if (isReceiverEvent(data)) {
      latestEvent = parseReceiverEvent(data);
      observers.forEach((listener) => listener.next(latestEvent));
    }
  };

  ownWindow.addEventListener('message', handler);

  const actorRef: InspectReceiver = toActorRef({
    id: 'xstate.windowReceiver',

    send(event) {
      if (!targetWindow) {
        return;
      }
      targetWindow.postMessage(event, '*');
    },
    subscribe(next, onError?, onComplete?) {
      const observer = toObserver(next, onError, onComplete);

      observers.add(observer);

      return {
        unsubscribe: () => {
          observers.delete(observer);
        }
      };
    },
    stop() {
      observers.clear();

      ownWindow.removeEventListener('message', handler);
    },
    getSnapshot() {
      return latestEvent;
    }
  });

  actorRef.send({
    type: 'xstate.inspecting'
  });

  return actorRef;
}

export function createWebSocketReceiver(
  options: WebSocketReceiverOptions
): InspectReceiver {
  const { protocol = 'ws' } = options;
  const ws = new WebSocket(`${protocol}://${options.server}`);
  const observers = new Set<Observer<ParsedReceiverEvent>>();
  let latestEvent: ParsedReceiverEvent;

  const actorRef: InspectReceiver = toActorRef({
    id: 'xstate.webSocketReceiver',
    send(event) {
      ws.send(stringify(event, options.serialize));
    },
    subscribe(next, onError?, onComplete?) {
      const observer = toObserver(next, onError, onComplete);

      observers.add(observer);

      return {
        unsubscribe: () => {
          observers.delete(observer);
        }
      };
    },
    getSnapshot() {
      return latestEvent;
    }
  });

  ws.onopen = () => {
    actorRef.send({
      type: 'xstate.inspecting'
    });
  };

  ws.onmessage = (event) => {
    if (typeof event.data !== 'string') {
      return;
    }

    try {
      const eventObject = JSON.parse(event.data);

      if (isReceiverEvent(eventObject)) {
        latestEvent = parseReceiverEvent(eventObject);
        observers.forEach((observer) => {
          observer.next(latestEvent);
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  ws.onerror = (err) => {
    observers.forEach((observer) => {
      observer.error?.(err);
    });
  };

  return actorRef;
}
