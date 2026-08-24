import { describe, expect, it } from 'vitest';
import {
  type AnyActorLogic,
  type AnyEventObject,
  type InputFrom,
  type SnapshotFrom,
  createMachine,
  setup
} from '../src/index.ts';

type DurableConformanceCapability =
  | 'actions'
  | 'timers'
  | 'actors'
  | 'actorCommunication'
  | 'mailbox'
  | 'errors'
  | 'output';

export type DurableConformanceOperation =
  | { type: 'action'; actionType: string }
  | { type: 'timer.schedule'; actorId: string; id: string; delay: number }
  | { type: 'timer.cancel'; actorId: string; id: string }
  | { type: 'actor.spawn'; actorId: string }
  | { type: 'actor.start'; actorId: string }
  | { type: 'actor.stop'; actorId: string }
  | { type: 'actor.terminate'; actorId: string; status: 'done' | 'error' }
  | {
      type: 'event.send';
      sourceId: string | undefined;
      targetId: string;
      eventType: string;
    };

export interface DurableConformanceExecution<
  TLogic extends AnyActorLogic = AnyActorLogic
> {
  readonly result: Promise<unknown>;
  readonly operations: readonly DurableConformanceOperation[];
  send(event: AnyEventObject): Promise<void>;
  advanceTime(ms: number): Promise<void>;
  getSnapshot(): SnapshotFrom<TLogic>;
}

export interface DurableConformanceHarness {
  start<TLogic extends AnyActorLogic>(
    logic: TLogic,
    ...[input]: undefined extends InputFrom<TLogic>
      ? [input?: InputFrom<TLogic>]
      : [input: InputFrom<TLogic>]
  ): Promise<DurableConformanceExecution<TLogic>>;
}

export interface DurableConformanceOptions {
  name: string;
  createHarness(): DurableConformanceHarness;
  capabilities: ReadonlySet<DurableConformanceCapability>;
}

const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

