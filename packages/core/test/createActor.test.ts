import {
  fromCallback,
  fromObservable,
  fromPromise,
  fromTransition
} from '../src/actors/index.ts';
import {
  createMachine,
  createActor,
  type DoneActorEvent
} from '../src/index.ts';
import { setTimeout as sleep } from 'node:timers/promises';
import z from 'zod';
describe('createActor()', () => {
  describe('fromPromise', () => {
    it('should create an unstarted actor from promise logic', () => {
      const promiseLogic = fromPromise(async () => 42);
      const actor = createActor(promiseLogic);
      expect(actor).toBeDefined();
      expect(actor.getSnapshot().status).toBe('active');
    });
    it('should accept input when creating actor', async () => {
      const promiseLogic = fromPromise<
        number,
        {
          value: number;
        }
      >(async ({ input }) => input.value * 2);
      const actor = createActor(promiseLogic, { input: { value: 21 } });
      actor.start();
      await sleep(10);
      expect(actor.getSnapshot().output).toBe(42);
    });
    it('should accept options when creating actor', () => {
      const promiseLogic = fromPromise(async () => 42);
      const actor = createActor(promiseLogic, { id: 'my-promise' });
      expect(actor.id).toBe('my-promise');
    });
  });
  describe('fromCallback', () => {
    it('should create an unstarted actor from callback logic', () => {
      const callbackLogic = fromCallback(() => {});
      const actor = createActor(callbackLogic);
      expect(actor).toBeDefined();
      expect(actor.getSnapshot().status).toBe('active');
    });
    it('should accept input when creating actor', () => {
      let capturedInput: string | undefined;
      const callbackLogic = fromCallback<any, string>(({ input }) => {
        capturedInput = input;
      });
      const actor = createActor(callbackLogic, { input: 'hello' });
      actor.start();
      expect(capturedInput).toBe('hello');
    });
  });
  describe('fromObservable', () => {
    it('should create an unstarted actor from observable logic', () => {
      const observableLogic = fromObservable(() => ({
        subscribe: () => ({ unsubscribe: () => {} })
      }));
      const actor = createActor(observableLogic);
      expect(actor).toBeDefined();
      expect(actor.getSnapshot().status).toBe('active');
    });
  });
  describe('fromTransition', () => {
    it('should create an unstarted actor from transition logic', () => {
      const transitionLogic = fromTransition((state) => state, { count: 0 });
      const actor = createActor(transitionLogic);
      expect(actor).toBeDefined();
      expect(actor.getSnapshot().status).toBe('active');
      expect(actor.getSnapshot().context.count).toBe(0);
    });
    it('should accept input when creating actor', () => {
      const transitionLogic = fromTransition<
        {
          count: number;
        },
        any,
        any,
        {
          initialCount: number;
        }
      >(
        (state) => state,
        ({ input }) => ({ count: input.initialCount })
      );
      const actor = createActor(transitionLogic, {
        input: { initialCount: 10 }
      });
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
      const actor = createActor(machine);
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
      const actor = createActor(machine, { input: { initialValue: 42 } });
      expect(actor.getSnapshot().context.value).toBe(42);
    });
    it('should accept options when creating actor', () => {
      const machine = createMachine({
        initial: 'idle',
        states: {
          idle: {}
        }
      });
      const actor = createActor(machine, { id: 'my-machine' });
      expect(actor.id).toBe('my-machine');
    });
  });
});
describe('invoke.src accepting actor logic', () => {
  it('should accept a function returning actor logic', async () => {
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
            src: () => promiseLogic,
            onDone: ({ event }: { event: DoneActorEvent<string> }) => ({
              target: 'success',
              context: { result: event.output }
            })
          }
        },
        success: {
          type: 'final'
        }
      } as any
    });
    const actor = createActor(machine);
    actor.start();
    await sleep(20);
    expect(actor.getSnapshot().value).toBe('success');
    expect(actor.getSnapshot().context.result).toBe('done');
  });
  it('should pass mapped input to returned actor logic', async () => {
    const promiseLogic = fromPromise<
      string,
      {
        message: string;
      }
    >(async ({ input }) => input.message);
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
            src: ({
              actors
            }: {
              actors: {
                promiseLogic: typeof promiseLogic;
              };
            }) => actors.promiseLogic,
            input: ({
              context
            }: {
              context: {
                message: string;
                result?: string;
              };
            }) => ({ message: context.message }),
            onDone: ({
              context,
              event
            }: {
              context: {
                message: string;
                result?: string;
              };
              event: DoneActorEvent<string>;
            }) => ({
              target: 'success',
              context: { ...context, result: event.output }
            })
          }
        },
        success: {
          type: 'final'
        }
      } as any,
      actors: {
        promiseLogic
      }
    });
    const actor = createActor(machine);
    actor.start();
    await sleep(20);
    expect(actor.getSnapshot().value).toBe('success');
    expect(actor.getSnapshot().context.result).toBe('hello');
  });
  it('should accept a string actor logic reference', async () => {
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
            src: 'myPromise',
            onDone: ({ event }: { event: DoneActorEvent<string> }) => ({
              target: 'success',
              context: { result: event.output }
            })
          }
        },
        success: {
          type: 'final'
        }
      } as any
    });
    const actor = createActor(machine);
    actor.start();
    await sleep(20);
    expect(actor.getSnapshot().value).toBe('success');
    expect(actor.getSnapshot().context.result).toBe('from-actors');
  });
});
