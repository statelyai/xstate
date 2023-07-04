import {
  InvokeCallback,
  Receiver,
  ActorLogic,
  EventObject,
  AnyEventObject,
  ActorRefFrom,
  TODO
} from '../types';
import { isPromiseLike, isFunction } from '../utils';
import { doneInvoke, error } from '../actions.ts';
import { startSignalType, stopSignalType, isSignal } from '../actors/index.ts';

export interface CallbackInternalState<TEvent extends EventObject> {
  canceled: boolean;
  receivers: Set<(e: TEvent) => void>;
  dispose: void | (() => void) | Promise<any>;
  input?: any;
}

export type CallbackActorLogic<TEvent extends EventObject> = ActorLogic<
  TEvent,
  undefined,
  CallbackInternalState<TEvent>
>;

export type CallbackActorRef<TEvent extends EventObject> = ActorRefFrom<
  CallbackActorLogic<TEvent>
>;

export function fromCallback<TEvent extends EventObject>(
  invokeCallback: InvokeCallback
): CallbackActorLogic<TEvent> {
  const logic: CallbackActorLogic<TEvent> = {
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

        if (isFunction(state.dispose)) {
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
