// import puppeteer from 'puppeteer';
import {
  // getShortestValuePaths
  getValueAdjacencyMap
  // deserializeStateString
} from '../../../lib/graph';

import { todosMachine } from '../src/todosMachine';

const ajdMap = getValueAdjacencyMap(todosMachine, {
  events: {
    'NEWTODO.COMMIT': [{ type: 'NEWTODO.COMMIT', value: 'something', id: 123 }],
    'TODO.DELETE': [{ type: 'TODO.DELETE', id: 123 }],
    'TODO.COMMIT': [
      {
        type: 'TODO.COMMIT',
        todo: {
          title: 'something else',
          completed: false,
          id: 123
        }
      },
      {
        type: 'TODO.COMMIT',
        todo: {
          title: 'something else',
          completed: true,
          id: 123
        }
      }
    ],
    CLEAR_COMPLETED: ['CLEAR_COMPLETED']
  },
  filter: state =>
    !!state.context && (!state.context.todos || state.context.todos.length < 2)
});

console.dir(ajdMap, { depth: null });

// const { ticTacToeMachine } = require('../src/ticTacToeMachine');

// const shortestValuePaths = getShortestValuePaths(ticTacToeMachine, {
//   events: {
//     PLAY: [
//       { type: 'PLAY', value: 0 },
//       { type: 'PLAY', value: 1 },
//       { type: 'PLAY', value: 2 },
//       { type: 'PLAY', value: 3 },
//       { type: 'PLAY', value: 4 },
//       { type: 'PLAY', value: 5 },
//       { type: 'PLAY', value: 6 },
//       { type: 'PLAY', value: 7 },
//       { type: 'PLAY', value: 8 }
//     ]
//   },
//   filter: state => {
//     // return state.context.moves <= 5;
//     return true;
//   }
// });

// const winningPaths = Object.keys(shortestValuePaths).filter(stateString => {
//   const { value, context } = deserializeStateString(stateString);

//   return value === 'draw';
// });

// function deserializeEventString(eventString) {
//   const [type, payload] = eventString.split(' | ');

//   return {
//     type,
//     ...(payload ? JSON.parse(payload) : {})
//   };
// }

// async function sleep(ms) {
//   await new Promise(res => setTimeout(res, ms));
// }

// async function runSimulations() {
//   const browser = await puppeteer.launch({ headless: false });

//   const page = await browser.newPage();
//   await page.goto('http://localhost:3000');

//   const eventMap = {
//     PLAY: async event => {
//       await page.click(`[data-testid="square-${event.value}"]`);
//     }
//   };

//   for (const targetStateString of winningPaths) {
//     const pathConfig = shortestValuePaths[targetStateString];

//     for (const { state, event: eventString } of pathConfig) {
//       if (!eventString) {
//         continue;
//       }
//       const event = deserializeEventString(eventString);
//       const realEvent = eventMap[event.type];

//       if (realEvent) {
//         await realEvent(event);
//       }
//       await sleep(100);
//     }
//     await sleep(200);
//     await page.reload();
//   }

//   await browser.close();
// }

// runSimulations();
