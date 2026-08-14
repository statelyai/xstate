import { useActorRef, useSelector } from '@xstate/react';
import { uploadsMachine, UploadStatus } from './uploadsMachine';
import { Upload } from './Upload';
import './App.css';

const countBy = (statuses: Record<string, UploadStatus>, of: UploadStatus) =>
  Object.values(statuses).filter((status) => status === of).length;

export default function App() {
  const uploadsRef = useActorRef(uploadsMachine);
  const uploads = useSelector(uploadsRef, (s) => s.context.uploads);
  const summary = useSelector(uploadsRef, ({ context }) => ({
    uploading: countBy(context.statuses, 'uploading'),
    done: countBy(context.statuses, 'done'),
    failed: countBy(context.statuses, 'failed')
  }));

  return (
    <div id="app">
      <h1>File upload</h1>

      <div className="controls">
        <input
          type="file"
          multiple
          onChange={(event) => {
            const names = Array.from(event.target.files ?? []).map(
              (file) => file.name
            );

            uploadsRef.send({ type: 'FILES.ADD', names });
            event.target.value = '';
          }}
        />
        <button
          onClick={() =>
            uploadsRef.send({
              type: 'FILES.ADD',
              names: ['report.pdf', 'photo.png', 'archive.zip']
            })
          }
        >
          Add sample files
        </button>
      </div>

      <p className="summary">
        {summary.uploading} uploading · {summary.done} done · {summary.failed}{' '}
        failed
      </p>

      <ul className="uploads">
        {uploads.map((uploadRef) => (
          <Upload key={uploadRef.id} uploadRef={uploadRef} />
        ))}
      </ul>
    </div>
  );
}
