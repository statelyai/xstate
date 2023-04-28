import type {
  ActorRef,
  AnyInterpreter,
  AnyState,
  AnyStateMachine,
  StateConfig
} from 'xstate';
import { XStateDevInterface } from 'xstate/dev';
import { InspectMachineEvent } from './inspectMachine.ts';

export type MaybeLazy<T> = T | (() => T);

export type ServiceListener = (service: AnyInterpreter) => void;

export type Replacer = (key: string, value: any) => any;

export interface InspectorOptions {
  url?: string;
  iframe?: MaybeLazy<HTMLIFrameElement | null | false>;
  devTools?: MaybeLazy<XStateDevInterface>;
  serialize?: Replacer | undefined;
  targetWindow?: Window | undefined | null;
}

export interface Inspector extends ActorRef<InspectMachineEvent, AnyState> {
  /**
   * Disconnects the inspector.
   */
  disconnect: () => void;
}

/**
 * Events that the receiver sends to the inspector
 */
export type ReceiverCommand =
  | { type: 'xstate.event'; event: string; service: string }
  | { type: 'xstate.inspecting' };

/**
 * Events that the receiver receives from the inspector
 */
export type ReceiverEvent =
  | {
      type: 'service.register';
      machine: string;
      state: string;
      id: string;
      sessionId: string;
      parent?: string;
      source?: string;
    }
  | { type: 'service.stop'; sessionId: string }
  | {
      type: 'service.state';
      state: string;
      sessionId: string;
    }
  | { type: 'service.event'; event: string; sessionId: string };

export type ParsedReceiverEvent =
  | {
      type: 'service.register';
      machine: AnyStateMachine;
      state: StateConfig<any, any>;
      id: string;
      sessionId: string;
      parent?: string;
      source?: string;
    }
  | { type: 'service.stop'; sessionId: string }
  | {
      type: 'service.state';
      state: StateConfig<any, any>;
      sessionId: string;
    }
  | { type: 'service.event'; event: string; sessionId: string };

export type InspectReceiver = ActorRef<ReceiverCommand, ParsedReceiverEvent>;

export interface WindowReceiverOptions {
  window: Window;
  targetWindow: Window;
}

export interface WebSocketReceiverOptions {
  server: string;
  protocol?: 'ws' | 'wss';
  serialize: Replacer | undefined;
}
