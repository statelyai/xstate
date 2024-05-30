I would like to build a counting state machine that allows me to
increment and decrement the count with special behaviors at
specific thresholds.

When the count reaches three, it enforces a 400 ms wait before
allowing further increments; if I attempt to increment during
this wait, the increment behavior reverses to decrementing.

Additionally, it includes a 2-second hold feature to reset the
behavior to normal, celebrates milestones at specific counts,
incorporates random events that modify the count, and handles
invalid operations with an error state.
