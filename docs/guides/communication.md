## Quick Reference

**The `invoke` property**

```js
const machine = createMachine({
  // ...
  states: {
    someState: {
      invoke: {
        // The `src` property can be:
        // - a string
        // - a machine
        // - a function that returns...
        src: (context, event) => {
          // - a promise
          // - a callback handler
          // - an observable
        },
        id: 'some-id',
        // (optional) forward machine events to invoked service (currently for machines only!)
        autoForward: true,
        // (optional) the transition when the invoked promise/observable/machine is done
        onDone: { target: /* ... */ },
        // (optional) the transition when an error from the invoked service occurs
        onError: { target: /* ... */ }
      }
    }
  }
});
```

**Invoking Promises**

```js
// Function that returns a promise
const getDataFromAPI = () => fetch(/* ... */)
    .then(data => data.json());


// ...
{
  invoke: (context, event) => getDataFromAPI,
  // resolved promise
  onDone: {
    target: 'success',
    // resolved promise data is on event.data property
    actions: (context, event) => console.log(event.data)
  },
  // rejected promise
  onError: {
    target: 'failure',
    // rejected promise data is on event.data property
    actions: (context, event) => console.log(event.data)
  }
}
// ...
```

**Invoking Callbacks**

```js
// ...
{
  invoke: (context, event) => (callback, onReceive) => {
    // Send event back to parent
    callback({ type: 'SOME_EVENT' });

    // Receive events from parent
    onReceive(event => {
      if (event.type === 'DO_SOMETHING') {
        // ...
      }
    });
  },
  // Error from callback
  onError: {
    target: 'failure',
    // Error data is on event.data property
    actions: (context, event) => console.log(event.data)
  }
},
on: {
  SOME_EVENT: { /* ... */ }
}
```

**Invoking Observables**

```js
import { map } from 'rxjs/operators';

// ...
{
  invoke: {
    src: (context, event) => createSomeObservable(/* ... */).pipe(
        map(value => ({ type: 'SOME_EVENT', value }))
      ),
    onDone: 'finished'
  }
},
on: {
  SOME_EVENT: /* ... */
}
// ...
```

**Invoking Machines**

```js
const someMachine = createMachine({ /* ... */ });

// ...
{
  invoke: {
    src: someMachine,
    onDone: {
      target: 'finished',
      actions: (context, event) => {
        // Child machine's done data (.data property of its final state)
        console.log(event.data);
      }
    }
  }
}
// ...
```
