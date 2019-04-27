import { EventObject } from './types';
import { toEventObject } from './actions';

export class Actor {
  constructor(public id: string) {}
  public send(event: string | EventObject) {
    const eventObject = toEventObject(event);
    console.log(eventObject);
  }
}
