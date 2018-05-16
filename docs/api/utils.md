## `matchesState(parentStateValue, childStateValue)`

Determines if the `childStateValue` matches (is contained by, or equal to) the `parentStateValue`.

**Arguments:**
- `parentStateValue`: the state value (or delimited string path) of the parent state value to match against
- `childStateValue`: the child state value (or delimited string path) of the state value to determine whether it is:
  - equal to the `parentStateValue`
  - or a child state value of the `parentStateValue`.

**Examples:**

Typically, you would pass the `.value` of the state you want to match into the function:

```js
import { matchesState } from 'xstate';

const nextState = machine.transition(/* ... */);

// Check if nextState is in 'a.b':
const isInDesiredState = matchesState('a.b', nextState.value);
```

Some equality examples: 

```js
matchesState('a', 'a'); // true
matchesState('b', 'b.b1'); // true
matchesState('b', { b: 'b1' }); // true
matchesState({ a: 'b' }, { a: 'b' }); // true
matchesState({ a: { b: 'c' } }, { a: { b: 'c' } }); // true
matchesState({ foo: 'bar' }, { foo: { bar: { baz: 'quo' } } }); // true
matchesState('b', { b: 'b1', c: 'c1' }); // true
matchesState('a.b.c', { a: { b: 'c' } }); // true

matchesState('a.a1', 'b.b1'); // false
matchesState('a.b.c', 'a.b'); // false
matchesState({ a: { b: { c: 'd' } } }, { a: 'b' }); // false
```
