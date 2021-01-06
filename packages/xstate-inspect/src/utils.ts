import safeStringify from 'fast-safe-stringify';
import { State, createMachine } from 'xstate';
import { MaybeLazy, ParsedReceiverEvent, ReceiverEvent } from './types';

export function getLazy<T>(value: MaybeLazy<T>): T {
  return typeof value === 'function' ? (value as () => T)() : value;
}

export function stringify(value: any): string {
  try {
    return JSON.stringify(value);
  } catch (e) {
    return safeStringify(value);
  }
}

export function isReceiverEvent(event: any): event is ReceiverEvent {
  if (!event) {
    return false;
  }

  try {
    if (
      typeof event === 'object' &&
      'type' in event &&
      (event.type as string).startsWith('service.')
    ) {
      return true;
    }
  } catch (e) {
    return false;
  }

  return false;
}

export function parseState(stateJSON: string): State<any, any> {
  const state = State.create(JSON.parse(stateJSON));

  delete state.history;

  return state;
}

export function parseReceiverEvent(event: ReceiverEvent): ParsedReceiverEvent {
  switch (event.type) {
    case 'service.event':
      return {
        ...event,
        event: JSON.parse(event.event)
      };
    case 'service.register':
      return {
        ...event,
        machine: createMachine(JSON.parse(event.machine)),
        state: parseState(event.state)
      };
    case 'service.state':
      return {
        ...event,
        state: parseState(event.state)
      };
    default:
      return event;
  }
}
