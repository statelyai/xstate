# Workflow Example: Scanning and spliting Media

This is a small example of a back-end workflow that uses a state machine to execute long running tasks. This project crawls a directory full of movies and separates out videos over 1080p for potential processing down the line.

> **NOTE:This project is not intended for production use.**

## Prerequisites

This project requires `ffprobe`, a binary that ships alongside `ffmpeg`, which is the golden standard for media file manipulation.

- [Install ffmpeg here](https://ffmpeg.org/download.html)
- Clone this repo and run `yarn` (or use your package manager of choice) in a terminal at the project's root.
- Update the `basePath` and `destinationPath` in the `mediaScannerMachine.ts` file with your own paths.
- Run the project with `yarn start` in the terminal

## XState concepts involved

This project convers how to implement the following with XState:

- Initializing a XState machine as an actor

  ```ts
  // index.ts

  // ...

  const mediaScannerActor = createActor(mediaScannerMachine);
  ```

- Injecting context information into the actor on initialization

  ```ts
  // index.ts

  // ...

  const mediaScannerActor = createActor(mediaScannerMachine, {
    input: {
      basePath: 'YOUR BASE PATH HERE',
      destinationPath: 'YOUR DESTINATION PATH HERE'
    }
  });
  ```

- Sending events to the XState actor

  ```ts
  // index.ts

  // ...

  mediaScannerActor.send({ type: 'START_SCAN' });
  ```

- Subscribing to a running actor for state change and context information

  ```ts
  // index.ts

  // ...

  mediaScannerActor.subscribe((state) => {
    console.log({
      state: state.value,
      error: state.error,
      context: state.context
    });
  });
  ```

- Invoking services and capturing results

  > mediaScannerMachine.ts

  ```ts
  invoke: {
    id: 'checkFilePermissions',
    input: ({ context: { directoriesToCheck } }) => ({
      directoriesToCheck
    }),
    src: fromPromise(async ({ input: { directoriesToCheck } }) =>
      await checkFilePermissions(directoriesToCheck)
    ),
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
  ```

- Batching results and assigning multiple properties to the actor's context

  > fileHandlers.ts

  ```ts
  ...
   return { dirsToEvaluate, dirsToReport };
  ```

  > mediaScannerMachine.ts

  ```ts
  actions: assign(({ event }) => {
    return {
      dirsToEvaluate: event.output['dirsToEvaluate'],
      dirsToReport: event.output['dirsToReport']
    };
  });
  ```
