import './styles.css';
import React, { useRef } from 'react';
import ReactDOM from 'react-dom';
import { createMachine } from 'xstate';
import { useMachine } from '@xstate/react';
import { inspect } from '@xstate/inspect';

// inspect({
//   url: "https://stately.ai/viz?inspect",
//   iframe: false
// });

const machine = createMachine({
  id: 'Machine',
  initial: 'mini',
  states: {
    mini: {
      on: {
        toggle: {
          target: 'full'
        }
      }
    },
    full: {
      entry: 'playVideo',
      exit: 'pauseVideo',
      invoke: [
        {
          src: 'videoEnded'
        },
        {
          src: 'keyEscape'
        }
      ],
      initial: 'playing',
      states: {
        playing: {
          on: {
            'video.ended': {
              target: 'stopped'
            }
          }
        },
        stopped: {
          after: {
            '2000': {
              target: '#Machine.mini',
              actions: [],
              internal: false
            }
          }
        }
      },
      on: {
        toggle: {
          target: 'mini'
        },
        'key.escape': {
          target: 'mini'
        }
      }
    }
  },
  context: {},
  predictableActionArguments: true,
  preserveActionOrder: true
});

function invokeVideoEnded(videoRef) {
  return () => (sendBack) => {
    const handler = () => {
      sendBack('video.ended');
    };
    videoRef.current.addEventListener('ended', handler);
    return () => {
      videoRef.current.removeEventListener('ended', handler);
    };
  };
}

function invokeKeyEscape() {
  return () => (sendBack) => {
    const handler = (event) => {
      if (event.key === 'Escape') {
        sendBack('key.escape');
      }
    };

    window.addEventListener('keydown', handler);

    return () => {
      window.removeEventListener('keydown', handler);
    };
  };
}

function App() {
  const videoRef = useRef();
  const [state, send] = useMachine(machine, {
    devTools: true,
    actions: {
      playVideo: () => {
        videoRef.current.play();
      },
      pauseVideo: () => {
        videoRef.current.pause();
      }
    },
    services: {
      videoEnded: invokeVideoEnded(videoRef),
      keyEscape: invokeKeyEscape()
    }
  });

  return (
    <div className="App">
      <h2>This is a cool video</h2>
      <div
        id="player"
        onClick={() => {
          send({ type: 'toggle' });
        }}
        data-state={state.toStrings().join(' ')}
      >
        <video id="video" controls width="250" ref={videoRef}>
          <source
            src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm"
            type="video/webm"
          />
          <source
            src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
            type="video/mp4"
          />
          Sorry, your browser doesn't support embedded videos.
        </video>
      </div>
    </div>
  );
}

export default App;
