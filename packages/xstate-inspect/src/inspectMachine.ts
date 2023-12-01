import { ActorRef, assign, createMachine, Interpreter } from 'xstate';
import { XStateDevInterface } from 'xstate/dev';
import { stringifyState } from './serialize.ts';

import { ReceiverEvent, Replacer } from './types.ts';
import { stringify } from './utils.ts';

export type InspectMachineEvent =
  | ReceiverEvent
  | { type: 'unload' }
  | { type: 'disconnect' }
  | { type: 'xstate.event'; event: string; service: string }
  | { type: 'xstate.inspecting'; client: Pick<ActorRef<any, any>, 'send'> };

export function createInspectMachine(
  devTools: XStateDevInterface = (globalThis as any).__xstate__,
  options?: { serialize?: Replacer | undefined }
) {
  const serviceMap = new Map<string, ActorRef<any, any>>();

  // Listen for services being registered and index them
  // by their sessionId for quicker lookup
  const sub = devTools.onRegister((service) => {
    serviceMap.set(service.sessionId, service);
  });

  return createMachine({
    types: {} as {
      context: {
        client?: Pick<ActorRef<any, any>, 'send'>;
      };
      events: InspectMachineEvent;
    },
    initial: 'pendingConnection',
    context: {
      client: undefined
    },
    states: {
      pendingConnection: {},
      connected: {
        on: {
          'service.state': {
            actions: ({ context, event }) => context.client!.send(event)
          },
          'service.event': {
            actions: ({ context, event }) => context.client!.send(event)
          },
          'service.register': {
            actions: ({ context, event }) => context.client!.send(event)
          },
          'service.stop': {
            actions: ({ context, event }) => context.client!.send(event)
          },
          'xstate.event': {
            actions: ({ event: e }) => {
              const { event } = e;
              const parsedEvent = JSON.parse(event);
              // TODO: figure out a different mechanism
              const service = serviceMap.get(parsedEvent.origin?.id!);
              service?.send(parsedEvent);
            }
          },
          unload: {
            actions: ({ context }) => {
              context.client!.send({ type: 'xstate.disconnect' });
            }
          },
          disconnect: 'disconnected'
        }
      },
      disconnected: {
        entry: () => {
          sub.unsubscribe();
        },
        type: 'final'
      }
    },
    on: {
      'xstate.inspecting': {
        target: '.connected',
        actions: [
          assign({
            client: ({ event }) => event.client
          }),
          ({ context }) => {
            devTools.services.forEach((service) => {
              context.client?.send({
                type: 'service.register',
                machine: stringify(service.logic, options?.serialize),
                state: stringifyState(
                  service.getSnapshot(),
                  options?.serialize
                ),
                sessionId: service.sessionId
              });
            });
          }
        ]
      }
    }
  });
}
