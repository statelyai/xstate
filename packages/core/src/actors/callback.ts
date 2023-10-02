import {
  ActorLogic,
  EventObject,
  AnyActorSystem,
  AnyEventObject,
  ActorSystem,
  ActorRefFrom,
  TODO,
  Snapshot,
  HomomorphicOmit
} from '../types';
import { XSTATE_INIT, XSTATE_STOP } from '../constants.ts';

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
  HomomorphicOmit<CallbackSnapshot<TInput, TEvent>, '_receivers' | '_dispose'>,
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
  input: TInput;
  system: AnyActorSystem;
  self: CallbackActorRef<TEvent>;
  sendBack: (event: TSentEvent) => void;
  receive: Receiver<TEvent>;
}) => (() => void) | void;

export function fromCallback<TEvent extends EventObject, TInput = unknown>(
  invokeCallback: InvokeCallback<TEvent, AnyEventObject, TInput>
): CallbackActorLogic<TEvent, TInput> {
  const logic: CallbackActorLogic<TEvent, TInput> = {
    config: invokeCallback,
    start: (_state, { self, system }) => {
      system.relay({ type: XSTATE_INIT }, self, self);
    },
    transition: (state, event, { self, system }) => {
      if (event.type === XSTATE_INIT) {
        const sendBack = (eventForParent: AnyEventObject) => {
          if (state.status === 'stopped') {
            return;
          }

          system.relay(eventForParent, self, self._parent);
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
    restoreState: (state) => ({
      _receivers: new Set(),
      _dispose: undefined,
      ...state
    })
  };

  return logic;
}
