# @xstate/angular

This package contains utilities for using [XState](https://github.com/statelyai/xstate) with [Angular](https://github.com/angular/angular).

- [Read the full documentation in the XState docs](https://stately.ai/docs/xstate-angular).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## Quick start

1. Install `xstate` and `@xstate/angular`:

```bash
npm i xstate @xstate/angular
```

2. Import the `useMachine` function:

```angular-ts
import { useMachine } from '@xstate/angular';
import { createMachine } from 'xstate';
import {Component, inject} from '@angular/core';

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      on: { TOGGLE: 'inactive' }
    }
  }
});

@Component({
  selector: 'app-toggle',
  standalone: true,
  imports: [],
  template: `<button (click)="toggleMachine.send({type: 'TOGGLE'})">
    {{
      toggleMachine.snapshot().value === 'inactive'
        ? 'Click to activate'
        : 'Active! Click to deactivate'
    }}
  </button>
  `,
  styleUrl: './toggle.component.css'
})
export class ToggleComponent {
  public toggleMachine = inject({providedIn: "root", }ToggleMachine);
}
```
