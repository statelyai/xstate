import { assign, createMachine, DoneInvokeEvent, forwardTo } from 'xstate';

export interface AudioRecorderMachineContext {
  stream?: MediaStream;
  mediaChunks: Blob[];
}

export type AudioRecorderMachineEvent =
  | {
      type: 'RETRY';
    }
  | {
      type: 'RECORD';
    }
  | {
      type: 'AUDIO_CHUNK_RECEIVED';
      blob: Blob;
    }
  | {
      type: 'PAUSE';
    }
  | {
      type: 'RESUME';
    }
  | {
      type: 'STOP';
    }
  | {
      type: 'DOWNLOAD';
    };

const audioRecorderMachine = createMachine<
  AudioRecorderMachineContext,
  AudioRecorderMachineEvent
>(
  {
    id: 'audioRecorder',
    initial: 'idle',
    context: {
      mediaChunks: []
    },
    exit: 'removeMediaStream',
    states: {
      idle: {
        on: {
          RECORD: {
            target: 'requestingAudioOptions'
          }
        }
      },
      requestingAudioOptions: {
        invoke: {
          src: 'requestAudioOptions',
          onError: {
            target: 'couldNotRetrieveAudioOptions'
          },
          onDone: {
            target: 'recording',
            actions: 'assignStreamToContext'
          }
        }
      },
      recordingFailed: {
        on: {
          RETRY: { target: 'recording' }
        }
      },
      recording: {
        on: {
          AUDIO_CHUNK_RECEIVED: {
            actions: 'appendBlob'
          },
          STOP: {
            target: 'complete'
          }
        },
        invoke: {
          id: 'recording',
          src: 'recordFromStream',
          onError: {
            target: 'recordingFailed',
            actions: (context, event) => {
              console.error(event);
            }
          }
        },
        initial: 'running',
        states: {
          running: {
            on: {
              PAUSE: {
                target: 'paused',
                actions: forwardTo('recording')
              }
            }
          },
          paused: {
            on: {
              RESUME: {
                target: 'running',
                actions: forwardTo('recording')
              }
            }
          }
        }
      },
      complete: {
        on: {
          RETRY: {
            target: 'recording',
            actions: 'clearBlobData'
          },
          DOWNLOAD: {
            actions: 'downloadBlob'
          }
        }
      },
      couldNotRetrieveAudioOptions: {
        on: {
          RETRY: { target: 'requestingAudioOptions' }
        }
      }
    }
  },
  {
    actions: {
      downloadBlob: (context) => {
        const blob = new Blob(context.mediaChunks, {
          type: 'audio/ogg; codecs=opus'
        });
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');

        downloadLink.href = url;
        downloadLink.download = `file.ogg`;
        document.body.appendChild(downloadLink); // Required for FF
        downloadLink.click();
      },
      removeMediaStream: (context) => {
        if (context.stream) {
          context.stream.getTracks().forEach((track) => {
            track.stop();
          });
        }
      },
      assignStreamToContext: assign((context, event) => {
        return {
          stream: (event as DoneInvokeEvent<RequestAudioOptionsOutput>).data
            .stream
        };
      }),
      clearBlobData: assign((context) => {
        return {
          mediaChunks: []
        };
      }),
      appendBlob: assign((context, event) => {
        if (event.type !== 'AUDIO_CHUNK_RECEIVED') return {};
        return {
          mediaChunks: [...context.mediaChunks, event.blob]
        };
      })
    },
    services: {
      recordFromStream: (context) => (send, onReceive) => {
        // @ts-ignore
        const mediaRecorder = new MediaRecorder(context.stream);

        // @ts-ignore
        mediaRecorder.ondataavailable = (e) => {
          send({
            type: 'AUDIO_CHUNK_RECEIVED',
            blob: e.data
          });
        };
        mediaRecorder.start(200);

        onReceive((event) => {
          if (event.type === 'PAUSE') {
            mediaRecorder.pause();
          } else if (event.type === 'RESUME') {
            mediaRecorder.resume();
          }
        });

        return () => {
          if (mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
        };
      },
      requestAudioOptions: async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });

        return {
          stream
        };
      }
    }
  }
);

export default audioRecorderMachine;

export interface RequestAudioOptionsOutput {
  stream: MediaStream;
}
