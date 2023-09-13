import { createMachine, interpret } from 'xstate';
import { promises as fs } from 'fs';

const FILENAME = './persisted-state.json';

const donutMachine = createMachine({
  id: 'donut',
  initial: 'ingredients',
  states: {
    ingredients: {
      on: {
        NEXT: 'directions'
      }
    },
    directions: {
      initial: 'makeDough',
      onDone: 'fry',
      states: {
        makeDough: {
          on: { NEXT: 'mix' }
        },
        mix: {
          type: 'parallel',
          states: {
            mixDry: {
              initial: 'mixing',
              states: {
                mixing: {
                  on: { MIXED_DRY: 'mixed' }
                },
                mixed: {
                  type: 'final'
                }
              }
            },
            mixWet: {
              initial: 'mixing',
              states: {
                mixing: {
                  on: { MIXED_WET: 'mixed' }
                },
                mixed: {
                  type: 'final'
                }
              }
            }
          },
          onDone: 'allMixed'
        },
        allMixed: {
          type: 'final'
        }
      }
    },
    fry: {
      on: {
        NEXT: 'flip'
      }
    },
    flip: {
      on: {
        NEXT: 'dry'
      }
    },
    dry: {
      on: {
        NEXT: 'glaze'
      }
    },
    glaze: {
      on: {
        NEXT: 'serve'
      }
    },
    serve: {
      on: {
        ANOTHER_DONUT: 'ingredients'
      }
    }
  }
});

let restoredState;
try {
  restoredState = JSON.parse(await fs.readFile(FILENAME, 'utf8'));
} catch (e) {
  console.log('No persisted state found.');
  restoredState = undefined;
}

const actor = interpret(donutMachine, {
  state: restoredState
});

actor.subscribe({
  next(snapshot) {
    console.log(
      'Current state:',
      // the current state, bolded
      `\x1b[1m${JSON.stringify(snapshot.value)}\x1b[0m\n`,
      'Next events:',
      // the next events, each of them bolded
      snapshot.nextEvents
        .filter((event) => !event.startsWith('done.'))
        .map((event) => `\n  \x1b[1m${event}\x1b[0m`)
        .join(''),
      '\nEnter the next event to send:'
    );

    // save persisted state to json file
    const persistedState = actor.getPersistedState();
    fs.writeFile(FILENAME, JSON.stringify(persistedState));
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();

process.stdin.on('data', (data) => {
  const eventType = data.toString().trim();
  actor.send({ type: eventType });
});
