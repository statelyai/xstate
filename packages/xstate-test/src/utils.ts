import {
  SerializationOptions,
  SerializedEvent,
  SerializedState,
  StatePath,
  StatePlan
} from '@xstate/graph';
import { AnyState, EventObject } from 'xstate';
import { TestMeta, TestPathResult } from './types';

interface TestResultStringOptions extends SerializationOptions<any, any> {
  formatColor: (color: string, string: string) => string;
}

export function simpleStringify(value: any): string {
  return JSON.stringify(value);
}

export function formatPathTestResult(
  path: StatePath<any, any>,
  testPathResult: TestPathResult,
  options?: Partial<TestResultStringOptions>
): string {
  const resolvedOptions: TestResultStringOptions = {
    formatColor: (_color, string) => string,
    serializeState: (state, _event) =>
      simpleStringify(state) as SerializedState,
    serializeEvent: (event) => simpleStringify(event) as SerializedEvent,
    eventCases: {},
    ...options
  };

  const { formatColor, serializeState, serializeEvent } = resolvedOptions;

  const { state } = path;
  const targetStateString = serializeState(state, null);

  let errMessage = '';
  let hasFailed = false;
  errMessage +=
    '\nPath:\n' +
    testPathResult.steps
      .map((s) => {
        const stateString = serializeState(s.step.state, s.step.event);
        const eventString = serializeEvent(s.step.event);

        const stateResult = `\tState: ${
          hasFailed
            ? formatColor('gray', stateString)
            : s.state.error
            ? ((hasFailed = true), formatColor('redBright', stateString))
            : formatColor('greenBright', stateString)
        }`;
        const eventResult = `\tEvent: ${
          hasFailed
            ? formatColor('gray', eventString)
            : s.event.error
            ? ((hasFailed = true), formatColor('red', eventString))
            : formatColor('green', eventString)
        }`;

        return [stateResult, eventResult].join('\n');
      })
      .concat(
        `\tState: ${
          hasFailed
            ? formatColor('gray', targetStateString)
            : testPathResult.state.error
            ? formatColor('red', targetStateString)
            : formatColor('green', targetStateString)
        }`
      )
      .join('\n\n');

  return errMessage;
}

export function getDescription<T, TContext>(state: AnyState): string {
  const contextString =
    state.context === undefined ? '' : `(${JSON.stringify(state.context)})`;
  const jestConsoleMessage = state.transitions[0].description
    ? `"${state.transitions[0].description}"`
    : '';

  const stateStrings = state.configuration
    .filter((sn) => sn.type === 'atomic' || sn.type === 'final')
    .map(({ id, path }) => {
      const meta = state.meta[id] as TestMeta<T, TContext>;
      if (!meta) {
        return `"${path.join('.')}"`;
      }

      const { description } = meta;

      if (typeof description === 'function') {
        return description(state);
      }

      return description ? `"${description}"` : JSON.stringify(state.value);
    });

  return (
    `state${stateStrings.length === 1 ? '' : 's'} ` +
    stateStrings.join(', ') +
    ` ${jestConsoleMessage} ${contextString}`
  ).trim();
}

export function flatten<T>(array: Array<T | T[]>): T[] {
  return ([] as T[]).concat(...array);
}

export const mapPlansToPaths = <TState, TEvent extends EventObject>(
  plans: StatePlan<TState, TEvent>[]
): Array<StatePath<TState, TEvent>> => {
  return plans.reduce((acc, plan) => {
    return acc.concat(plan.paths);
  }, [] as Array<StatePath<TState, TEvent>>);
};
