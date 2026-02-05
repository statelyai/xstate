import {
  fromCallback,
  fromObservable,
  fromPromise,
  fromTransition
} from '../src/actors/index.ts';
import { createMachine, createActor } from '../src/index.ts';
import { setTimeout as sleep } from 'node:timers/promises';
import z from 'zod';

describe('logic.createActor()', () => {
  describe('fromPromise', () => {
    it('should create an unstarted actor from promise logic', () => {
      const promiseLogic = fromPromise(async () => 42);
      const actor = promiseLogic.createActor();

      expect(actor).toBeDefined();
      expect(actor.getSnapshot().status).toBe('active');
    });

    it('should accept input when creating actor', async () => {
      const promiseLogic = fromPromise<number, { value: number }>(
        async ({ input }) => input.value * 2
      );
      const actor = promiseLogic.createActor({ value: 21 });

      actor.start();
      await sleep(10);

      expect(actor.getSnapshot().output).toBe(42);
    });

    it('should accept options when creating actor', () => {
      const promiseLogic = fromPromise(async () => 42);
      const actor = promiseLogic.createActor(undefined, { id: 'my-promise' });

      expect(actor.id).toBe('my-promise');
    });
  });

  describe('fromCallback', () => {
    it('should create an unstarted actor from callback logic', () => {
      const callbackLogic = fromCallback(() => {});
      const actor = callbackLogic.createActor();

      expect(actor).toBeDefined();
      expect(actor.getSnapshot().status).toBe('active');
    });

    it('should accept input when creating actor', () => {
      let capturedInput: string | undefined;
      const callbackLogic = fromCallback<any, string>(({ input }) => {
        capturedInput = input;
      });
      const actor = callbackLogic.createActor('hello');

      actor.start();

      expect(capturedInput).toBe('hello');
    });
  });

  describe('fromObservable', () => {
    it('should create an unstarted actor from observable logic', () => {
      const observableLogic = fromObservable(() => ({
        subscribe: () => ({ unsubscribe: () => {} })
      }));
      const actor = observableLogic.createActor();

      expect(actor).toBeDefined();
      expect(actor.getSnapshot().status).toBe('active');
    });
  });

  describe('fromTransition', () => {
    it('should create an unstarted actor from transition logic', () => {
      const transitionLogic = fromTransition((state) => state, { count: 0 });
      const actor = transitionLogic.createActor();

      expect(actor).toBeDefined();
      expect(actor.getSnapshot().status).toBe('active');
      expect(actor.getSnapshot().context.count).toBe(0);
    });

    it('should accept input when creating actor', () => {
      const transitionLogic = fromTransition<
        { count: number },
        any,
        any,
        { initialCount: number }
      >(
        (state) => state,
        ({ input }) => ({ count: input.initialCount })
      );
      const actor = transitionLogic.createActor({ initialCount: 10 });

      expect(actor.getSnapshot().context.count).toBe(10);
    });
  });

  describe('StateMachine', () => {
    it('should create an unstarted actor from machine logic', () => {
      const machine = createMachine({
        initial: 'idle',
        states: {
          idle: {}
        }
      });
      const actor = machine.createActor();

      expect(actor).toBeDefined();
      expect(actor.getSnapshot().status).toBe('active');
      expect(actor.getSnapshot().value).toBe('idle');
    });

    it('should accept input when creating actor', () => {
      const machine = createMachine({
        schemas: {
          context: z.object({ value: z.number() }),
          input: z.object({ initialValue: z.number() })
        },
        context: ({ input }) => ({ value: input.initialValue }),
        initial: 'idle',
        states: {
          idle: {}
        }
      });
      const actor = machine.createActor({ initialValue: 42 });

      expect(actor.getSnapshot().context.value).toBe(42);
    });

    it('should accept options when creating actor', () => {
      const machine = createMachine({
        initial: 'idle',
        states: {
          idle: {}
        }
      });
      const actor = machine.createActor(undefined, { id: 'my-machine' });

      expect(actor.id).toBe('my-machine');
    });
  });
});

