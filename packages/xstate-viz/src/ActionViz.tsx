import * as React from 'react';
import {
  ActionObject,
  SpecialTargets,
  State,
  SendAction,
  LogAction
} from 'xstate';
import { toDelayString } from './utils';
import { resolveSend, resolveLog } from 'xstate/lib/actions';

const BUILTIN_PREFIX = 'xstate.';

function formatAction(
  action: ActionObject<any, any>,
  state?: State<any, any>
): JSX.Element | string {
  switch (action.type) {
    case 'xstate.raise':
      return (
        <>
          raise <strong>{action.event}</strong>
        </>
      );
    case 'xstate.send':
      const sendAction = state
        ? resolveSend(
            action as SendAction<any, any, any>,
            state.context,
            state._event
          )
        : action;

      if (sendAction.event?.type?.startsWith('xstate.after')) {
        return `send ${toDelayString(action.delay!)} delay`;
      }

      const target =
        sendAction.to === SpecialTargets.Parent ? (
          <em>parent</em>
        ) : (
          sendAction.to
        );
      const eventType = sendAction.event.type;

      return (
        <>
          send <strong>{eventType || '??'}</strong> to {target || <em>self</em>}
        </>
      );
    case 'xstate.log':
      const logAction = state
        ? resolveLog(action as LogAction<any, any>, state.context, state._event)
        : action;

      return (
        <>
          log{logAction.label ? ` (${logAction.label})` : ' '}{' '}
          {logAction.value ? `"${logAction.value}"` : ''}
        </>
      );
    case 'xstate.assign':
      if (typeof action.assignment === 'object') {
        return (
          <>
            assign to{' '}
            {Object.keys(action.assignment).map((key, i, keys) => (
              <>
                <code>{key}</code>
                {i === keys.length - 1 ? '' : ', '}
              </>
            ))}
          </>
        );
      }
      return <>assign</>;
    case 'xstate.choose':
      return <>choose</>;
    case 'xstate.pure':
      return <>pure</>;
    default:
      break;
  }

  if (action.type === 'xstate.cancel') {
    const matches = action.sendId!.match(/^xstate\.after\((.*)\)#.*$/);

    if (!matches) {
      return `cancel ${action.sendId!}`;
    }

    const [, delay] = matches;

    return `cancel ${toDelayString(delay)} delay`;
  }

  if (action.type.startsWith('function () {')) {
    return <em>anonymous</em>;
  }

  return action.type;
}

export const ActionViz: React.FC<{
  action: ActionObject<any, any>;
  state?: State<any, any>;
}> = ({ action, state }) => {
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
      <div data-xviz="action-type">{formatAction(action, state)}</div>
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
};
