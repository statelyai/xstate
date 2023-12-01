import {
  ActorRef,
  AnyActor,
  EventObject,
  createActor,
  Observer,
  toObserver
} from 'xstate';
import { XStateDevInterface } from 'xstate/dev';
import { createInspectMachine, InspectMachineEvent } from './inspectMachine.ts';
import { stringifyState } from './serialize.ts';
import type {
  Inspector,
  InspectorOptions,
  InspectReceiver,
  ParsedReceiverEvent,
  ReceiverCommand,
  ServiceListener,
  WebSocketReceiverOptions,
  WindowReceiverOptions
} from './types.ts';
import {
  getLazy,
  isReceiverEvent,
  parseReceiverEvent,
  stringify
} from './utils.ts';

export const serviceMap = new Map<string, AnyActor>();

export function createDevTools(): XStateDevInterface {
  const services = new Set<AnyActor>();
  const serviceListeners = new Set<ServiceListener>();

  const unregister: XStateDevInterface['unregister'] = (service) => {
    services.delete(service);
    serviceMap.delete(service.sessionId);
  };

  return {
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
}

const defaultInspectorOptions = {
  url: 'https://stately.ai/viz?inspect',
  iframe: () =>
    document.querySelector<HTMLIFrameElement>('iframe[data-xstate]'),
  devTools: () => {
    const devTools = createDevTools();
    (globalThis as any).__xstate__ = devTools;
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

const patchedInterpreters = new Set<AnyActor>();

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
  const inspectService = createActor(inspectMachine).start();
  const listeners = new Set<Observer<any>>();

  const sub = inspectService.subscribe((state) => {
    listeners.forEach((listener) => listener.next?.(state));
  });

  let client: Pick<ActorRef<any, any>, 'send'>;

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
    const state = service.getSnapshot();
    inspectService.send({
      type: 'service.register',
      machine: stringify(service.logic, options?.serialize),
      state: stringifyState(state, options?.serialize),
      sessionId: service.sessionId,
      id: service.id,
      parent: (service._parent as AnyActor)?.sessionId
    });

    if (!patchedInterpreters.has(service)) {
      patchedInterpreters.add(service);

      // monkey-patch service.send so that we know when an event was sent
      // to a service *before* it is processed, since other events might occur
      // while the sent one is being processed, which throws the order off
      const originalSend = service.send.bind(service);

      service.send = function inspectSend(event: EventObject) {
        inspectService.send({
          type: 'service.event',
          event: stringifyWithSerializer(event),
          sessionId: service.sessionId
        });

        return originalSend(event);
      };
    }

    service.subscribe((state) => {
      inspectService.send({
        type: 'service.state',
        // TODO: investigate usage of structuredClone in browsers if available
        state: stringifyState(state, options?.serialize),
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

  if (iframe) {
    iframe.addEventListener('load', () => {
      targetWindow = iframe.contentWindow!;
    });

    iframe.setAttribute('src', String(url));
  } else if (!targetWindow) {
    targetWindow = window.open(String(url), 'xstateinspector');
  }

  return {
    name: '@@xstate/inspector',
    send: (event) => {
      inspectService.send(event);
    },
    subscribe: (next, onError, onComplete) => {
      const observer = toObserver(next, onError, onComplete);

      listeners.add(observer);
      observer.next?.(inspectService.getSnapshot());

      return {
        unsubscribe: () => {
          listeners.delete(observer);
        }
      };
    },
    disconnect: () => {
      inspectService.send({ type: 'disconnect' });
      window.removeEventListener('message', messageHandler);
      sub.unsubscribe();
    }
  };
}

export function createWindowReceiver(options?: Partial<WindowReceiverOptions>) {
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
      observers.forEach((listener) => listener.next?.(latestEvent));
    }
  };

  ownWindow.addEventListener('message', handler);

  const actorRef = {
    name: 'xstate.windowReceiver',

    send(event: ReceiverCommand) {
      if (!targetWindow) {
        return;
      }
      targetWindow.postMessage(event, '*');
    },
    subscribe(
      next: (value: ParsedReceiverEvent) => void,
      error?: (error: any) => void,
      complete?: () => void
    ) {
      const observer = toObserver(next, error, complete);

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
  };

  actorRef.send({
    type: 'xstate.inspecting'
  });

  return actorRef;
}

export function createWebSocketReceiver(options: WebSocketReceiverOptions) {
  const { protocol = 'ws' } = options;
  const ws = new WebSocket(`${protocol}://${options.server}`);
  const observers = new Set<Observer<ParsedReceiverEvent>>();
  let latestEvent: ParsedReceiverEvent;

  const actorRef = {
    name: 'xstate.webSocketReceiver',
    send(event: ReceiverCommand) {
      ws.send(stringify(event, options.serialize));
    },
    subscribe(
      next: (value: ParsedReceiverEvent) => void,
      error?: (error: any) => void,
      complete?: () => void
    ) {
      const observer = toObserver(next, error, complete);

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
  };

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
          observer.next?.(latestEvent);
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
