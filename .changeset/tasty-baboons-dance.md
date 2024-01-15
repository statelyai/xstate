---
'xstate': minor
---

added support for `actor.system.subscribe` to subscribe to registration and unregistration events within an actor's system.
`actor.system.subscribe` returns a `Subscription` object you can `.unsubscribe` to at any time.

ex:

```js
// observer object
const subscription = actor.system.subscribe({
  next: (event) => console.log(event),
  error: (err) => console.error(err),
  complete: () => console.log('done')
});

// observer parameters
const subscription = actor.system.subscribe(
  (event) => console.log(event),
  (err) => console.error(err),
  () => console.log('done')
);

// callback function
const subscription = actor.system.subscribe((event) => console.log(event));

// unsubscribe
subscription.unsubscribe();
```
