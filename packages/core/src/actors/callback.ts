import {
  InvokeCallback,
  Receiver,
  ActorBehavior,
  EventObject,
  AnyEventObject
} from '../types';
import {
  toSCXMLEvent,
  isPromiseLike,
  isSCXMLEvent,
  isFunction
} from '../utils';
import { doneInvoke, error } from '../actions';
import { startSignalType, stopSignalType, isSignal } from '../actors';

export interface CallbackInternalState {
  canceled: boolean;
  receivers: Set<(e: EventObject) => void>;
  dispose: void | (() => void) | Promise<any>;
}

export function fromCallback<TEvent extends EventObject>(
  invokeCallback: InvokeCallback
): ActorBehavior<TEvent, undefined> {
  const behavior: ActorBehavior<TEvent, undefined, CallbackInternalState> = {
    start: (state, { self }) => {
      self.send({ type: startSignalType } as TEvent);

      return state;
    },
    transition: function callbackTransition(state, event, { self, id }) {
      const _event = toSCXMLEvent(event);

      if (_event.name === startSignalType) {
        const sender = (eventForParent: AnyEventObject) => {
          if (state.canceled) {
            return state;
          }

          self._parent?.send(toSCXMLEvent(eventForParent, { origin: self }));
        };

        const receiver: Receiver<TEvent> = (newListener) => {
          state.receivers.add(newListener);
        };

        state.dispose = invokeCallback(sender, receiver);

        if (isPromiseLike(state.dispose)) {
          state.dispose.then(
            (resolved) => {
              self._parent?.send(
                toSCXMLEvent(doneInvoke(id, resolved), {
                  origin: self
                })
              );

              state.canceled = true;
            },
            (errorData) => {
              const errorEvent = error(id, errorData);

              self._parent?.send(
                toSCXMLEvent(errorEvent, {
                  origin: self
                })
              );

              state.canceled = true;
            }
          );
        }
        return state;
      }

      if (_event.name === stopSignalType) {
        state.canceled = true;

        if (isFunction(state.dispose)) {
          state.dispose();
        }
        return state;
      }

      if (isSignal(_event.name)) {
        // TODO: unrecognized signal
        return state;
      }

      const plainEvent = isSCXMLEvent(event) ? event.data : event;
      if (!isSignal(plainEvent.type)) {
        state.receivers.forEach((receiver) =>
          receiver(plainEvent as EventObject)
        );
      }

      return state;
    },
    getInitialState: () => {
      return {
        canceled: false,
        receivers: new Set(),
        dispose: undefined
      };
    },
    getSnapshot: () => undefined
  };

  return behavior;
}
