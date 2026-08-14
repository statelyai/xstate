import {
  createActor,
  setup,
  toPromise,
  types,
  type ActorRefFrom
} from 'xstate';
// Actor creators are imported from the `xstate/actors` subpath so that this
// example runs under `tsx` against the workspace build.
import { createAsyncLogic } from 'xstate/actors';

const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type Role = 'research' | 'write' | 'review';

/** A mock LLM call. The `review` worker is scripted to fail. */
const think = createAsyncLogic({
  run: async ({ input }: { input: { role: Role; brief: string } }) => {
    await wait(200);
    if (input.role === 'review') {
      throw new Error('ContextLengthExceeded');
    }
    return { text: `[${input.role}] ${input.brief}` };
  }
});

/**
 * A worker agent. It idles until the orchestrator hands it work, does one
 * turn, then emits the result (or the failure) and idles again.
 */
const worker = setup({
  schemas: {
    context: types<{ role: Role; brief: string }>(),
    events: { work: types<{ brief: string }>() },
    emitted: {
      result: types<{ role: Role; text: string }>(),
      failed: types<{ role: Role; reason: string }>()
    },
    input: types<{ role: Role }>()
  }
}).createMachine({
  context: ({ input }) => ({ role: input.role, brief: '' }),
  initial: 'idle',
  states: {
    idle: {
      on: {
        work: ({ context, event }, enq) => {
          enq(log, `${context.role} worker received a brief`);
          return { target: 'working', context: { brief: event.brief } };
        }
      }
    },
    working: {
      invoke: {
        src: think,
        input: ({ context }) => ({ role: context.role, brief: context.brief }),
        onDone: ({ context, event }, enq) => {
          enq.emit({
            type: 'result',
            role: context.role,
            text: event.output.text
          });
          return { target: 'idle' };
        },
        onError: ({ context, event }, enq) => {
          enq.emit({
            type: 'failed',
            role: context.role,
            reason: (event.error as Error).message
          });
          return { target: 'idle' };
        }
      }
    }
  }
});

type WorkerRef = ActorRefFrom<typeof worker>;

type ResultEmitted = { type: 'result'; role: Role; text: string };
type FailedEmitted = { type: 'failed'; role: Role; reason: string };
type WorkerResultEvent = { type: 'workerResult'; role: Role; text: string };
type WorkerFailedEvent = { type: 'workerFailed'; role: Role; reason: string };

const orchestrator = setup({
  schemas: {
    context: types<{
      topic: string;
      workers: Record<Role, WorkerRef | null>;
      results: Partial<Record<Role, string>>;
      degraded: boolean;
    }>(),
    events: {
      workerResult: types<{ role: Role; text: string }>(),
      workerFailed: types<{ role: Role; reason: string }>()
    },
    input: types<{ topic: string }>()
  }
}).createMachine({
  context: ({ input }) => ({
    topic: input.topic,
    workers: { research: null, write: null, review: null },
    results: {},
    degraded: false
  }),
  initial: 'staffing',
  states: {
    // Spawn all three workers up front and listen to what they emit. The
    // hand-offs between them are the orchestrator's job, not theirs.
    staffing: {
      entry: ({ context }, enq) => {
        const workers = {} as Record<Role, WorkerRef>;
        for (const role of ['research', 'write', 'review'] as const) {
          const ref = enq.spawn(worker, { id: role, input: { role } });
          enq.listen<ResultEmitted, WorkerResultEvent>(
            ref,
            'result',
            (event) => ({
              type: 'workerResult',
              role: event.role,
              text: event.text
            })
          );
          enq.listen<FailedEmitted, WorkerFailedEvent>(
            ref,
            'failed',
            (event) => ({
              type: 'workerFailed',
              role: event.role,
              reason: event.reason
            })
          );
          workers[role] = ref;
        }
        enq(log, `staffed ${Object.keys(workers).join(', ')}`);
        return { context: { workers } };
      },
      always: { target: 'researching' }
    },
    researching: {
      entry: ({ context }, enq) =>
        enq.sendTo(context.workers.research!, {
          type: 'work',
          brief: `research: ${context.topic}`
        }),
      on: {
        workerResult: ({ context, event }, enq) => {
          enq(log, `research done: ${event.text}`);
          return {
            target: 'writing',
            context: { results: { ...context.results, research: event.text } }
          };
        }
      }
    },
    writing: {
      entry: ({ context }, enq) =>
        enq.sendTo(context.workers.write!, {
          type: 'work',
          brief: `draft from ${context.results.research}`
        }),
      on: {
        workerResult: ({ context, event }, enq) => {
          enq(log, `draft done: ${event.text}`);
          return {
            target: 'reviewing',
            context: { results: { ...context.results, write: event.text } }
          };
        }
      }
    },
    reviewing: {
      entry: ({ context }, enq) =>
        enq.sendTo(context.workers.review!, {
          type: 'work',
          brief: `review ${context.results.write}`
        }),
      on: {
        workerResult: ({ context, event }) => ({
          target: 'aggregating',
          context: { results: { ...context.results, review: event.text } }
        }),
        // One worker failing does not fail the run: the orchestrator ships
        // the unreviewed draft and records that the result is degraded.
        workerFailed: ({ event }, enq) => {
          enq(
            log,
            `${event.role} worker failed (${event.reason}); shipping unreviewed`
          );
          return { target: 'aggregating', context: { degraded: true } };
        }
      }
    },
    aggregating: {
      always: { target: 'delivered' }
    },
    delivered: {
      type: 'final',
      output: ({ context }) => ({
        topic: context.topic,
        degraded: context.degraded,
        results: context.results
      })
    }
  }
});

const actor = createActor(orchestrator, {
  input: { topic: 'state machines for agents' }
});

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

log(`delivered: ${JSON.stringify(await toPromise(actor), null, 2)}`);
