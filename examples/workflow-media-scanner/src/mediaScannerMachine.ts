import { assign, fromPromise, setup } from 'xstate';
import {
  checkFilePermissions,
  evaluateFiles,
  moveFiles,
  scanDirectories
} from './fileHandlers';

export const mediaScannerMachine = setup({
  types: {
    input: {} as {
      basePath: string;
      destinationPath: string;
    },
    events: {} as { type: 'START_SCAN' } | { type: 'RESTART' },
    context: {} as {
      basePath: string;
      destinationPath: string;
      directoriesToCheck: string[];
      dirsToEvaluate: string[];
      dirsToMove: string[];
      filesToEmail: string[];
      dirsToReport: string[];
      processedFiles: string[];
      acceptedFileTypes: string[];
    }
  },
  actions: {
    emailErrors: () => {
      console.log('Emailing errors');
    }
  },
  actors: {
    scanLibrary: fromPromise(
      async ({ input }: { input: { basePath: string } }) =>
        await scanDirectories(input.basePath)
    ),
    checkFilePermissions: fromPromise(
      async ({
        input: { directoriesToCheck }
      }: {
        input: { directoriesToCheck: string[] };
      }) => await checkFilePermissions(directoriesToCheck)
    ),
    evaluateFiles: fromPromise(
      async ({
        input: { dirsToEvaluate, acceptedFileTypes }
      }: {
        input: { dirsToEvaluate: string[]; acceptedFileTypes: string[] };
      }) => await evaluateFiles(dirsToEvaluate, acceptedFileTypes)
    ),
    moveFiles: fromPromise(
      async ({
        input: { dirsToMove, destinationPath }
      }: {
        input: { dirsToMove: string[]; destinationPath: string };
      }) => await moveFiles(dirsToMove, destinationPath)
    )
  }
}).createMachine({
  context: ({ input }) => ({
    basePath: input.basePath,
    destinationPath: input.destinationPath,
    directoriesToCheck: [],
    dirsToEvaluate: [],
    dirsToMove: [],
    filesToEmail: [],
    dirsToReport: [],
    processedFiles: [],
    acceptedFileTypes: [
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
    ]
  }),
  id: 'mediaScanner',
  initial: 'idle',
  states: {
    idle: {
      on: {
        START_SCAN: {
          target: 'Scanning'
        }
      }
    },

    Scanning: {
      description:
        'Scan the media library and check for directories \n\nFor every file we can confirm is a directory, we add it to the context. \n\nIgnore the files already present in the ledger. Those are "known good"',
      invoke: {
        id: 'scanLibrary',
        input: ({ context: { basePath } }) => ({ basePath }),
        src: 'scanLibrary',
        onDone: [
          {
            target: 'CheckingFilePermissions',
            actions: assign({
              directoriesToCheck: ({ event }) => event.output
            })
          }
        ],
        onError: [
          {
            target: 'ReportingErrors'
          }
        ]
      }
    },

    CheckingFilePermissions: {
      description:
        'check the file permissions for all the files we need to scan.\n\nif we do not have read/write permissions, we update the context with the filenames/locations.\n\nif there are no files with read/write permissions, we move to the error state',
      invoke: {
        id: 'checkFilePermissions',
        input: ({ context: { directoriesToCheck } }) => ({
          directoriesToCheck
        }),
        src: 'checkFilePermissions',
        onDone: [
          {
            target: 'EvaluatingFiles',
            actions: assign(({ event }) => {
              return {
                dirsToEvaluate: event.output['dirsToEvaluate'],
                dirsToReport: event.output['dirsToReport']
              };
            })
          }
        ],
        onError: [
          {
            target: 'ReportingErrors',
            actions: assign(({ event }) => {
              return {
                dirsToReport: event.error['dirsToReport']
              };
            })
          }
        ]
      }
    },

    ReportingErrors: {
      description:
        'Send a message with error details to the proper destination.\n\nErrors could be the lack of read/write permissions or path not existing',
      entry: {
        type: 'emailErrors'
      },
      on: {
        RESTART: {
          target: 'idle'
        }
      }
    },

    EvaluatingFiles: {
      description:
        'Evaluate the files to determine their resolution. If they are 4K, move them to a new directory',
      invoke: {
        id: 'evaluatingFiles',
        input: ({ context: { dirsToEvaluate, acceptedFileTypes } }) => ({
          dirsToEvaluate,
          acceptedFileTypes
        }),
        src: 'evaluateFiles',
        onDone: [
          {
            target: 'MovingFiles',
            actions: assign(({ event }) => {
              return {
                dirsToMove: event.output['dirsToMove']
              };
            })
          }
        ]
      }
    },

    MovingFiles: {
      description:
        'Move all the files present in context to the destination library',
      invoke: {
        input: ({ context: { dirsToMove, destinationPath } }) => ({
          dirsToMove,
          destinationPath
        }),
        src: 'moveFiles',
        id: 'moveFiles',

        onError: [
          {
            target: 'ReportingErrors'
          }
        ],

        onDone: 'idle'
      }
    }
  }
});
