---
'@xstate/store': minor
---

Added `createAtom()` for creating reactive atoms that can be combined with other atoms and stores:

- Create simple atoms with initial values:

  ```ts
  import { createAtom } from '@xstate/store';

  const countAtom = createAtom(0);
  countAtom.get(); // 0
  countAtom.set(1); // or use setter function: (prev) => prev + 1
  ```

- Subscribe to atom changes:

  ```ts
  countAtom.subscribe((value) => console.log(value));
  ```

- Combine multiple atoms:

  ```ts
  const nameAtom = createAtom('hello');
  const countAtom = createAtom(3);
  const combinedAtom = createAtom((read) =>
    read(nameAtom).repeat(read(countAtom))
  );
  combinedAtom.get(); // "hellohellohello"
  ```

- Seamlessly combine atoms with stores:

  ```ts
  const countAtom = createAtom(0);
  const nameStore = createStore({
    context: { name: 'David' }
    // ... store config
  });

  const combinedAtom = createAtom(
    (read) => read(nameStore).context.name + ` ${read(countAtom)}`
  );
  combinedAtom.get(); // "David 0"
  ```

Atoms automatically update when their dependencies change, making it easy to create derived state from both atoms and stores.
