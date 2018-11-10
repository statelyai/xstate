import { AtomicStateNodeConfig } from './types';

export function toggle<TEventType extends string = string>(
  onState: string,
  offState: string,
  eventType: TEventType
): Record<string, AtomicStateNodeConfig<any, { type: TEventType }>> {
  return {
    [onState]: {
      on: { [eventType]: offState }
    },
    [offState]: {
      on: { [eventType]: onState }
    }
  } as Record<string, AtomicStateNodeConfig<any, { type: TEventType }>>;
}
