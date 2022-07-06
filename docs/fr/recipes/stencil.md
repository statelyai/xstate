# Usage with Stencil

[Stencil](https://stenciljs.com/) web components work very well with XState.

### `src/helpers/toggle-machine.ts`

```js
import { createMachine } from "@xstate/fsm";

export const toggleMachine = createMachine<
  undefined,
  { type: "toggle" },
  { value: "active" | "inactive"; context: undefined }
>({
  id: "toggle",
  initial: "active",
  states: {
    inactive: { on: { toggle: "active" } },
    active: { on: { toggle: "inactive" } }
  }
});
```

### `src/components/toggle/toggle.tsx`

Add a `state` property to your component, decorated with `@State` so that it triggers a re-render when changed.

On `componentWillLoad`, interpret the `toggleMachine` and listen for state transitions.

After a transition has occured, the `state` property is set to the machine's new state, triggering a re-render.

```js
import { Component, h, State } from "@stencil/core";
import { interpret } from "@xstate/fsm";
import { toggleMachine } from "../helpers/toggle-machine";

@Component({
  tag: "my-toggle",
  styleUrl: "toggle.css",
  shadow: true
})
export class Toggle {
  private _service = interpret(toggleMachine);

  @State() state = toggleMachine.initialState;

  componentWillLoad() {
    this._service.subscribe(state => {
      this.state = state;
    });

    this._service.start();
  }

  disconnectedCallback() {
    this._service.stop();
  }

  render() {
    const { send } = this._service;

    return (
      <button onClick={() => send("toggle")}>
        {this.state.value === "inactive" ? "Off" : "On"}
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
