import {
  ActorLogic,
  AnyActorRef,
  AnyEventObject,
  InspectionEvent,
  Observer,
  fromCallback
} from 'xstate';

export {
  inspect,
  createWindowReceiver,
  createWebSocketReceiver,
  createDevTools
} from './browser.ts';
export * from './types.ts';

const WebSocket = require('ws');

export interface Inspector extends Observer<InspectionEvent> {
  register: (actorRef: AnyActorRef | string) => void;
}

export function fromWebSocket(server: string): ActorLogic<AnyEventObject> {
  return fromCallback(({ sendBack, receive }) => {
    const ws = new WebSocket(server);

    ws.onopen = () => {
      sendBack({ type: 'xstate.websocket.opened', server });
    };

    ws.onclose = () => {
      sendBack({ type: 'xstate.websocket.closed', server });
    };

    ws.onerror = (event: any) => {};

    ws.onmessage = (event: any) => {
      if (typeof event.data !== 'string') {
        return;
      }

      console.log('websocket', event.data);

      sendBack(JSON.parse(event.data));
    };

    receive((event) => {
      ws.send(JSON.stringify(event));
    });
  });
}

export function createInspector(): Inspector {
  let ws: WebSocket;
  let open = false;
  const deferredEvents: InspectionEvent[] = [];

  function start() {
    ws = new WebSocket('ws://localhost:8080');

    ws.onopen = () => {
      console.log('websocket open');
      open = true;
      deferredEvents.forEach((event) => {
        ws.send(JSON.stringify(event));
      });
    };

    ws.onclose = () => {
      console.log('websocket close');
    };

    ws.onerror = async (event) => {
      console.log('websocket error', event);
      await new Promise((res) => setTimeout(res, 500));
      console.log('restarting');
      start();
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') {
        return;
      }

      console.log('websocket', event.data);

      // sendBack(JSON.parse(event.data));
    };
  }

  start();

  const inspector: Inspector = {
    next: (inspectionEvent) => {
      if (open) {
        ws.send(JSON.stringify(inspectionEvent));
      } else {
        deferredEvents.push(inspectionEvent);
      }
    },
    register: (actorRefOrId) => {
      if (typeof actorRefOrId === 'string') {
        inspector.next!({
          type: '@xstate.registration',
          actorRef: null as any,
          sessionId: actorRefOrId
        });
      }
    }
  };

  return inspector;
}
