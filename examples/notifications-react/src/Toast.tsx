import { useSelector } from '@xstate/react';
import { ActorFromLogic } from 'xstate';
import { toastMachine } from './toastMachine';

export function Toast({
  toastRef
}: {
  toastRef: ActorFromLogic<typeof toastMachine>;
}) {
  const state = useSelector(toastRef, (s) => s);
  const { kind, message } = state.context;

  return (
    <div
      className={`toast ${kind} ${state.matches('paused') ? 'paused' : ''}`}
      onMouseEnter={() => toastRef.send({ type: 'pause' })}
      onMouseLeave={() => toastRef.send({ type: 'resume' })}
    >
      <div className="body">
        <strong>{kind}</strong>
        <span>{message}</span>
      </div>
      <button onClick={() => toastRef.send({ type: 'dismiss' })}>×</button>
      <div className={`bar ${state.matches('showing') ? 'running' : ''}`} />
    </div>
  );
}
