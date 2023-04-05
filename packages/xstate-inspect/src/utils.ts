import safeStringify from 'fast-safe-stringify';
import { createMachine, StateConfig } from 'xstate';
import { ParsedReceiverEvent, ReceiverEvent } from './types.ts';

export function getLazy<T>(value: T): T extends () => infer R ? R : T {
  return typeof value === 'function' ? value() : value;
}

export function stringify(
  value: any,
  replacer?: (key: string, value: any) => any
): string {
  try {
    return JSON.stringify(value, replacer);
  } catch (e) {
    return safeStringify(value, replacer);
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

export function parseState(stateJSON: string): StateConfig<any, any> {
  const state = JSON.parse(stateJSON);

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