export function durableExecutionConformance({
  name,
  createHarness,
  capabilities
}: DurableConformanceOptions): void {
  describe(`${name} durable execution conformance`, () => {
    if (capabilities.has('actions')) {
      it('durably executes initial and transition actions', async () => {
        const calls: number[] = [];
        const machine = setup({
          actions: {
            record: (params: { value: number }) => {
              calls.push(params.value);
            }
          }
        }).createMachine({
          initial: 'active',
          entry: ({ actions }, enq) => enq(actions.record, { value: 1 }),
          states: {
            active: {
              on: {
                FINISH: ({ actions }, enq) => {
                  enq(actions.record, { value: 2 });
                  return { target: 'done' };
                }
              }
            },
            done: { type: 'final' }
          }
        });
        const execution = await createHarness().start(machine, undefined);

        await execution.send({ type: 'FINISH' });
        await execution.result;

        expect(calls).toEqual([1, 2]);
        expect(
          execution.operations.flatMap((operation) =>
            operation.type === 'action' ? [operation.actionType] : []
          )
        ).toEqual(['record', 'record']);
      });
    }

    if (capabilities.has('timers')) {
      it('delivers delayed transitions through host-managed timers', async () => {
        const machine = createMachine({
          output: 'timed out',
          initial: 'waiting',
          states: {
            waiting: { after: { 100: { target: 'done' } } },
            done: { type: 'final' }
          }
        });
        const execution = await createHarness().start(machine, undefined);

        await execution.advanceTime(99);
        expect(execution.getSnapshot().status).toBe('active');
        await execution.advanceTime(1);

        await expect(execution.result).resolves.toBe('timed out');
      });

      it('cancels and replaces delayed sends by logical timer ID', async () => {
        const machine = createMachine({
          initial: 'waiting',
          states: {
            waiting: {
              on: {
                SCHEDULE: ({ self }, enq) =>
                  enq.sendTo(
                    self,
                    { type: 'TIMEOUT' },
                    { id: 'deadline', delay: 100 }
                  ),
                CANCEL: (_, enq) => enq.cancel('deadline'),
                REPLACE: ({ self }, enq) =>
                  enq.sendTo(
                    self,
                    { type: 'TIMEOUT' },
                    { id: 'deadline', delay: 20 }
                  ),
                TIMEOUT: { target: 'done' }
              }
            },
            done: { type: 'final' }
          }
        });
        const execution = await createHarness().start(machine, undefined);

        await execution.send({ type: 'SCHEDULE' });
        await execution.send({ type: 'CANCEL' });
        await execution.advanceTime(100);
        expect(execution.getSnapshot().status).toBe('active');

        await execution.send({ type: 'SCHEDULE' });
        await execution.send({ type: 'REPLACE' });
        await execution.advanceTime(19);
        expect(execution.getSnapshot().status).toBe('active');
        await execution.advanceTime(1);
        await execution.result;

        expect(
          execution.operations.filter(({ type }) => type.startsWith('timer.'))
        ).toEqual([
          expect.objectContaining({
            type: 'timer.schedule',
            id: 'deadline',
            delay: 100
          }),
          expect.objectContaining({ type: 'timer.cancel', id: 'deadline' }),
          expect.objectContaining({
            type: 'timer.schedule',
            id: 'deadline',
            delay: 100
          }),
          expect.objectContaining({
            type: 'timer.schedule',
            id: 'deadline',
            delay: 20
          })
        ]);
      });
    }

    if (capabilities.has('actors')) {
      it('delegates spawned actor lifecycle to the host', async () => {
        const child = createMachine({});
        const machine = setup({ actors: { child } }).createMachine({
          entry: ({ actors }, enq) => {
            enq.spawn(actors.child, { id: 'worker' });
          },
          on: {
            STOP: ({ children }, enq) => enq.stop(children.worker)
          }
        });
        const execution = await createHarness().start(machine, undefined);

        await execution.send({ type: 'STOP' });

        expect(
          execution.operations
            .filter(({ type }) => type.startsWith('actor.'))
            .slice(0, 3)
        ).toEqual([
          { type: 'actor.spawn', actorId: 'worker' },
          { type: 'actor.start', actorId: 'worker' },
          { type: 'actor.stop', actorId: 'worker' }
        ]);
      });
    }

    if (capabilities.has('actorCommunication')) {
      it('routes messages between parent and child actors', async () => {
        const child = createMachine({
          on: {
            PING: ({ parent }, enq) => enq.sendTo(parent, { type: 'PONG' })
          }
        });
        const machine = setup({ actors: { child } }).createMachine({
          output: 'communicated',
          initial: 'active',
          states: {
            active: {
              invoke: { id: 'worker', src: 'child' },
              on: {
                SEND: ({ children }, enq) =>
                  enq.sendTo(children.worker, { type: 'PING' }),
                PONG: { target: 'done' }
              }
            },
            done: { type: 'final' }
          }
        });
        const execution = await createHarness().start(machine, undefined);

        await execution.send({ type: 'SEND' });

        await expect(execution.result).resolves.toBe('communicated');
        // Only the parent→child PING is a host operation. The child's PONG
        // is addressed to the root: the execution captures and retains it,
        // and the loop takes it through `waitForEvent()` — the host's own
        // sendEvent never sees it (that the result resolved proves it was
        // applied).
        expect(
          execution.operations.filter(({ type }) => type === 'event.send')
        ).toEqual([
          expect.objectContaining({
            sourceId: 'x:0',
            targetId: 'worker',
            eventType: 'PING'
          })
        ]);
      });

      it('propagates invoked child completion to its parent', async () => {
        const child = createMachine({
          initial: 'active',
          states: {
            active: { on: { FINISH: { target: 'done' } } },
            done: { type: 'final' }
          }
        });
        const machine = setup({ actors: { child } }).createMachine({
          output: 'child completed',
          initial: 'active',
          states: {
            active: {
              invoke: {
                id: 'worker',
                src: 'child',
                onDone: { target: 'done' }
              },
              on: {
                FINISH_CHILD: ({ children }, enq) =>
                  enq.sendTo(children.worker, { type: 'FINISH' })
              }
            },
            done: { type: 'final' }
          }
        });
        const execution = await createHarness().start(machine, undefined);

        await execution.send({ type: 'FINISH_CHILD' });

        await expect(execution.result).resolves.toBe('child completed');
        expect(execution.operations).toContainEqual({
          type: 'event.send',
          sourceId: 'x:0',
          targetId: 'worker',
          eventType: 'FINISH'
        });
      });
    }

    if (capabilities.has('mailbox')) {
      it('buffers events sent before the host begins waiting', async () => {
        const machine = createMachine({
          output: 'received',
          initial: 'active',
          entry: ({ self }, enq) => enq.sendTo(self, { type: 'CONTINUE' }),
          states: {
            active: { on: { CONTINUE: { target: 'done' } } },
            done: { type: 'final' }
          }
        });
        const execution = await createHarness().start(machine, undefined);

        await expect(execution.result).resolves.toBe('received');
      });
    }

    if (capabilities.has('errors')) {
      it('rejects with an unhandled machine error', async () => {
        const error = new Error('failed');
        const machine = createMachine({});
        const execution = await createHarness().start(machine, undefined);

        await execution.send({
          type: 'xstate.error.actor.worker',
          actorId: 'worker',
          error
        });

        await expect(execution.result).rejects.toBe(error);
      });
    }

    if (capabilities.has('output')) {
      it('resolves terminal machine output', async () => {
        const machine = createMachine({
          output: 42,
          initial: 'active',
          states: {
            active: { on: { FINISH: { target: 'done' } } },
            done: { type: 'final' }
          }
        });
        const execution = await createHarness().start(machine, undefined);

        await execution.send({ type: 'FINISH' });
        await flush();

        await expect(execution.result).resolves.toBe(42);
      });
    }
  });
}
