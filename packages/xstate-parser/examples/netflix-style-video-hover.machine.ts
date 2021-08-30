import { assign, createMachine } from 'xstate';

export interface NetflixStyleVideoHoverMachineContext {
  hasVideoLoaded: boolean;
}

export type NetflixStyleVideoHoverMachineEvent =
  | {
      type: 'REPORT_IMAGE_LOADED';
    }
  | {
      type: 'REPORT_IMAGE_FAILED_TO_LOAD';
    }
  | {
      type: 'MOUSE_OVER';
    }
  | {
      type: 'REPORT_VIDEO_LOADED';
    }
  | {
      type: 'MOUSE_OUT';
    };

const netflixStyleVideoHoverMachine = createMachine<
  NetflixStyleVideoHoverMachineContext,
  NetflixStyleVideoHoverMachineEvent
>(
  {
    id: 'netflixStyleVideoHover',
    initial: 'awaitingBackgroundImageLoad',
    context: {
      hasVideoLoaded: false
    },
    states: {
      awaitingBackgroundImageLoad: {
        on: {
          REPORT_IMAGE_LOADED: {
            target: 'idle'
          },
          REPORT_IMAGE_FAILED_TO_LOAD: {
            target: 'imageFailedToLoad'
          }
        }
      },
      imageFailedToLoad: {},
      idle: {
        on: {
          MOUSE_OVER: {
            target: 'showingVideo'
          }
        }
      },
      showingVideo: {
        initial: 'checkingIfVideoHasLoaded',
        on: {
          MOUSE_OUT: {
            target: 'idle'
          }
        },
        states: {
          checkingIfVideoHasLoaded: {
            always: [
              {
                cond: 'hasLoadedVideo',
                target: 'waitingBeforePlaying'
              },
              {
                target: 'loadingVideoSrc'
              }
            ]
          },
          waitingBeforePlaying: {
            after: {
              2000: {
                target: 'autoPlayingVideo'
              }
            }
          },
          loadingVideoSrc: {
            initial: 'cannotMoveOn',
            onDone: {
              target: 'autoPlayingVideo'
            },
            states: {
              cannotMoveOn: {
                after: {
                  2000: {
                    target: 'canMoveOn'
                  }
                },
                on: {
                  REPORT_VIDEO_LOADED: {
                    actions: 'reportVideoLoaded'
                  }
                }
              },
              canMoveOn: {
                always: {
                  cond: 'hasLoadedVideo',
                  target: 'loaded'
                },
                on: {
                  REPORT_VIDEO_LOADED: {
                    actions: 'reportVideoLoaded',
                    target: 'loaded'
                  }
                }
              },
              loaded: {
                type: 'final'
              }
            }
          },
          autoPlayingVideo: {}
        }
      }
    }
  },
  {
    guards: {
      hasLoadedVideo: (context) => {
        return context.hasVideoLoaded;
      }
    },
    actions: {
      reportVideoLoaded: assign((context) => ({
        hasVideoLoaded: true
      }))
    }
  }
);

export default netflixStyleVideoHoverMachine;
