import * as React from 'react';
import { ActionObject, SpecialTargets } from 'xstate';
import { toDelayString } from './utils';

const BUILTIN_PREFIX = 'xstate.';

function formatAction(action: ActionObject<any, any>): JSX.Element | string {
  if (action.type === 'xstate.send') {
    if (action.event!.type.startsWith('xstate.after')) {
      return `send ${toDelayString(action.delay!)} delay`;
    }

    const target =
      action.to === SpecialTargets.Parent ? <em>parent</em> : action.to;
    const eventType = action.event.type;

    return (
      <>
        send <strong>{eventType}</strong> to {target}
      </>
    );
  }
  if (action.type === 'xstate.cancel') {
    const [, delay] = action.sendId!.match(/^xstate\.after\((.*)\)#.*$/);

    return `cancel ${toDelayString(delay)} delay`;
  }

  if (action.type.startsWith('function () {')) {
    return <em>anonymous</em>;
  }

  return action.type;
}

export function ActionViz({ action }: { action: ActionObject<any, any> }) {
  const resolvedActionType = action.type.startsWith('function () {')
    ? 'xstate.anonymous'
    : action.type;

  return (
    <div
      data-xviz="action"
      data-xviz-builtin={action.type.startsWith(BUILTIN_PREFIX) || undefined}
      data-xviz-action-type={resolvedActionType}
      data-xviz-raw={JSON.stringify(action)}
    >
      <div data-xviz="action-type">{formatAction(action)}</div>
      <div data-xviz="action-entries">
        {Object.keys(action).map((key) => {
          if (key === 'type') {
            return null;
          }
          const value = action[key];

          return (
            <div
              data-xviz="action-entry"
              data-xviz-entry-type={typeof value}
              key={key}
            >
              <div
                title={key}
                data-xviz="action-key"
                data-xviz-action-key={key}
              >
                {key}
              </div>
              <div data-xviz="action-value">{JSON.stringify(value)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
