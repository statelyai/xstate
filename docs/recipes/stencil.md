# Usage with Stencil

[Stencil](https://stenciljs.com/) web components work very well with XState.

### `src/helpers/toggle-machine.ts`

```js
import { createMachine } from "@xstate/fsm"

// this machine is completely decoupled from stencil
export const toggleMachine = createMachine({
  id: "toggle",
  initial: "inactive",
  states: {
    inactive: {
      on: { toggle: "active" }
    },
    active: {
      on: { toggle: "inactive" }
    }
  }
});
```

### components/toggle/toggle.tsx

Add a `state` property to your component, decorated with `@State` so that it triggers a re-render when changed.

On `componentWillLoad`, interpret the `toggleMachine` and listen for state transitions.

After a transition has occured, the `state` property is set to the machine's new state, triggering a re-render.

```js
import { Component, h, State, Prop } from "@stencil/core";
import { interpret } from "xstate";
import { toggleMachine } from "../helpers/toggle-machine";


@Component({
  tag: "my-toggle",
  styleUrl: "toggle.css",
  shadow: true
})
export class Toggle {
  @State() state;

  private _service;

  componentWillLoad() {
    this._service = interpret(toggleMachine).onTransition(current => {
      this.state = { current };
    });

    this._service.start();
  }

  componentDidUnload() {
    this._service.stop();
  }

  render() {
    const { current } = this.state;
    const { send } = this._service;

    return (
      <button onClick={() => send("toggle")}>
        {current.matches("inactive") ? "Off" : "On"}
      </button>
    );
  }
}
```

Your html page:

```html
<html>
  <head>
    <script type="module" src="/build/my-toggle.esm.js"></script>
    <script nomodule src="/build/my-toggle.js"></script>
  </head>
  <body>
    <my-toggle></my-toggle>
  </body>
</html>
```
