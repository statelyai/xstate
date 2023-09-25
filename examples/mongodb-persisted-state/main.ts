import { createActor, createMachine } from 'xstate';
import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = '<your mongodb connection string>';

const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1
});
const db = client.db('donut-maker');
const donutCollection = db.collection('donuts');
const options = { upsert: true };
const filter = { persistedState: { $exists: true } };

const donutMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QQPYDsCuAXAdASzSgCdI8w0tYBiAOQFEANAFQG0AGAXUVAAcVY8WPOm4gAHogCMANmk4ATAA5JAZgCsATjVq2Adk0AWRQBoQAT0QGDknLsXTFBthoNqVutmzUBfb6dSYuBB4JADGQujUAWA4sFgAhlgxAdg4wWERaLDsXEggfAKZohIIGhryOOqyKtJa7pKSaqYWCA2KKgry8p5KymxWPn4gKUEhYOHCWTgAtvEA1mAAIigYUAAWtIysnKIFgpPFiNKSbDhq3bUubroNus1SGro4Msca6mzSnv26vv7oqelxplYDM8GIqNFYgkkml-qMMpMQdMwTldvx9iI8iUyhUqtIanUbo17ghpE4cBoZJI3jpPp5Bn9AmkxhNIqCxOzFkQzOyCFAqABZACSDDoiwA+osAEoATVReT2RSxRwMckpqnkA3qkju5kQmkUOGsr3edK8v2GcOZCLZyI5doA6mBcHa+YKRWLxQ66Ntcrx0UrQCUyWqGipNa5tbqWvoNM9ZNTTV8GZamQAzbmbZjy-2FA7KhAAWjUBjO8jUijUdnpBg0shJyjkZJUNO0b2k+gtIxwaYANngeFnfWi85ig5Y1M8nLoVK4dLGDPoSaoajg2DVHM5Ix55F2rRBM-RszsFQH8+OEPJw89yyctPPDCY9a0VKv1w4nFd3Gxd0Nu1Be3iAAvMAhxzfIzzHcQJynPRZ20PRDCXZ8ZA0Q03A-Ldrh-PcmVgMAiAAN1AgBBGgAHkmAACToKVJXImgAFVh1PUc0EOVpZAUZR1HvRCXCfFpujXDdP23TxZF8IY0BQCA4FEEYRwxdiC0LE4KnOCsq0UGs62kElCw7SolAreQZ01SRI1w1I+RIYJyEoJTA2gy9J0suC534xcmmfAxZwUdd52OboN2s+EgURJzzxcpxTgTcMtSJaMpGcHAdL0fFZEUXQr1VMLrQi215iWFZ1iiqCSlVON4oja5bmXR4cFkaQuicK9tOkfLAVZKY7XKlSLysQ0asS+rfK6Cl1BbXLZE1X9GQBFlgXZTluX6jjaybY4Eu3MaWjUE5Kk8XRMocHL4K6pbERWu0uR5V1CHWgsS1LEbdp1EkDQpKkaQ+ZNLptXqwVW+6wUgJ6L10LR40pAk6o+59NCeZrE1pf6-33K7bWBx1nQhmK6ya7baqjEkOxsLwMpqM7coBwqgftMEnRdME+XxkoXqJjVRoRmNNCJk00fpOmeqRHGmeddlwdY5SOKh9DJF6Wp4eShB9ENY1Ub+4WMaZbrlviXtewFMGIHZqQTieH8PjKd79OffFhoTX6zRTbsMxaXNZYLBwOl0GdKyqKtpArZcGjjG5q0sxRukUN58r7AdzYQWc5DsSkcsp2MfJaS3J3fTcvx3Lq1pl5ySmjprb2cBCF0EqRXzkDDC-E+bU1SADgLAZPX0nT4BM87Pl0bs5RKw782+7fCiO7svoorowq4OmuHwE5dag6SMgsV9cfikoA */
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
  await client.connect();
  restoredState = await donutCollection.findOne();
  if (!restoredState) {
    console.log('no persisted state found in db. starting from scratch.');
  }
  console.log('restored state: ', restoredState);

  const actor = createActor(donutMachine, {
    state: restoredState?.persistedState
  });

  actor.subscribe({
    async next(snapshot) {
      // save persisted state to mongodb
      const persistedState = actor.getPersistedState();
      const updateDoc = {
        $set: {
          persistedState
        }
      };

      const result = await donutCollection.updateOne(
        filter,
        updateDoc,
        options
      );

      // only log if the upsert occurred
      if (result.modifiedCount > 0 || result.upsertedCount > 0) {
        console.log('persisted state saved to db. ', result);
      }

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
    },
    async complete() {
      console.log('workflow completed', actor.getSnapshot().output);
      await client.close();
    }
  });

  actor.start();

  process.stdin.on('data', (data) => {
    const eventType = data.toString().trim();
    actor.send({ type: eventType });
  });
} catch (e) {
  console.log('error details: ', e);
  restoredState = undefined;
}
