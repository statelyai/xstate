# estado
Simple JavaScript Finite State Machines.

## Quick Start
**Terminal**
```bash
npm install estado --save
```

**index.js**
```js
var machine = require('estado');

var trafficLight = machine({
  green: {
    yellow: 'timer'
  },
  yellow: {
    red: 'timer'
  },
  red: {
    green: 'timer'
  });
  
machine.transition('green', 'timer');
// => 'yellow'

machine.transition('red', 'timer');
// => 'green'

// Have a little fun with it:
var light = 'green';

setTimeout(function() {
  console.log(machine.transition(light, 'timer'));
}, 1000);
// => 'yellow'
// => 'red'
// => 'green'
// => ...etc.
```
