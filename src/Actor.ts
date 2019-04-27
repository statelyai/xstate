import { EventObject } from './types';

export interface Actor<TEvent extends EventObject = EventObject> {
  id: string;
  send: (event: TEvent) => void;
  stop?: () => any | undefined;
  toJSON: () => {
    id: string;
  };
}
