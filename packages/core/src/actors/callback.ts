import {
  ActorLogic,
  EventObject,
  AnyActorSystem,
  AnyEventObject,
  ActorSystem,
  ActorRefFrom,
  Snapshot,
  AnyActorRef,
  NonReducibleUnknown
} from '../types';
import { XSTATE_STOP } from '../constants.ts';

interface CallbackInstanceState<TEvent extends EventObject> {
  receivers: Set<(e: TEvent) => void> | undefined;
  dispose: (() => void) | void;
}

const instanceStates = /* #__PURE__ */ new WeakMap<
  AnyActorRef,
  CallbackInstanceState<any>
>();

export type CallbackSnapshot<TInput> = Snapshot<undefined> & {
  input: TInput;
};

export type CallbackActorLogic<
  TEvent extends EventObject,
  TInput = NonReducibleUnknown
> = ActorLogic<CallbackSnapshot<TInput>, TEvent, TInput, ActorSystem<any>>;

export type CallbackActorRef<
  TEvent extends EventObject,
  TInput = NonReducibleUnknown
> = ActorRefFrom<CallbackActorLogic<TEvent, TInput>>;

export type Receiver<TEvent extends EventObject> = (
  listener: {
    bivarianceHack(event: TEvent): void;
  }['bivarianceHack']
) => void;

export type InvokeCallback<
  TEvent extends EventObject = AnyEventObject,
  TSentEvent extends EventObject = AnyEventObject,
  TInput = NonReducibleUnknown
> = ({
  input,
  system,
  self,
  sendBack,
  receive
}: {
  /**
   * Data that was provided to the callback actor
   * @see {@link https://stately.ai/docs/input | Input docs}
   */
  input: TInput;
  /**
   * The actor system to which the callback actor belongs
   */
  system: AnyActorSystem;
  /**
   * The parent actor of the callback actor
   */
  self: CallbackActorRef<TEvent>;
  /**
   * A function that can send events back to the parent actor
   */
  sendBack: (event: TSentEvent) => void;
  /**
   * A function that can be called with a listener function argument;
   * the listener is then called whenever events are received by the callback actor
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
 * - Do not work with `onDone`
 * - Do not produce a snapshot using `.getSnapshot()`
 * - Do not emit values when used with `.subscribe()`
 * - Can not be stopped with `.stop()`
 *
 * @param invokeCallback - The callback function used to describe the callback logic
 * The callback function is passed an object with the following properties:
 * - `receive` - A function that can send events back to the parent actor; the listener is then called whenever events are received by the callback actor
 * - `sendBack` - A function that can send events back to the parent actor
 * - `input` - Data that was provided to the callback actor
 * - `self` - The parent actor of the callback actor
 * - `system` - The actor system to which the callback actor belongs
 * The callback function can (optionally) return a cleanup function, which is called when the actor is stopped.
 * @see {@link InvokeCallback} for more information about the callback function and its object argument
 * @see {@link https://stately.ai/docs/input | Input docs} for more information about how input is passed

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
export function fromCallback<
  TEvent extends EventObject,
  TInput = NonReducibleUnknown
>(
  invokeCallback: InvokeCallback<TEvent, AnyEventObject, TInput>
): CallbackActorLogic<TEvent, TInput> {
  const logic: CallbackActorLogic<TEvent, TInput> = {
    config: invokeCallback,
    start: (state, actorScope) => {
      const { self, system } = actorScope;

      const callbackState: CallbackInstanceState<TEvent> = {
        receivers: undefined,
        dispose: undefined
      };

      instanceStates.set(self, callbackState);

      callbackState.dispose = invokeCallback({
        input: state.input,
        system,
        self,
        sendBack: (event) => {
          if (self.getSnapshot().status === 'stopped') {
            return;
          }
          if (self._parent) {
            system._relay(self, self._parent, event);
          }
        },
        receive: (listener) => {
          callbackState.receivers ??= new Set();
          callbackState.receivers.add(listener);
        }
      });
    },
    transition: (state, event, actorScope) => {
      const callbackState: CallbackInstanceState<TEvent> = instanceStates.get(
        actorScope.self
      )!;

      if (event.type === XSTATE_STOP) {
        state = {
          ...state,
          status: 'stopped',
          error: undefined
        };

        callbackState.dispose?.();
        return state;
      }

      callbackState.receivers?.forEach((receiver) => receiver(event));

      return state;
    },
    getInitialState: (_, input) => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        input
      };
    },
    getPersistedSnapshot: (snapshot) => snapshot,
    restoreSnapshot: (snapshot: any) => snapshot
  };

  return logic;
}
