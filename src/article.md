# XState Version 4 Released

It's been over a year since I first talked about state machines and statecharts to the web community at [React Rally 2017](TODO). To be honest, I had no idea how it would be received. Deterministic finite automata isn't exactly the most exciting topic, and most developers either aren't familiar with them or have studied them in classes, and dismissed them as too theoretical or academic to apply to something as ever-evolving as modern UI development.

To my surprise, the ideas I presented from brilliant minds such as David Harel and Ian Horrocks actually _clicked_ with many others, developers and designers alike! There's many reasons why I'm passionate about using statecharts in developing UIs:

- Visualizing application behavior and logic
- Natural prevention of "impossible states"
- Automatic test generation and running
- Full simulation in headless environments
- Reduced code complexity
- The [SCXML specification](TODO) (use statecharts in other languages!)
- Improved developer/designer handoff
- Accommodation of late-breaking changes and requirements
- Much, much less code

These ideas aren't mine, and these ideas aren't new (they're older than JavaScript itself). They've been proven in other areas of tech, such as embedded electronics, automotive tech, avionics systems, and more. And with [XState](TODO), we're determined to bring them to the modern web.

XState version 4.0 is a major release with very few breaking changes, and many new features that are fully SCXML-compatible.

## Assigning to context

Statecharts have a notion of "extended state", which is state that is more _quantitative_ than _qualitative_; that is, it's not exactly finite. For example, you can describe a glass as either `empty | filling | full` (finite state), or you can describe it by its actual volume, e.g., `123 ml` (extended state). In version 4, `context` (i.e., extended state) can now be modeled declaratively inside the machine itself. With the `assign` action, this gives you the ability to manipulate the extended state, just like Redux or other state management libraries:

```js
const counterMachine = Machine({
  id: 'counter',
  context: { count: 0 },
  initial: 'counting',
  states: {
    counting: {
      on: {
        INCREMENT: assign({ count: ctx => ctx.count + 1 }),
        DECREMENT: assign({ count: ctx => ctx.count - 1 })
      }
    }
  }
});

counterMachine.transition(counterMachine.initialState, 'INCREMENT').context;
// => { count: 1 }
```

The `transition` function is still pure, and the next State instance will provide the next value and context. So what's the difference between XState and the many other state management libraries?

Time travel. **In the future.**

![tic tac toe example TODO]()

This simple tic-tac-toe game is modeled as a statechart with XState. Using the exact same code, we're able to write assertions and automatically generate tests for advanced use-cases like "it should be possible for the game to end in a draw."
