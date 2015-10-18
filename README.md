# Estado
Simple, stateless JavaScript Finite State Machines. **Work in progress!**

## Getting Started
1. Install via NPM: `npm install estado --save`
2. Import the state machine creator into your project:

```js
import { machine } from 'estado';

let lightMachine = machine({
  states: [
    {
      id: 'green',
      initial: true,
      transitions: [
        {
          event: 'TIMER',
          target: 'yellow'
        }
      ]
    },
    {
      id: 'yellow',
      transitions: [
        {
          event: 'TIMER',
          target: 'red'
        }
      ]
    },
    {
      id: 'red',
      transitions: [
        {
          event: 'TIMER',
          target: 'green'
        }
      ]
    }
  ]
});

// Pure, stateless transition functions
let currentState = lightMachine.transition('green', 'TIMER');
// => 'yellow'

let newState = lightMachine.transition(currentState, 'TIMER');
// => 'red'

// Initial state
let initialState = lightMachine.transition();
// => 'green'
```

_Documentation in progress!_
