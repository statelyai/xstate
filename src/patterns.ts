import { StateNodeConfig } from './types';

export function toggle(
  onState: string,
  offState: string,
  actionType: string
): Record<string, StateNodeConfig> {
  return {
    [onState]: {
      on: { [actionType]: offState }
    },
    [offState]: {
      on: { [actionType]: onState }
    }
  };
}
