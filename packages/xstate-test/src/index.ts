import { EventObject } from 'xstate';
import { TestEventsConfig } from './types';

export { createTestModel } from './machine';

export function getEventSamples<TEvent extends EventObject>(
  eventsOptions: TestEventsConfig<any>
): TEvent[] {
  const result: TEvent[] = [];

  Object.keys(eventsOptions).forEach((key) => {
    const eventConfig = eventsOptions[key];
    if (typeof eventConfig === 'function') {
      result.push({
        type: key
      } as any);
      return;
    }

    const events = eventConfig.cases
      ? eventConfig.cases.map((sample) => ({
          type: key,
          ...sample
        }))
      : [
          {
            type: key
          }
        ];

    result.push(...(events as any[]));
  });

  return result;
}

export function flatten<T>(array: Array<T | T[]>): T[] {
  return ([] as T[]).concat(...array);
}
