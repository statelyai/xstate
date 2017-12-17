import { StateNodeConfig } from './types';

export function toggle(
  onState: string,
  offState: string,
  eventType: string
): Record<string, StateNodeConfig> {
  return {
    [onState]: {
      on: { [eventType]: offState }
    },
    [offState]: {
      on: { [eventType]: onState }
    }
  };
}
