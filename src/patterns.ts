import { SimpleStateNodeConfig } from './types';

export function toggle(
  onState: string,
  offState: string,
  eventType: string
): Record<string, SimpleStateNodeConfig<any>> {
  return {
    [onState]: {
      on: { [eventType]: offState }
    },
    [offState]: {
      on: { [eventType]: onState }
    }
  };
}
