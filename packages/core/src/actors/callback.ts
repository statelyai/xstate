import {
  ActorLogic,
  EventObject,
  AnyActorSystem,
  AnyEventObject,
  ActorSystem,
  ActorRefFrom,
  TODO,
  Snapshot
} from '../types';
import { XSTATE_STOP } from '../constants.ts';

type CallbackSnapshot<TInput, TEvent> = Snapshot<undefined> & {
  input: TInput;
  _receivers: Set<(e: TEvent) => void>;
  _dispose: (() => void) | void;
};

export type CallbackActorLogic<
  TEvent extends EventObject,
  TInput = unknown
> = ActorLogic<
  CallbackSnapshot<TInput, TEvent>,
  TEvent,
  TInput,
  ActorSystem<any>
>;

export type CallbackActorRef<
  TEvent extends EventObject,
  TInput = unknown
> = ActorRefFrom<CallbackActorLogic<TEvent, TInput>>;

export type Receiver<TEvent extends EventObject> = (
  listener: {
    bivarianceHack(event: TEvent): void;
  }['bivarianceHack']
) => void;

export type InvokeCallback<
  TEvent extends EventObject = AnyEventObject,
  TSentEvent extends EventObject = AnyEventObject,
  TInput = unknown
> = ({
  input,
  system,
  self,
  sendBack,
  receive
}: {
  /**
   * Data that was provided to the parent actor
   * @see {@link https://stately.ai/docs/input} Input docs
   */
  input: TInput;
  /**
   * The actor system to which the parent actor belongs
   */
  system: AnyActorSystem;
  /**
   * The parent actor performing the callback logic
   */
  self: CallbackActorRef<TEvent>;
  /**
   * A function that can send events back to the parent actor
   */
  sendBack: (event: TSentEvent) => void;
  /**
   * A function that can be called with a listener function argument; the listener is then called whenever events are received by the parent actor
   */
  receive: Receiver<TEvent>;
}) => (() => void) | void;

/**
 * An actor logic creator which returns callback logic as defined by a callback function.
 *
 * @remarks
 * Useful for subscription-based or other free-form logic that can send events back to the parent actor.
 *
 * Actors created from callback logic (“callback actors”) can:
 * - Receive events via the `receive` function
 * - Send events to the parent actor via the `sendBack` function
 *
 * Callback actors are a bit different from other actors in that they:
 * - Do not work with `onDone` or `onError`
 * - Do not produce a snapshot using `.getSnapshot()`
 * - Do not emit values when used with `.subscribe()`
 * - Can not be stopped with `.stop()`
 *
 * @param invokeCallback - The callback function used to describe the callback logic
 * The callback function is passed an object with the following properties:
 * - `receive` - A function that can be called with a listener function argument; the listener is then called whenever events are received by the parent actor
 * - `sendBack` - A function that can send events back to the parent actor
 * - `input` - Data that was provided to the parent actor
 * - `self` - The parent actor performing the callback logic
 * - `system` - The actor system to which the parent actor belongs
 * The callback function can (optionally) return a cleanup function, which is called when the parent actor is stopped.
 * @see {@link InvokeCallback} for more information about the callback function and its object argument
 * @see {@link https://stately.ai/docs/input} Input docs for more information about how input is passed

 * @returns Callback logic
 *
 * @example
 * ```typescript
 * const callbackLogic = fromCallback(({ sendBack, receive }) => {
 *   let lockStatus = 'unlocked';
 *
 *   const handler = (event) => {
 *     if (lockStatus === 'locked') {
 *       return;
 *     }
 *     sendBack(event);
 *   };
 *
 *   receive((event) => {
 *     if (event.type === 'lock') {
 *       lockStatus = 'locked';
 *     } else if (event.type === 'unlock') {
 *       lockStatus = 'unlocked';
 *     }
 *   });
 *
 *   document.body.addEventListener('click', handler);
 *
 *   return () => {
 *     document.body.removeEventListener('click', handler);
 *   };
 * });
 * ```
 */
export function fromCallback<TEvent extends EventObject, TInput = unknown>(
  invokeCallback: InvokeCallback<TEvent, AnyEventObject, TInput>
): CallbackActorLogic<TEvent, TInput> {
  const logic: CallbackActorLogic<TEvent, TInput> = {
    config: invokeCallback,
    start: (_state, { self, system }) => {
      system._relay(self, self, { type: 'xstate.create' });
    },
    transition: (state, event, { self, system }) => {
      if (event.type === 'xstate.create') {
        const sendBack = (eventForParent: AnyEventObject) => {
          if (state.status === 'stopped') {
            return;
          }

          if (self._parent) {
            system._relay(self, self._parent, eventForParent);
          }
        };

        const receive: Receiver<TEvent> = (newListener) => {
          state._receivers.add(newListener);
        };

        state._dispose = invokeCallback({
          input: state.input,
          system,
          self: self as TODO,
          sendBack,
          receive
        });

        return state;
      }

      if (event.type === XSTATE_STOP) {
        state = {
          ...state,
          status: 'stopped',
          error: undefined
        };

        if (typeof state._dispose === 'function') {
          state._dispose();
        }
        return state;
      }

      state._receivers.forEach((receiver) => receiver(event));

      return state;
    },
    getInitialState: (_, input) => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        input,
        _receivers: new Set(),
        _dispose: undefined
      };
    },
    getPersistedState: ({ _dispose, _receivers, ...rest }) => rest,
    restoreState: (state: any) => ({
      _receivers: new Set(),
      _dispose: undefined,
      ...state
    })
  };

  return logic;
}
