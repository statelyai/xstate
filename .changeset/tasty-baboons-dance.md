---
'xstate': minor
---

added support for `actor.system.subscribe` to subscribe to changes to the system snapshot.
`actor.system.subscribe` returns a `Subscription` object you can `.unsubscribe` to at any time.

ex:

```js
// observer object
const subscription = actor.system.subscribe({
  next: (snapshot) => console.log(snapshot),
  error: (err) => console.error(err),
  complete: () => console.log('done')
});

// observer parameters
const subscription = actor.system.subscribe(
  (snapshot) => console.log(snapshot),
  (err) => console.error(err),
  () => console.log('done')
);

// callback function
const subscription = actor.system.subscribe((snapshot) =>
  console.log(snapshot)
);

// unsubscribe
subscription.unsubscribe();
```
