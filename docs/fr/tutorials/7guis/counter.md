# Task 1: Counter

This is the first of [The 7 Tasks from 7GUIs](https://eugenkiss.github.io/7guis/tasks#counter):

> _Challenge:_ Understanding the basic ideas of a language/toolkit.
>
> The task is to build a frame containing a label or read-only textfield T and a button B. Initially, the value in T is “0” and each click of B increases the value in T by one.
>
> Counter serves as a gentle introduction to the basics of the language, paradigm and toolkit for one of the simplest GUI applications imaginable. Thus, Counter reveals the required scaffolding and how the very basic features work together to build a GUI application. A good solution will have almost no scaffolding.

## Modeling

In this simple UI, there is only one finite state, which can be named `"active"`. The context, however, will contain the `count`, which represents the current count with an initial value of `0` and can be infinite. An `"INCREMENT"` event will trigger an update to the context which assigns a new value to `count` based on the current `context.count` value.

**States:**

- `"active"` - the state where counting is enabled

**Context:**

- `count` - the current count value

**Events:**

- `"INCREMENT"` - signals that the count should be increased by one

## Coding

```js
import { createMachine, assign } from 'xstate';

export const counterMachine = createMachine({
  initial: 'active',
  context: { count: 0 },
  states: {
    active: {
      on: {
        INCREMENT: {
          actions: assign({ count: (ctx) => ctx.count + 1 })
        }
      }
    }
  }
});
```

## Result

<iframe
  src="https://codesandbox.io/embed/7guis-counter-19d6v?fontsize=14&hidenavigation=1&theme=dark"
  style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
  title="7GUIs: Counter"
  allow="geolocation; microphone; camera; midi; vr; accelerometer; gyroscope; payment; ambient-light-sensor; encrypted-media; usb"
  sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
></iframe>
