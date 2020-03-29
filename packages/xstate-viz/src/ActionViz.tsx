import * as React from 'react';
import { ActionObject } from 'xstate';
import { toDelayString } from './utils';

const BUILTIN_PREFIX = 'xstate.';

function formatAction(action: ActionObject<any, any>): JSX.Element | string {
  if (action.type === 'xstate.send') {
    if (action.event!.type.startsWith('xstate.after')) {
      return `send ${toDelayString(action.delay!)} delay`;
    }
  }
  if (action.type === 'xstate.cancel') {
    const [, delay] = action.sendId!.match(/^xstate\.after\((.*)\)#.*$/);

    return `cancel ${toDelayString(delay)} delay`;
  }
  return action.type;
}

export function ActionViz({ action }: { action: ActionObject<any, any> }) {
  return (
    <div
      data-xviz="action"
      data-xviz-builtin={action.type.startsWith(BUILTIN_PREFIX) || undefined}
      data-xviz-action-type={action.type}
      data-xviz-raw={JSON.stringify(action)}
    >
      <div data-xviz="action-type">{formatAction(action)}</div>
      <div data-xviz="action-entries">
        {Object.keys(action).map(key => {
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
