import {
  InvokeCallback,
  Receiver,
  ActorLogic,
  EventObject,
  AnyEventObject,
  ActorSystem,
  ActorRefFrom,
  TODO
} from '../types';
import { isPromiseLike } from '../utils';
import { doneInvoke, error } from '../actions.ts';
import { startSignalType, stopSignalType, isSignal } from '../actors/index.ts';

export interface CallbackInternalState<TEvent extends EventObject> {
  canceled: boolean;
  receivers: Set<(e: TEvent) => void>;
  dispose: void | (() => void) | Promise<any>;
  input?: any;
}

export type CallbackActorLogic<
  TEvent extends EventObject,
  TInput = any
> = ActorLogic<
  TEvent,
  undefined,
  CallbackInternalState<TEvent>,
  CallbackInternalState<TEvent>,
  ActorSystem<any>,
  TInput,
  any
>;

export type CallbackActorRef<TEvent extends EventObject> = ActorRefFrom<
  CallbackActorLogic<TEvent>
>;

export function fromCallback<TEvent extends EventObject, TInput>(
  invokeCallback: InvokeCallback<TEvent, AnyEventObject, TInput>
): CallbackActorLogic<TEvent, TInput> {
  const logic: CallbackActorLogic<TEvent, TInput> = {
    config: invokeCallback,
    start: (_state, { self }) => {
      self.send({ type: startSignalType } as TEvent);
    },
    transition: (state, event, { self, id, system }) => {
      if (event.type === startSignalType) {
        const sender = (eventForParent: AnyEventObject) => {
          if (state.canceled) {
            return;
          }

          self._parent?.send(eventForParent);
        };

        const receiver: Receiver<TEvent> = (newListener) => {
          state.receivers.add(newListener);
        };

        state.dispose = invokeCallback(sender, receiver, {
          input: state.input,
          system,
          self: self as TODO
        });

        if (isPromiseLike(state.dispose)) {
          state.dispose.then(
            (resolved) => {
              self._parent?.send(doneInvoke(id, resolved));
              state.canceled = true;
            },
            (errorData) => {
              state.canceled = true;
              self._parent?.send(error(id, errorData));
            }
          );
        }
        return state;
      }

      if (event.type === stopSignalType) {
        state.canceled = true;

        if (typeof state.dispose === 'function') {
          state.dispose();
        }
        return state;
      }

      if (isSignal(event)) {
        // TODO: unrecognized signal
        return state;
      }

      state.receivers.forEach((receiver) => receiver(event));

      return state;
    },
    getInitialState: (_, input) => {
      return {
        canceled: false,
        receivers: new Set(),
        dispose: undefined,
        input
      };
    },
    getSnapshot: () => undefined,
    getPersistedState: ({ input }) => input
  };

  return logic;
}
