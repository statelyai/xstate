import type { ActorRef, Interpreter } from 'xstate';
import { XStateDevInterface } from 'xstate/lib/devTools';
import { InspectMachineEvent } from './inspectMachine';

export type MaybeLazy<T> = T | (() => T);

export type ServiceListener = (service: Interpreter<any>) => void;

export interface InspectorOptions {
  url: string;
  iframe: MaybeLazy<HTMLIFrameElement | null | false>;
  devTools: MaybeLazy<XStateDevInterface>;
}

export interface Inspector extends ActorRef<InspectMachineEvent> {
  /**
   * Disconnects the inspector.
   */
  disconnect: () => void;
}
