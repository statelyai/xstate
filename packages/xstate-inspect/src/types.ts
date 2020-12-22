import type { Interpreter } from 'xstate';
import { XStateDevInterface } from 'xstate/lib/devTools';

export type MaybeLazy<T> = T | (() => T);

export type ServiceListener = (service: Interpreter<any>) => void;

export interface InspectorOptions {
  url: string;
  iframe: MaybeLazy<HTMLIFrameElement | null | false>;
  devTools: MaybeLazy<XStateDevInterface>;
}
