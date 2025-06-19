---
'@xstate/store': minor
---

The `useAtom` hook is now available for reading the value of an atom or selecting a value from the atom.

```tsx
const atom = createAtom(0);

const Component = () => {
  const count = useAtom(atom);

  return (
    <>
      <div onClick={() => atom.set((c) => c + 1)}>{count}</div>
      <button onClick={() => atom.set(0)}>Reset</button>
    </>
  );
};
```

With selectors:

```tsx
const atom = createAtom({ count: 0 });

const Component = () => {
  const count = useAtom(atom, (s) => s.count);

  return <div>{count}</div>;
};
```
