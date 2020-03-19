import * as React from 'react';
import { ActionObject } from 'xstate';

export function ActionViz({ action }: { action: ActionObject<any, any> }) {
  return (
    <div data-xviz-element="action">
      <div data-xviz-element="action-type">{action.type}</div>
      <dl data-xviz-element="action-payload">
        {Object.keys(action).map(key => {
          if (key === 'type') {
            return null;
          }
          const value = action[key];

          return (
            <React.Fragment key={key}>
              <dt data-xviz-element="action-key">{key}</dt>
              <dd data-xviz-element="action-value">{JSON.stringify(value)}</dd>
            </React.Fragment>
          );
        })}
      </dl>
    </div>
  );
}
