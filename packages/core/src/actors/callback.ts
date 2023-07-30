import {
  ActorLogic,
  EventObject,
  AnyActorSystem,
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
  input: TInput;
  system: AnyActorSystem;
  self: CallbackActorRef<TEvent>;
  sendBack: (event: TSentEvent) => void;
  receive: Receiver<TEvent>;
}) => (() => void) | Promise<any> | void;

export function fromCallback<TEvent extends EventObject, TInput>(
  invokeCallback: InvokeCallback<TEvent, AnyEventObject, TInput>
): CallbackActorLogic<TEvent, TInput> {
  const logic: CallbackActorLogic<TEvent, TInput> = {
    name: 'callback',
    config: invokeCallback,
    start: (_state, { self, system }) => {
      system.sendTo(self, { type: startSignalType }, self);
    },
    transition: (state, event, { self, id, system }) => {
      if (event.type === startSignalType) {
        const sendBack = (eventForParent: AnyEventObject) => {
          if (state.canceled) {
            return;
          }

          system.sendTo(self._parent, eventForParent, self);
        };

        const receive: Receiver<TEvent> = (newListener) => {
          state.receivers.add(newListener);
        };

        state.dispose = invokeCallback({
          input: state.input,
          system,
          self: self as TODO,
          sendBack,
          receive
        });

        if (isPromiseLike(state.dispose)) {
          state.dispose.then(
            (resolved) => {
              system.sendTo(self._parent, doneInvoke(id, resolved), self);
              state.canceled = true;
            },
            (errorData) => {
              state.canceled = true;
              system.sendTo(self._parent, error(id, errorData), self);
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
