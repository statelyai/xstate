import {
  InvokeCallback,
  Receiver,
  ActorLogic,
  EventObject,
  AnyEventObject
} from '../types';
import { isPromiseLike, isFunction } from '../utils';
import { doneInvoke, error } from '../actions.ts';
import { startSignalType, stopSignalType, isSignal } from '../actors/index.ts';

export interface CallbackInternalState {
  canceled: boolean;
  receivers: Set<(e: EventObject) => void>;
  dispose: void | (() => void) | Promise<any>;
  input?: any;
}

export function fromCallback<TEvent extends EventObject>(
  invokeCallback: InvokeCallback
): ActorLogic<TEvent, undefined, CallbackInternalState> {
  const logic: ActorLogic<TEvent, undefined, CallbackInternalState> = {
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
          system
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

        if (isFunction(state.dispose)) {
          state.dispose();
        }
        return state;
      }

      if (isSignal(event.type)) {
        // TODO: unrecognized signal
        return state;
      }

      if (!isSignal(event.type)) {
        state.receivers.forEach((receiver) => receiver(event));
      }

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
