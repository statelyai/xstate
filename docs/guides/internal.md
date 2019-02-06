# Internal Transitions

An internal transition is one that does not exit its state node. For example, consider a machine that sets a paragraph of text to align `'left'`, `'right'`, `'center'`, or `'justify'`:

```js
import { Machine } from 'xstate';

const wordMachine = Machine({
  id: 'direction',
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
});
```

The above machine will start in the `'left'` state (for reference, the full path is `'#direction.left'`), and based on what is clicked, will internally transition to its other child states. Also, since the transitions are internal, `onEntry`, `onExit` or any of the `actions` defined on the parent state node are not executed again.

Alternatively, the internal transition can be made explicit using a transition config with the `internal` property set to `true`:

```js
// ...
states: {
  // ...
},
on: {
  // internal transitions, equivalent to the first example
  LEFT_CLICK: { target: '.left', internal: true },
  RIGHT_CLICK: { target: '.right', internal: true },
  CENTER_CLICK: { target: '.center', internal: true },
  JUSTIFY_CLICK: { target: '.justify', internal: true }
}
// ...
```

By default, transitions are external, so a normal transition:

```js
// ...
on: {
  // external transition
  LEFT_CLICK: 'left',
  RIGHT_CLICK: 'right',
  // ...
}
// ...
```

will execute the `onExit` and `onEntry` actions of the parent state again.
