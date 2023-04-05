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
): ActorBehavior<TEvent, undefined> {
  const behavior: ActorBehavior<TEvent, undefined, CallbackInternalState> = {
    start: (_state, { self }) => {
      self.send({ type: startSignalType } as TEvent);
    },
    transition: (state, event, { self, id }) => {
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

        state.dispose = invokeCallback(sender, receiver, {
          input: state.input
        });

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

  return behavior;
}
