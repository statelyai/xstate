# Internal Transitions

An internal transition is one that does not exit the parent state. For example, consider a machine that sets a paragraph of text to align `'left'`, `'right'`, `'center'`, or `'justify'`:

```js
const wordMachine = Machine({
  key: 'word',
  states: {
    direction: {
      initial: 'left',
      states: {
        left: {},
        right: {},
        center: {},
        justify: {}
      },
      on: {
        // internal transitions
        LEFT_CLICK: '.left',
        RIGHT_CLICK: '.right',
        CENTER_CLICK: '.center',
        JUSTIFY_CLICK: '.justify'
      }
    }
  }
});
```

The above machine will start in the `'direction.left'` state, and based on what is clicked, will internally transition to its other child states. This is much less verbose than specifying the transitions on each child state:

```js
// ...
      states: {
        left: {
          on: {
            LEFT_CLICK: 'left',
            RIGHT_CLICK: 'right',
            CENTER_CLICK: 'center',
            JUSTIFY_CLICK: 'justify'
          }
        },
        right: {
          on: {
            LEFT_CLICK: 'left',
            RIGHT_CLICK: 'right',
            CENTER_CLICK: 'center',
            JUSTIFY_CLICK: 'justify'
          }
        },
        // ... etc.
      },
// ...
```

Also, since the transitions are internal, `onEntry` and `onExit` actions defined on the parent state node are not executed again.

Alternatively, the internal transition can be made explicit using a transition config with the `internal` property set to `true`:

```js
// ...
      on: {
        // internal transitions, equivalent to the first example
        LEFT_CLICK: { target: 'direction.left', internal: true },
        RIGHT_CLICK: { target: 'direction.right', internal: true },
        CENTER_CLICK: { target: 'direction.center', internal: true },
        JUSTIFY_CLICK: { target: 'direction.justify', internal: true }
      }
// ...
```

By default, transitions are external, so a normal transition:

```js
// ...
      on: {
        // external transition
        LEFT_CLICK: 'direction.left',
        // ...
      }
// ...
```

will execute the `onExit` and `onEntry` actions of the parent state again.
