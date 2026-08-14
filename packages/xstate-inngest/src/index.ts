import type { GetStepTools, Inngest } from 'inngest';
import type { AnyActorLogic, EventFromLogic } from 'xstate';
import {
  createDurable as createCoreDurable,
  type DurableExecution,
  type DurableExecutionAdapter
} from 'xstate/durable';

type InngestStepTools = Pick<GetStepTools<Inngest.Any>, 'run' | 'waitForEvent'>;

type WaitForEventOptions = Parameters<InngestStepTools['waitForEvent']>[1];

export class InngestEventWaitTimeoutError extends Error {
  constructor(readonly stepId: string) {
    super(`Timed out waiting for an XState event in step "${stepId}"`);
    this.name = 'InngestEventWaitTimeoutError';
  }
}

interface InngestDurableBaseOptions<TLogic extends AnyActorLogic> {
  /** Step tools from the current Inngest function invocation. */
  step: InngestStepTools;
  /** Inngest event name carrying events addressed to this execution. */
  event: WaitForEventOptions['event'];
  /** Maximum duration of each durable event wait. */
  timeout: WaitForEventOptions['timeout'];
  /** Extracts the XState event. Defaults to `received.data.event`. */
  getEvent?: (received: unknown) => EventFromLogic<TLogic>;
  /**
   * Maps timers, sends and actor lifecycle effects to host operations.
   * Missing operations fail when XState attempts to execute them.
   */
  runtime?: DurableExecutionAdapter<TLogic>['runtime'];
  /** Index assigned to the next transition. Defaults to `0`. */
  nextTransitionIndex?: number;
}

export type InngestDurableOptions<TLogic extends AnyActorLogic> =
  InngestDurableBaseOptions<TLogic> &
    (
      | {
          /** Inngest expression correlating an event with this execution. */
          if?: string;
          match?: never;
        }
      | {
          if?: never;
          /** Inngest field path correlating trigger and received events. */
          match?: string;
        }
    );

function defaultGetEvent<TLogic extends AnyActorLogic>(
  received: unknown
): EventFromLogic<TLogic> {
  return (received as { data: { event: EventFromLogic<TLogic> } }).data.event;
}

/** Creates an XState durable adapter for one Inngest function invocation. */
export function createInngestAdapter<TLogic extends AnyActorLogic>(
  options: InngestDurableOptions<TLogic>
): DurableExecutionAdapter<TLogic> {
  const getEvent = options.getEvent ?? defaultGetEvent<TLogic>;

  return {
    nextTransitionIndex: options.nextTransitionIndex,
    async executeAction(action, metadata, runtime) {
      await options.step.run(metadata.id, async () => {
        await action.exec(runtime);
      });
    },
    runtime(metadata, effect) {
      const runtime = options.runtime?.(metadata, effect) ?? {};
      if (
        effect.kind !== 'builtin' ||
        effect.type !== '@xstate.terminate' ||
        runtime.terminateActor !== undefined
      ) {
        return runtime;
      }
      return {
        ...runtime,
        async terminateActor() {
          if (!effect.isRoot) {
            throw new TypeError(
              'The Inngest adapter requires a terminateActor mapping for child actors'
            );
          }
          // Record root completion under its stable effect ID. Child
          // completion needs an application mapping that notifies the parent.
          await options.step.run(metadata.id, async () => {});
        }
      };
    },
    async waitForEvent(metadata) {
      const correlation = options.match
        ? { match: options.match }
        : options.if
          ? { if: options.if }
          : {};
      const received = await options.step.waitForEvent(metadata.id, {
        event: options.event,
        timeout: options.timeout,
        ...correlation
      });

      if (received === null) {
        throw new InngestEventWaitTimeoutError(metadata.id);
      }
      return getEvent(received);
    }
  };
}

/** Creates a durable execution backed by the current Inngest invocation. */
export function createInngestDurable<TLogic extends AnyActorLogic>(
  logic: TLogic,
  options: InngestDurableOptions<TLogic>
): DurableExecution<TLogic> {
  return createCoreDurable(logic, createInngestAdapter(options));
}

export { createInngestDurable as createDurable };
