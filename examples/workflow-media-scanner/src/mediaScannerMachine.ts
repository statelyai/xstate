import { createMachine, createAsyncLogic, types } from 'xstate';
import {
  checkFilePermissions,
  evaluateFiles,
  moveFiles,
  scanDirectories,
  PermissionError
} from './fileHandlers';

type ScannerInput = { basePath: string; destinationPath: string };
type ScannerContext = ScannerInput & {
  directoriesToCheck: string[];
  dirsToEvaluate: string[];
  dirsToMove: string[];
  filesToEmail: string[];
  dirsToReport: string[];
  processedFiles: string[];
  acceptedFileTypes: string[];
  errorMessage: string;
};

export const mediaScannerMachine = createMachine({
  schemas: {
    input: types<ScannerInput>(),
    context: types<ScannerContext>(),
    events: { START_SCAN: types<{}>(), RESTART: types<{}>() }
  },
  actors: {
    scanLibrary: createAsyncLogic({
      schemas: { input: types<{ basePath: string }>() },
      run: ({ input }) => scanDirectories(input.basePath)
    }),
    checkFilePermissions: createAsyncLogic({
      schemas: { input: types<{ directoriesToCheck: string[] }>() },
      run: ({ input }) => checkFilePermissions(input.directoriesToCheck)
    }),
    evaluateFiles: createAsyncLogic({
      schemas: {
        input: types<{
          dirsToEvaluate: string[];
          acceptedFileTypes: string[];
        }>()
      },
      run: ({ input, signal }) =>
        evaluateFiles(input.dirsToEvaluate, input.acceptedFileTypes, signal)
    }),
    moveFiles: createAsyncLogic({
      schemas: {
        input: types<{ dirsToMove: string[]; destinationPath: string }>()
      },
      run: ({ input }) => moveFiles(input.dirsToMove, input.destinationPath)
    })
  },
  context: ({ input }) => ({
    ...input,
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
    ],
    errorMessage: ''
  }),
  id: 'mediaScanner',
  initial: 'idle',
  states: {
    idle: {
      on: {
        START_SCAN: ({ context }) => ({
          target: 'Scanning',
          context: {
            ...context,
            directoriesToCheck: [],
            dirsToEvaluate: [],
            dirsToMove: [],
            filesToEmail: [],
            dirsToReport: [],
            processedFiles: [],
            errorMessage: ''
          }
        })
      }
    },
    Scanning: {
      invoke: {
        src: 'scanLibrary',
        input: ({ context }) => ({ basePath: context.basePath }),
        onDone: ({ context, event }) => ({
          target: 'CheckingFilePermissions',
          context: { ...context, directoriesToCheck: event.output }
        }),
        onError: ({ context, event }) => ({
          target: 'ReportingErrors',
          context: { ...context, errorMessage: String(event.error) }
        })
      }
    },
    CheckingFilePermissions: {
      invoke: {
        src: 'checkFilePermissions',
        input: ({ context }) => ({
          directoriesToCheck: context.directoriesToCheck
        }),
        onDone: ({ context, event }) => ({
          target: 'EvaluatingFiles',
          context: { ...context, ...event.output }
        }),
        onError: ({ context, event }) => ({
          target: 'ReportingErrors',
          context: {
            ...context,
            errorMessage: String(event.error),
            dirsToReport:
              event.error instanceof PermissionError
                ? event.error.dirsToReport
                : context.dirsToReport
          }
        })
      }
    },
    EvaluatingFiles: {
      invoke: {
        src: 'evaluateFiles',
        input: ({ context }) => ({
          dirsToEvaluate: context.dirsToEvaluate,
          acceptedFileTypes: context.acceptedFileTypes
        }),
        onDone: ({ context, event }) => ({
          target: 'MovingFiles',
          context: {
            ...context,
            dirsToMove: event.output.dirsToMove,
            dirsToReport: [
              ...context.dirsToReport,
              ...event.output.dirsToReport
            ]
          }
        }),
        onError: ({ context, event }) => ({
          target: 'ReportingErrors',
          context: { ...context, errorMessage: String(event.error) }
        })
      }
    },
    MovingFiles: {
      invoke: {
        src: 'moveFiles',
        input: ({ context }) => ({
          dirsToMove: context.dirsToMove,
          destinationPath: context.destinationPath
        }),
        onDone: ({ context, event }) => ({
          target:
            event.output.errors.length || context.dirsToReport.length
              ? 'ReportingErrors'
              : 'idle',
          context: {
            ...context,
            processedFiles: event.output.processedFiles,
            dirsToReport: [
              ...context.dirsToReport,
              ...event.output.errors.map((error) => error.source)
            ]
          }
        }),
        onError: ({ context, event }) => ({
          target: 'ReportingErrors',
          context: { ...context, errorMessage: String(event.error) }
        })
      }
    },
    ReportingErrors: {
      entry: ({ context }, enq) => {
        enq(() =>
          console.error(
            'Scanner errors:',
            context.errorMessage,
            context.dirsToReport
          )
        );
      },
      on: { RESTART: { target: 'idle' } }
    }
  }
});
