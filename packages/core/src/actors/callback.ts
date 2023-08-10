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

export interface CallbackInternalState<
  TEvent extends EventObject,
  TInput = unknown
> {
  canceled: boolean;
  receivers: Set<(e: TEvent) => void>;
  dispose: void | (() => void) | Promise<any>;
  input: TInput;
}

export type CallbackActorLogic<
  TEvent extends EventObject,
  TInput = unknown
> = ActorLogic<
  TEvent,
  undefined,
  CallbackInternalState<TEvent, TInput>,
  Pick<CallbackInternalState<TEvent, TInput>, 'input' | 'canceled'>,
  ActorSystem<any>,
  TInput,
  any
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
  input: TInput;
  system: AnyActorSystem;
  self: CallbackActorRef<TEvent>;
  sendBack: (event: TSentEvent) => void;
  receive: Receiver<TEvent>;
}) => (() => void) | Promise<any> | void;

export function fromCallback<TEvent extends EventObject, TInput>(
  invokeCallback: InvokeCallback<TEvent, AnyEventObject, TInput>
): CallbackActorLogic<TEvent, TInput> {
  return {
    config: invokeCallback,
    start: (_state, { self }) => {
      self.send({ type: startSignalType } as TEvent);
    },
    transition: (state, event, { self, id, system }) => {
      if (event.type === startSignalType) {
        const sendBack = (eventForParent: AnyEventObject) => {
          if (state.canceled) {
            return;
          }

          self._parent?.send(eventForParent);
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
    getPersistedState: ({ input, canceled }) => ({ input, canceled })
  };
}
