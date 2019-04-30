import { EventObject } from './types';

export interface Actor<TEvent extends EventObject = EventObject> {
  id: string;
  send: (event: TEvent) => void;
  stop?: () => any | undefined;
  toJSON: () => {
    id: string;
  };
}

export function isActor(item: any): item is Actor {
  try {
    return typeof item.send === 'function';
  } catch (e) {
    return false;
  }
}