describe('invoke.src accepting actors', () => {
  it('should accept a created actor as invoke src', async () => {
    const promiseLogic = fromPromise(async () => 'done');

    const machine = createMachine({
      schemas: {
        context: z.object({ result: z.string().optional() })
      },
      context: { result: undefined },
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: () => promiseLogic.createActor(),
            onDone: ({ event }) => ({
              target: 'success',
              context: { result: event.output }
            })
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actor = createActor(machine);
    actor.start();

    await sleep(20);

    expect(actor.getSnapshot().value).toBe('success');
    expect(actor.getSnapshot().context.result).toBe('done');
  });

  it('should accept a function returning a created actor', async () => {
    const promiseLogic = fromPromise<string, { message: string }>(
      async ({ input }) => input.message
    );

    const machine = createMachine({
      schemas: {
        context: z.object({
          message: z.string(),
          result: z.string().optional()
        })
      },
      context: { message: 'hello', result: undefined },
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: ({ context }) =>
              promiseLogic.createActor({ message: context.message }),
            onDone: ({ context, event }) => ({
              target: 'success',
              context: { ...context, result: event.output }
            })
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actor = createActor(machine);
    actor.start();

    await sleep(20);

    expect(actor.getSnapshot().value).toBe('success');
    expect(actor.getSnapshot().context.result).toBe('hello');
  });

  it('should accept an already started actor and not stop it on exit', async () => {
    let stopped = false;
    const callbackLogic = fromCallback(() => {
      return () => {
        stopped = true;
      };
    });

    const externalActor = createActor(callbackLogic);
    externalActor.start();

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          invoke: {
            src: externalActor,
            id: 'external'
          },
          on: {
            NEXT: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const actor = createActor(machine);
    actor.start();

    expect(actor.getSnapshot().children.external).toBe(externalActor);

    actor.send({ type: 'NEXT' });

    // External actor should NOT be stopped when state exits
    expect(stopped).toBe(false);
    expect(externalActor.getSnapshot().status).toBe('active');
  });

  it('should stop owned actors on exit', async () => {
    let stopped = false;
    const callbackLogic = fromCallback(() => {
      return () => {
        stopped = true;
      };
    });

    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          invoke: {
            src: callbackLogic.createActor(),
            id: 'owned'
          },
          on: {
            NEXT: 'b'
          }
        },
        b: {
          type: 'final'
        }
      }
    });

    const actor = createActor(machine);
    actor.start();

    actor.send({ type: 'NEXT' });

    // Owned actor should be stopped when state exits
    expect(stopped).toBe(true);
  });

  it('should work with actors from machine implementations', async () => {
    const promiseLogic = fromPromise(async () => 'from-actors');

    const machine = createMachine({
      actors: {
        myPromise: promiseLogic
      },
      schemas: {
        context: z.object({ result: z.string().optional() })
      },
      context: { result: undefined },
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: ({ actors }) => actors.myPromise.createActor(),
            onDone: ({ event }) => ({
              target: 'success',
              context: { result: event.output }
            })
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const actor = createActor(machine);
    actor.start();

    await sleep(20);

    expect(actor.getSnapshot().value).toBe('success');
    expect(actor.getSnapshot().context.result).toBe('from-actors');
  });

  it('should use actor from context as external (already started)', async () => {
    // When using an already-started actor from context, it runs as external
    // The machine can subscribe to its snapshot changes but not receive sendBack events
    // because the external actor's parent is not the machine
    const transitionLogic = fromTransition(
      (state, event) => {
        if (event.type === 'INC') {
          return { count: state.count + 1 };
        }
        return state;
      },
      { count: 0 }
    );

    const externalActor = createActor(transitionLogic);
    externalActor.start();

    const machine = createMachine({
      schemas: {
        context: z.object({
          actorRef: z.any()
        })
      },
      context: { actorRef: externalActor },
      initial: 'running',
      states: {
        running: {
          invoke: {
            src: ({ context }) => context.actorRef,
            id: 'external'
          }
        }
      }
    });

    const actor = createActor(machine);
    actor.start();

    // The external actor is registered as a child
    expect(actor.getSnapshot().children.external).toBe(externalActor);

    // We can interact with the external actor directly
    externalActor.send({ type: 'INC' });
    expect(externalActor.getSnapshot().context.count).toBe(1);
  });
});
