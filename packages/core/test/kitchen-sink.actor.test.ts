import { interval, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { sendParent } from '../src/actions.ts';
import { assign } from '../src/actions/assign';
import { raise } from '../src/actions/raise';
import { sendTo } from '../src/actions/send';
import { CallbackActorRef, fromCallback } from '../src/actors/callback.ts';
import {
  fromEventObservable,
  fromObservable
} from '../src/actors/observable.ts';
import {
  PromiseActorLogic,
  PromiseActorRef,
  fromPromise
} from '../src/actors/promise.ts';
import {
  ActorLogic,
  ActorRef,
  ActorRefFrom,
  AnyActorRef,
  createActor,
  createMachine
} from '../src/index.ts';

describe('composite state machine', () => {
  type CompositeEvent =
    | { type: 'PING' }
    | { type: 'PONG' }
    | { type: 'START_CB' }
    | { type: 'SEND_BACK' }
    | { type: 'GREET' }
    | { type: 'ACTIVATE' }
    | { type: 'SUCCESS' }
    | { type: 'SET_COMPLETE'; id: number }
    | { type: 'COUNT'; val: number };

  interface CompositeContext {
    server?: ActorRef<any, CompositeEvent>;
    promiseRef?: PromiseActorRef<string>;
    callbackRef?: CallbackActorRef<{ type: 'START' }>;
    observableRef?: AnyActorRef;
    eventObservableRef?: AnyActorRef;
    childRef?: ActorRef<any, any>;
    parent: AnyActorRef;
  }

  const serverMachine = createMachine({
    types: {} as {
      events: CompositeEvent;
    },
    id: 'server',
    initial: 'waitPing',
    states: {
      waitPing: {
        on: {
          PING: 'sendPong'
        }
      },
      sendPong: {
        entry: [sendParent({ type: 'PONG' }), raise({ type: 'SUCCESS' })],
        on: {
          SUCCESS: 'waitPing'
        }
      }
    }
  });

  const childMachine = createMachine({
    types: {} as {
      context: { parent: AnyActorRef };
      input: { parent: AnyActorRef };
    },
    context: ({ input }) => ({
      parent: input.parent
    }),
    entry: sendTo(({ context }) => context.parent, { type: 'GREET' })
  });

  const promiseLogic: PromiseActorLogic<string> = {
    transition: (state, event, { self }) => {
      if (event.type === 'PING') {
        self._parent?.send({ type: 'PONG' });
      }
      return state;
    },
    getInitialSnapshot: (input) => ({
      status: 'active',
      output: undefined,
      error: undefined,
      input
    }),
    getPersistedSnapshot: (s) => s
  };

  const compositeMachine = createMachine({
    types: {} as { context: CompositeContext; events: CompositeEvent },
    id: 'composite',
    initial: 'init',
    context: ({ self }) => ({
      server: undefined,
      promiseRef: undefined,
      callbackRef: undefined,
      observableRef: undefined,
      eventObservableRef: undefined,
      childRef: undefined,
      parent: self
    }),
    states: {
      init: {
        entry: [
          assign({
            server: ({ spawn }) => spawn(serverMachine),
            promiseRef: ({ spawn }) =>
              spawn(
                fromPromise(() => Promise.resolve('response')),
                { id: 'my-promise' }
              ),
            callbackRef: ({ spawn }) =>
              spawn(
                fromCallback(({ sendBack, receive }) => {
                  receive((event) => {
                    if (event.type === 'START') {
                      setTimeout(() => {
                        sendBack({ type: 'SEND_BACK' });
                      }, 10);
                    }
                  });
                })
              ),
            observableRef: ({ spawn }) =>
              spawn(fromObservable(() => interval(10))),
            eventObservableRef: ({ spawn }) =>
              spawn(
                fromEventObservable(() =>
                  interval(10).pipe(map((val) => ({ type: 'COUNT', val })))
                )
              ),
            childRef: ({ spawn, context }) =>
              spawn(childMachine, { input: { parent: context.parent } })
          }),
          raise({ type: 'SUCCESS' })
        ],
        on: {
          SUCCESS: 'active'
        }
      },
      active: {
        on: {
          PING: {
            actions: sendTo(({ context }) => context.server!, { type: 'PING' })
          },
          START_CB: {
            actions: sendTo(({ context }) => context.callbackRef!, {
              type: 'START'
            })
          },
          SET_COMPLETE: {
            actions: sendTo(({ context }) => context.server!, {
              type: 'SET_COMPLETE',
              id: 5
            })
          },
          COUNT: {
            target: 'success',
            guard: ({ event }) => event.val === 5
          },
          GREET: 'success',
          SEND_BACK: 'success'
        }
      },
      success: {
        type: 'final'
      }
    }
  });

  it('should work as a composite state machine', (done) => {
    const actor = createActor(compositeMachine);
    let eventsSent = 0;

    actor.subscribe({
      complete: () => {
        done();
      },
      next: (state) => {
        // Log state transitions
        console.log('State:', state.value);

        if (state.matches('active')) {
          // Send events sequentially
          if (eventsSent === 0) {
            console.log('Sending PING event');
            actor.send({ type: 'PING' });
          } else if (eventsSent === 1) {
            console.log('Sending START_CB event');
            actor.send({ type: 'START_CB' });
          } else if (eventsSent === 2) {
            console.log('Sending SET_COMPLETE event');
            actor.send({ type: 'SET_COMPLETE', id: 42 });
          } else if (eventsSent === 3) {
            console.log('Sending COUNT event');
            actor.send({ type: 'COUNT', val: 5 });
          }
          eventsSent++;
        }
      }
    });

    actor.start();
  });
});
