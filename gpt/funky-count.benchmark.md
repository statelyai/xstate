I would like to build a counting state machine that allows me to
increment and decrement the count with special behaviors at
specific thresholds.

When the count reaches three, the machine enforces a 400 ms wait before
allowing further increments; if the user attempts to increment during
this wait, the machine transitions to inverted count mode, incrementing when
decrement event is received and vice versa.

In reverse state, the user can hold the increment button for 2-seconds to reset
the behavior to normal

celebrates milestones when the count reaches 7

tests for all functionality
