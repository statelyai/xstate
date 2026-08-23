import { createAsyncLogic, setup, types } from 'xstate';
import {
  checkFilePermissions,
  evaluateFiles,
  moveFiles,
  scanDirectories
} from './fileHandlers';

const ACCEPTED_FILE_TYPES = [
  'mp4',
  'mkv',
  'avi',
  'mov',
  'm4v',
  'mpg',
  'mpeg',
  'wmv',
  'flv',
  'ts',
  'mts'
];

interface MediaScannerContext {
  basePath: string;
  destinationPath: string;
  directoriesToCheck: string[];
  dirsToEvaluate: string[];
  dirsToMove: string[];
  dirsToReport: string[];
  acceptedFileTypes: string[];
}

export const mediaScannerMachine = setup({
  schemas: {
    context: types<MediaScannerContext>(),
    input: types<{ basePath: string; destinationPath: string }>(),
    events: {
      START_SCAN: types<{}>(),
      RESTART: types<{}>()
    }
  },
  actors: {
    scanLibrary: createAsyncLogic({
      run: ({ input }: { input: { basePath: string } }) =>
        scanDirectories(input.basePath)
    }),
    checkFilePermissions: createAsyncLogic({
      run: ({ input }: { input: { directoriesToCheck: string[] } }) =>
        checkFilePermissions(input.directoriesToCheck)
    }),
    evaluateFiles: createAsyncLogic({
      run: ({
        input
      }: {
        input: { dirsToEvaluate: string[]; acceptedFileTypes: string[] };
      }) => evaluateFiles(input.dirsToEvaluate, input.acceptedFileTypes)
    }),
    moveFiles: createAsyncLogic({
      run: ({
        input
      }: {
        input: { dirsToMove: string[]; destinationPath: string };
      }) => moveFiles(input.dirsToMove, input.destinationPath)
    })
  },
  actions: {
    emailErrors: (params: { dirsToReport: string[] }) => {
      console.log('Emailing errors for:', params.dirsToReport);
    }
  }
}).createMachine({
  id: 'mediaScanner',
  context: ({ input }) => ({
    basePath: input.basePath,
    destinationPath: input.destinationPath,
    directoriesToCheck: [],
    dirsToEvaluate: [],
    dirsToMove: [],
    dirsToReport: [],
    acceptedFileTypes: ACCEPTED_FILE_TYPES
  }),
  initial: 'idle',
  states: {
    idle: {
      on: { START_SCAN: { target: 'scanning' } }
    },
    scanning: {
      description:
        'Scans the media library and collects every subdirectory to check.',
      invoke: {
        src: 'scanLibrary',
        input: ({ context }) => ({ basePath: context.basePath }),
        onDone: ({ context, event }) => ({
          target: 'checkingFilePermissions',
          context: { ...context, directoriesToCheck: event.output }
        }),
        onError: { target: 'reportingErrors' }
      }
    },
    checkingFilePermissions: {
      description:
        'Splits the directories into readable/writable ones and ones to report.',
      invoke: {
        src: 'checkFilePermissions',
        input: ({ context }) => ({
          directoriesToCheck: context.directoriesToCheck
        }),
        onDone: ({ context, event }) => ({
          target: 'evaluatingFiles',
          context: {
            ...context,
            dirsToEvaluate: event.output.dirsToEvaluate,
            dirsToReport: event.output.dirsToReport
          }
        }),
        onError: { target: 'reportingErrors' }
      }
    },
    evaluatingFiles: {
      description: 'Collects the files above 1080p so they can be moved.',
      invoke: {
        src: 'evaluateFiles',
        input: ({ context }) => ({
          dirsToEvaluate: context.dirsToEvaluate,
          acceptedFileTypes: context.acceptedFileTypes
        }),
        onDone: ({ context, event }) => ({
          target: 'movingFiles',
          context: { ...context, dirsToMove: event.output.dirsToMove }
        }),
        onError: { target: 'reportingErrors' }
      }
    },
    movingFiles: {
      description: 'Moves the collected files to the destination library.',
      invoke: {
        src: 'moveFiles',
        input: ({ context }) => ({
          dirsToMove: context.dirsToMove,
          destinationPath: context.destinationPath
        }),
        onDone: { target: 'idle' },
        onError: { target: 'reportingErrors' }
      }
    },
    reportingErrors: {
      description:
        'Reports missing paths and directories without read/write access.',
      entry: ({ context, actions }, enq) => {
        enq(actions.emailErrors, { dirsToReport: context.dirsToReport });
      },
      on: { RESTART: { target: 'idle' } }
    }
  }
});
