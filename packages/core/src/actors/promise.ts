import {
  ActorLogic,
  ActorRefFrom,
  ActorSystem,
  AnyActorSystem,
  Snapshot
} from '../types';
import { XSTATE_STOP } from '../constants';

export type PromiseSnapshot<TOutput, TInput> = Snapshot<TOutput> & {
  input: TInput | undefined;
};

const resolveEventType = '$$xstate.resolve';
const rejectEventType = '$$xstate.reject';

export type PromiseActorEvents<T> =
  | {
      type: typeof resolveEventType;
      data: T;
    }
  | {
      type: typeof rejectEventType;
      data: any;
    }
  | {
      type: typeof XSTATE_STOP;
    };

export type PromiseActorLogic<TOutput, TInput = unknown> = ActorLogic<
  PromiseSnapshot<TOutput, TInput>,
  { type: string; [k: string]: unknown },
  TInput, // input
  PromiseSnapshot<TOutput, TInput>, // persisted state
  ActorSystem<any>
>;

export type PromiseActorRef<TOutput> = ActorRefFrom<
  PromiseActorLogic<TOutput, unknown>
>;

export function fromPromise<TOutput, TInput = unknown>(
  // TODO: add types
  promiseCreator: ({
    input,
    system
  }: {
    input: TInput;
    system: AnyActorSystem;
    self: PromiseActorRef<TOutput>;
  }) => PromiseLike<TOutput>
): PromiseActorLogic<TOutput, TInput> {
  // TODO: add event types
  const logic: PromiseActorLogic<TOutput, TInput> = {
    config: promiseCreator,
    transition: (state, event) => {
      if (state.status !== 'active') {
        return state;
      }

      switch (event.type) {
        case resolveEventType: {
          const resolvedValue = (event as any).data;
          return {
            ...state,
            status: 'done',
            output: resolvedValue,
            input: undefined
          };
        }
        case rejectEventType:
          return {
            ...state,
            status: 'error',
            error: (event as any).data,
            input: undefined
          };
        case XSTATE_STOP:
          return {
            ...state,
            status: 'stopped',
            input: undefined
          };
        default:
          return state;
      }
    },
    start: (state, { self, system }) => {
      // TODO: determine how to allow customizing this so that promises
      // can be restarted if necessary
      if (state.status !== 'active') {
        return;
      }

      const resolvedPromise = Promise.resolve(
        promiseCreator({ input: state.input!, system, self })
      );

      resolvedPromise.then(
        (response) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }
          system._relay(self, self, { type: resolveEventType, data: response });
        },
        (errorData) => {
          if (self.getSnapshot().status !== 'active') {
            return;
          }
          system._relay(self, self, { type: rejectEventType, data: errorData });
        }
      );
    },
    getInitialState: (_, input) => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        input
      };
    },
    getPersistedState: (state) => state,
    restoreState: (state) => state
  };

  return logic;
}
