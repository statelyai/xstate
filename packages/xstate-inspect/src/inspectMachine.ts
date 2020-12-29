import { createMachine, assign, SCXML, ActorRef, Interpreter } from 'xstate';
import { XStateDevInterface } from 'xstate/lib/devTools';
import { ReceiverEvent } from './types';
import { stringify } from './utils';

export type InspectMachineEvent =
  | ReceiverEvent
  | { type: 'unload' }
  | { type: 'disconnect' }
  | { type: 'xstate.event'; event: string; service: string }
  | { type: 'xstate.inspecting'; client: ActorRef<any> };

export function createInspectMachine(
  devTools: XStateDevInterface = globalThis.__xstate__
) {
  const serviceMap = new Map<string, Interpreter<any, any, any>>();

  return createMachine<
    {
      client?: ActorRef<any>;
    },
    InspectMachineEvent
  >({
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
              const service = serviceMap.get(scxmlEventObject.origin!);
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
          assign({
            client: (
              _,
              e: InspectMachineEvent & { type: 'xstate.inspecting' }
            ) => e.client
          }),
          (ctx) => {
            devTools.services.forEach((service) => {
              ctx.client?.send({
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
}
