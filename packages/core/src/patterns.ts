import {
  AtomicStateNodeConfig,
  StatesConfig,
  EventObject,
  StateNodeConfig
} from './types';

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

interface SequencePatternOptions<TEvent extends EventObject> {
  nextEvent: TEvent | undefined;
  prevEvent: TEvent | undefined;
}

const defaultSequencePatternOptions = {
  nextEvent: { type: 'NEXT' },
  prevEvent: { type: 'PREV' }
};

export function sequence<TEvent extends EventObject>(
  items: string[],
  options?: Partial<SequencePatternOptions<TEvent>>
): {
  initial: string;
  states: StatesConfig<any, TEvent>;
} {
  const resolvedOptions = { ...defaultSequencePatternOptions, ...options };
  const states = {} as Record<string, any>;
  const nextEventObject =
    resolvedOptions.nextEvent === undefined
      ? undefined
      : resolvedOptions.nextEvent;
  const prevEventObject =
    resolvedOptions.prevEvent === undefined
      ? undefined
      : resolvedOptions.prevEvent;

  items.forEach((item, i) => {
    const state: StateNodeConfig<TEvent, TEvent> = {
      on: {}
    };

    if (i + 1 === items.length) {
      state.type = 'final';
    }

    if (nextEventObject && i + 1 < items.length) {
      state.on![nextEventObject.type] = items[i + 1];
    }

    if (prevEventObject && i > 0) {
      state.on![prevEventObject.type] = items[i - 1];
    }

    states[item] = state;
  });

  return {
    initial: items[0] as string,
    states: states as StatesConfig<any, TEvent>
  };
}
