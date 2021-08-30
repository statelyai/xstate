import { assign, createMachine, DoneInvokeEvent } from 'xstate';

export interface AudioVideoDeviceSelectionMachineContext {
  audioInputDevices: MediaDeviceInfo[];
  audioOutputDevices: MediaDeviceInfo[];
  videoInputDevices: MediaDeviceInfo[];
  selectedAudioInputDevice?: MediaDeviceInfo;
  selectedAudioOutputDevice?: MediaDeviceInfo;
  selectedVideoInputDevice?: MediaDeviceInfo;
  formValues: { username: string; password: string };
}

export type AudioVideoDeviceSelectionMachineEvent =
  | {
      type: 'CHOOSE_AUDIO_INPUT_DEVICE';
      index: number;
    }
  | {
      type: 'CHOOSE_AUDIO_OUTPUT_DEVICE';
      index: number;
    }
  | {
      type: 'CHOOSE_VIDEO_DEVICE';
      index: number;
    };

export type DevicesDoneEvent = DoneInvokeEvent<{
  devices: MediaDeviceInfo[];
}>;

const audioVideoDeviceSelectionMachine = createMachine<
  AudioVideoDeviceSelectionMachineContext,
  AudioVideoDeviceSelectionMachineEvent
>(
  {
    id: 'audioVideoDeviceSelection',
    initial: 'requestingDevices',
    context: {
      audioInputDevices: [],
      audioOutputDevices: [],
      videoInputDevices: [],
      formValues: {
        username: '',
        password: ''
      }
    },
    states: {
      requestingDevices: {
        invoke: {
          src: 'requestAudioOptions',
          onError: {
            target: 'couldNotRetrieveDevices'
          },
          onDone: {
            actions: [
              'assignDevicesToContext',
              'assignDefaultDevicesToContext'
            ],
            target: 'gotDevices'
          }
        }
      },
      couldNotRetrieveDevices: {},
      gotDevices: {
        on: {
          CHOOSE_AUDIO_INPUT_DEVICE: {
            cond: (context, event) =>
              Boolean(context.audioInputDevices[event.index]),
            actions: assign((context, event) => {
              return {
                selectedAudioInputDevice: context.audioInputDevices[event.index]
              };
            })
          },
          CHOOSE_AUDIO_OUTPUT_DEVICE: {
            cond: (context, event) =>
              Boolean(context.audioOutputDevices[event.index]),
            actions: assign((context, event) => {
              return {
                selectedAudioOutputDevice:
                  context.audioOutputDevices[event.index]
              };
            })
          },
          CHOOSE_VIDEO_DEVICE: {
            cond: (context, event) =>
              Boolean(context.videoInputDevices[event.index]),
            actions: assign((context, event) => {
              return {
                selectedVideoInputDevice: context.videoInputDevices[event.index]
              };
            })
          }
        }
      }
    }
  },
  {
    actions: {
      assignDevicesToContext: assign((context, event: unknown) => {
        return {
          audioInputDevices: (event as DevicesDoneEvent).data.devices.filter(
            (device) => device.deviceId && device.kind === 'audioinput'
          ),
          audioOutputDevices: (event as DevicesDoneEvent).data.devices.filter(
            (device) => device.deviceId && device.kind === 'audiooutput'
          ),
          videoInputDevices: (event as DevicesDoneEvent).data.devices.filter(
            (device) => device.deviceId && device.kind === 'videoinput'
          )
        };
      }),
      assignDefaultDevicesToContext: assign((context) => {
        return {
          selectedAudioInputDevice: context.audioInputDevices[0],
          selectedAudioOutputDevice: context.audioOutputDevices[0],
          selectedVideoInputDevice: context.videoInputDevices[0]
        };
      })
    },
    services: {
      requestAudioOptions: async () => {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true
        });
        const devices = await navigator.mediaDevices.enumerateDevices();

        stream.getTracks().forEach((track) => {
          track.stop();
        });

        return {
          devices
        };
      }
    }
  }
);

export default audioVideoDeviceSelectionMachine;
