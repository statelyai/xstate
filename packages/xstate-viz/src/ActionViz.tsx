import * as React from 'react';
import { ActionObject } from 'xstate';

const BUILTIN_PREFIX = 'xstate.';

export function ActionViz({ action }: { action: ActionObject<any, any> }) {
  return (
    <div
      data-xviz-element="action"
      data-xviz-action-type={action.type}
      data-xviz-action-builtin={
        action.type.startsWith(BUILTIN_PREFIX) || undefined
      }
    >
      <div data-xviz-element="action-type">{action.type}</div>
      <dl data-xviz-element="action-payload">
        {Object.keys(action).map(key => {
          if (key === 'type') {
            return null;
          }
          const value = action[key];

          return (
            <React.Fragment key={key}>
              <dt
                title={key}
                data-xviz-element="action-property"
                data-xviz-action-property={key}
              >
                {key}
              </dt>
              <dd data-xviz-element="action-value">{JSON.stringify(value)}</dd>
            </React.Fragment>
          );
        })}
      </dl>
    </div>
  );
}
