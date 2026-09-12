import { ActorFromLogic } from 'xstate';
import { useSelector } from '@xstate/react';
import { uploadMachine } from './uploadMachine';

export function Upload({
  uploadRef
}: {
  uploadRef: ActorFromLogic<typeof uploadMachine>;
}) {
  const state = useSelector(uploadRef, (s) => s);
  const { name, progress } = state.context;
  const status = String(state.value);

  return (
    <li className="upload">
      <div className="upload-head">
        <strong>{name}</strong>
        <span className={`status status-${status}`}>{status}</span>
      </div>
      <progress max={100} value={progress} />
      <div className="upload-actions">
        {state.matches('uploading') && (
          <button onClick={() => uploadRef.send({ type: 'CANCEL' })}>
            Cancel
          </button>
        )}
        {state.matches('failed') && (
          <button onClick={() => uploadRef.send({ type: 'RETRY' })}>
            Retry
          </button>
        )}
      </div>
    </li>
  );
}
