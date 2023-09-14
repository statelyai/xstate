import {
  ActorLogic,
  EventObject,
  AnyActorSystem,
  AnyEventObject,
  ActorSystem,
  ActorRefFrom,
  TODO
} from '../types';
import { XSTATE_INIT, XSTATE_STOP } from '../constants.ts';

export interface CallbackInternalState<
  TEvent extends EventObject,
  TInput = unknown
> {
  canceled: boolean;
  receivers: Set<(e: TEvent) => void>;
  dispose: (() => void) | void;
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
}) => (() => void) | void;

export function fromCallback<TEvent extends EventObject, TInput>(
  invokeCallback: InvokeCallback<TEvent, AnyEventObject, TInput>
): CallbackActorLogic<TEvent, TInput> {
  const logic: CallbackActorLogic<TEvent, TInput> = {
    config: invokeCallback,
    start: (_state, { self, system }) => {
      system.sendTo(self, { type: XSTATE_INIT }, self);
    },
    transition: (state, event, { self, system }) => {
      if (event.type === XSTATE_INIT) {
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

        return state;
      }

      if (event.type === XSTATE_STOP) {
        state.canceled = true;

        if (typeof state.dispose === 'function') {
          state.dispose();
        }
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

  return logic;
}
