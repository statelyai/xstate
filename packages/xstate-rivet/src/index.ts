import type { AnyActorLogic, EventFromLogic } from 'xstate';
import {
  createDurable as createCoreDurable,
  type DurableExecution,
  type DurableExecutionAdapter
} from 'xstate/durable';

export type { WorkflowContextOf as RivetWorkflowContextOf } from 'rivetkit/workflow';

export interface RivetDurableWorkflowContext {
  step<T>(name: string, run: (context: any) => Promise<T>): Promise<T>;
  queue: {
    next(name: string): Promise<unknown>;
  };
}

export interface RivetDurableOptions<TLogic extends AnyActorLogic> {
  /** Context from a Rivet `workflow()` run handler. */
  context: RivetDurableWorkflowContext;
  /** Queue name used as the XState actor inbox. */
  queue: string;
  /** Extracts the XState event. Defaults to `message.body.event`. */
  getEvent?: (message: unknown) => EventFromLogic<TLogic>;
  /**
   * Maps timers, sends and actor lifecycle effects to Rivet operations.
   * Missing operations fail when XState attempts to execute them.
   */
  runtime?: DurableExecutionAdapter<TLogic>['runtime'];
  /** Index assigned to the first transition. Defaults to `0`. */
  transitionIndex?: number;
}

function defaultGetEvent<TLogic extends AnyActorLogic>(
  message: unknown
): EventFromLogic<TLogic> {
  return (message as { body: { event: EventFromLogic<TLogic> } }).body.event;
}

/** Creates an XState durable adapter for one Rivet actor workflow. */
export function createRivetAdapter<TLogic extends AnyActorLogic>(
  options: RivetDurableOptions<TLogic>
): DurableExecutionAdapter<TLogic> {
  const getEvent = options.getEvent ?? defaultGetEvent<TLogic>;

  return {
    transitionIndex: options.transitionIndex,
    executeAction: (action, metadata) =>
      options.context.step(metadata.id, async () => {
        await action.exec();
      }),
    runtime(metadata, effect) {
      const runtime = options.runtime?.(metadata, effect) ?? {};
      if (
        effect.type !== '@xstate.terminate' ||
        runtime.terminateActor !== undefined
      ) {
        return runtime;
      }
      return {
        ...runtime,
        async terminateActor(actor) {
          if (actor._parent) {
            throw new TypeError(
              'The Rivet adapter requires a terminateActor mapping for child actors'
            );
          }
          await options.context.step(metadata.id, async () => {});
        }
      };
    },
    async waitForEvent() {
      return getEvent(await options.context.queue.next(options.queue));
    }
  };
}

/** Creates a durable execution backed by the current Rivet actor workflow. */
export function createRivetDurable<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: RivetDurableOptions<TLogic>
): DurableExecution<TLogic> {
  return createCoreDurable(logic, createRivetAdapter(options));
}

export { createRivetDurable as createDurable };
