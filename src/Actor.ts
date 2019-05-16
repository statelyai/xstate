import { EventObject, Subscribable } from './types';

export interface Actor<
  TContext = any,
  TEvent extends EventObject = EventObject
> extends Subscribable<TContext> {
  id: string;
  send: (event: TEvent) => any; // TODO: change to void
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
