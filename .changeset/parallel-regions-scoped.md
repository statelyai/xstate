---
'xstate': patch
---

Parallel-state transitions no longer disturb sibling regions:

- A transition targeting a state inside one region no longer exits and resets sibling regions (#5214). Its domain narrows to the region that contains all of its targets:

  ```ts
  const machine = createMachine({
    id: 'p',
    type: 'parallel',
    on: {
      ARCHIVE: { target: '#p.phase.archive' }
    },
    states: {
      phase: { initial: 'inquiry', states: { inquiry: {}, archive: {} } },
      mode: { initial: 'new', states: { new: {}, edit: {} } }
    }
  });
  // sending ARCHIVE now leaves `mode` in its current state
  ```

- A cross-region transition (source in one region, target in another) now only exits the region containing its targets. The source region and other sibling regions stay in their current states:

  ```ts
  // from Operation.Waiting:
  on: {
    TOGGLE_MODE: { target: '#Demo' } // in the Mode region
  }
  // sending TOGGLE_MODE enters Mode.Demo without exiting Operation
  ```

  Use `reenter: true` to opt into exiting the full transition domain.

- A `reenter: true` transition contained within one region exits and reenters only that region — sibling regions no longer re-run their entry actions (#5162).

- A transition sourced in a `final` state now yields to a conflicting transition from a live sibling region instead of preempting it, so a done region no longer swallows events its siblings can still handle (#4793).
