# XState Version 4 Released

It's been over a year since I first talked about state machines and statecharts to the web community at [React Rally 2017](https://www.youtube.com/watch?v=VU1NKX6Qkxc). To be honest, I had no idea how it would be received. Deterministic finite automata isn't exactly the most exciting topic, and most developers either aren't familiar with them or have studied them in classes, and dismissed them as too theoretical or academic to apply to something as ever-evolving as modern UI development.

To my surprise, the ideas I presented from brilliant minds such as David Harel and Ian Horrocks actually _clicked_ with many others, developers and designers alike! There's many reasons why I'm passionate about using statecharts in developing UIs:

- Visualizing application behavior and logic
- Natural prevention of "impossible states"
- Automatic test generation and running
- Full simulation in headless environments
- Reduced code complexity
- The [SCXML specification](https://w3.org/TR/scxml/) (use statecharts in other languages!)
- Improved developer/designer handoff
- Accommodation of late-breaking changes and requirements
- Much, much less code

These ideas aren't mine, and these ideas aren't new (they're older than JavaScript itself). They've been proven in other areas of tech, such as embedded electronics, automotive tech, avionics systems, and more. And with [XState](https://xstate.js.org), we're determined to bring them to the modern web.

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

![Tic Tac Toe](https://i.imgur.com/d3HCJLP.gif)

This simple tic-tac-toe game is modeled as a statechart with XState. Using the exact same code, we're able to write assertions and automatically generate tests for advanced use-cases like "it should be possible for the game to end in a draw."

In the future, there can be even more powerful predictive tools for testing and finding edge cases, since we can deterministically know _how_ and _when_ any value can change as it propagates through states and actions, instead of assuming a value can be modified at any time.

## Invoking other machines

Many people have asked about whether they should design one giant, complex statechart for their app or split it into smaller statecharts. Statecharts describe the behavior of a single system, and applications are typically modeled by _many_ systems communicating with each other, in some orchestrated way (hopefully). Multiple smaller statecharts are preferred - you should isolate behavior and rely on communication (message-passing) between statecharts instead.

This is where `invoke` comes into play. In XState version 4, `invoke` enables you to create systems of statecharts that communicate with each other, which is compatible with [the SCXML implementation](https://www.w3.org/TR/scxml/#invoke). This closely resembles the [Actor model](https://www.brianstorti.com/the-actor-model/).

In fact, a Promise can be considered its own state machine:

```js
const userMachine = Machine({
  id: 'user',
  initial: 'loading',
  context: { userID: 42 },
  states: {
    loading: {
      invoke: {
        src: (ctx, event) =>
          fetch(`/api/users/${ctx.userID}`).then(response => response.json()),
        onDone: 'success',
        onError: 'failure'
      }
    },
    success: {},
    failure: {}
  }
});
```

Parents can send events to children via the `send('SOME_EVENT', { to: 'childID' })` action, and children can send events to parents via the `sendParent('SOME_EVENT')` action. [See the XState docs](https://xstate.js.org/docs/guides/communication/) for more info.

## Interpreter

XState now comes with a built-in (completely optional) interpreter for running your statecharts in any framework (or no framework at all), using an event-emitter-based syntax:

```js
import { Machine } from 'xstate';
import { interpret } from 'xstate/lib/interpreter';

const myMachine = // ... your Machine()

const myService = interpret(myMachine)
  .onTransition(state => console.log(state));

// Start your service!
myService.start();

// Send events to your service
myService.send('SOME_EVENT');
myService.send({ type: 'COMPLEX_EVENT', data: { id: 42 } });

// Stop and clean up your service
myService.stop();
```

Since XState's `machine.transition()` function is pure, you're free to create your own interpreter, or integrate this interpreter into your projects. For example, the [`use-machine` library by Carlos Galarza](https://github.com/carloslfu/use-machine) lets you interpret XState machines in React hooks! [See the XState docs](https://xstate.js.org/docs/guides/interpretation/) for more info.

## Timers and Delays

Time is the most neglected variable, yet it is extremely important to manage in reactive systems. XState version 4 treats time as a first-class citizen with two new features:

- Delayed transitions with `after: { ... }`
- Delayed events with e.g., `send(event, { delay: 1000 })`

![Delayed light machine](https://i.imgur.com/Zq9gRxZ.gif)

Modeling transitions that happen over time can now be done declaratively:

```js
{
  green: {
    // after 2 seconds, go to 'yellow'
    after: {
      2000: 'yellow'
    }
  }
}
```

In an interpreter that supports delayed transitions, the `setTimeout` call for this will be canceled if the `'green'` state is exited, so no need to worry about unexpected transitions or cleaning up timers. Sending and canceling delayed events can also be done:

```js
{
  on: {
    SOME_EVENT: {
      actions: send('showAlert', { id: 'alert1', delay: 1000 })
    }
  },
  // If this state is exited before 1000ms, the 'showAlert' action will not be sent.
  onExit: cancel('alert1')
}
```

[See the XState docs](https://xstate.js.org/docs/guides/delays/) for more info.

## Final States

I neglected to talk about final states so far, but with statecharts, they're actually incredibly useful. Instead of making awkward transitions from child states to parent-level states, you can decouple the logic with an `onDone` transition:

```js
{
  red: {
    initial: 'walk',
    states: {
      walk: {
        after: { 2000: 'wait' }
      },
      wait: {
        after: { 1000: 'stop' }
      },
      stop: {
        type: 'final'
      }
    },
    // When the final 'red.stop' state is reached, transition to 'green'
    onDone: 'green'
  }
}
```

[See the XState docs](https://xstate.js.org/docs/guides/final/) for more info.

## Visualizer

With this release comes a new visualizer, with support for everything in XState version 4, including parallel/hierarchical states, history/final states, timers, guards, and more. This visualizer is built in HTML, SVG, and React, with an emphasis on developer experience:

![XState Visualizer](https://i.imgur.com/3pEB0B3.png)

[XState Visualizer](https://statecharts.github.io/xstate-viz)

- Copy-paste your JavaScript `Machine()` code _directly_ into the editor. The `Machine` and `XState` variables are available to you in this scope.
- Send custom events to the machine, such as `{ type: 'EVENT', data: { id: 42 } }`.
- Collapse and expand nested states for visual clarity.
- Modify and update your statechart live.
- Save your statechart definitions (coming 🔜 - for now, you can just save it as a [gist](https://gist.github.com)).
- More to come!

## Future Plans

This is just the beginning. Statecharts are a decades-old, well-researched way of modeling reactive systems, and there is so much potential in using software modeling principles in the highly dynamic, complex applications and user interfaces we work with every day. Here's what's planned for XState in the near future:

- Full [SCXML](https://www.w3.org/TR/scxml/) conversion. This will allow statecharts defined in XState to be compatible with any SCXML interpreter, in _any language_, and uses a common standard for defining statecharts.
  - Internally, tests authored in SCXML are already being converted to XState JSON definitions.
- More examples, in many different frameworks and libraries, such as Vue, React, Angular, RxJS, etc.
- Testing and analysis tools.
- Live debugging tools and browser extensions.
- Implementation of XState in other languages, such as ReasonML.

And finally, I'm planning on releasing a beta version of advanced statechart visualization, simulation, editing, and testing software in early 2019. Keep an eye out for that 😉

## Special Thanks and the Community

The statecharts community has grown significantly over the last year, with so many members contributing incredible ideas, tools, and insights to improving the way we craft and model software on the web. I'm super thankful to:

- [Erik Mogensen](https://twitter.com/mogsie) for his knowledge and shared passions about statecharts, including the invaluable resource [statecharts.github.io](https://statecharts.github.io)
- [Michele Bertoli](https://twitter.com/MicheleBertoli) for bringing `react-automata` to the React ecosystem, making it easier to model React apps as statecharts
- [Jon Bellah](https://twitter.com/jonbellah) and [Kyle Shevlin]() for creating lessons on XState:
  - [Learn State Machines](https://learnstatemachines.com)
  - [Egghead: State Transitions with XState](https://egghead.io/lessons/javascript-handle-state-transitions-through-events-in-a-finite-state-machine-with-xstate)
- [Luca Matteis](https://twitter.com/lmatteis) for his wonderful insights on statecharts and especially [behavioral programming](https://vimeo.com/298554103), which is a related concept by David Harel, and well worth exploring
- [Prof. David Harel](http://www.wisdom.weizmann.ac.il/~harel/) of course, for inventing statecharts
  - He just released [a new course called "Programming for Everyone"](https://www.edx.org/course/liberating-programming-system-development-for-everyone-0) with Dr. Michal Gordon on statecharts and live sequence charts!
- [Kate Compton](https://twitter.com/GalaxyKate) for her inspiring experiments with finite state machines and more advanced uses like [story-grammar generation with Tracery](https://github.com/galaxykate/tracery)

And extra special thanks [Tipe.io](https://tipe.io/) and the backers on [the XState Open Collective](https://opencollective.com/xstate) for sponsoring the development of XState and making it possible for me to spend my limited free time working on this daily.

---

Let's **make our code do more** together. Thanks for reading! 🚀
