import { ActorFromLogic, setup, types } from 'xstate';
import { uploadMachine } from './uploadMachine';

export type UploadStatus = 'uploading' | 'done' | 'failed' | 'cancelled';

let count = 0;

export const uploadsMachine = setup({
  schemas: {
    context: types<{
      uploads: ActorFromLogic<typeof uploadMachine>[];
      statuses: Record<string, UploadStatus>;
    }>(),
    events: {
      'FILES.ADD': types<{ names: string[] }>(),
      'UPLOAD.STATUS': types<{ id: string; status: UploadStatus }>()
    }
  }
}).createMachine({
  id: 'uploads',
  context: {
    uploads: [],
    statuses: {}
  },
  on: {
    'FILES.ADD': ({ context, event }, enq) => {
      const spawned = event.names.map((name) => {
        const id = `upload-${count++}`;
        // Every third file fails, so retry is demoable without a server
        const willFail = count % 3 === 0;

        const upload = enq.spawn(uploadMachine, {
          id,
          input: { name, willFail }
        });

        // The child reports its own state; the parent only aggregates
        enq.subscribeTo(upload, (snapshot) => ({
          type: 'UPLOAD.STATUS' as const,
          id,
          status: snapshot.value as UploadStatus
        }));

        return upload;
      });

      return {
        context: { ...context, uploads: context.uploads.concat(spawned) }
      };
    },
    'UPLOAD.STATUS': ({ context, event }) => ({
      context: {
        ...context,
        statuses: { ...context.statuses, [event.id]: event.status }
      }
    })
  }
});
