import { SerializationConfig, StatePath } from '@xstate/graph';
import { AnyMachineSnapshot, MachineContext } from 'xstate';
import { TestMeta, TestPathResult } from './types.ts';

interface TestResultStringOptions extends SerializationConfig<any, any> {
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
    serializeState: simpleStringify,
    serializeEvent: simpleStringify,
    ...options
  };

  const { formatColor, serializeState, serializeEvent } = resolvedOptions;

  const { state } = path;

  const targetStateString = serializeState(
    state,
    path.steps.length ? path.steps[path.steps.length - 1].event : undefined
  );

  let errMessage = '';
  let hasFailed = false;
  errMessage +=
    '\nPath:\n' +
    testPathResult.steps
      .map((s, i, steps) => {
        const stateString = serializeState(
          s.step.state,
          i > 0 ? steps[i - 1].step.event : undefined
        );
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

export function getDescription<T, TContext extends MachineContext>(
  snapshot: AnyMachineSnapshot
): string {
  const contextString = !Object.keys(snapshot.context).length
    ? ''
    : `(${JSON.stringify(snapshot.context)})`;

  const stateStrings = snapshot._nodes
    .filter((sn) => sn.type === 'atomic' || sn.type === 'final')
    .map(({ id, path }) => {
      const meta = snapshot.getMeta()[id] as TestMeta<T, TContext>;
      if (!meta) {
        return `"${path.join('.')}"`;
      }

      const { description } = meta;

      if (typeof description === 'function') {
        return description(snapshot);
      }

      return description ? `"${description}"` : JSON.stringify(snapshot.value);
    });

  return (
    `state${stateStrings.length === 1 ? '' : 's'} ` +
    stateStrings.join(', ') +
    ` ${contextString}`.trim()
  );
}
