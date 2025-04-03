---
'@xstate/store': minor
---

- Improved atom architecture with better dependency management (the diamond problem is solved!)
- Optimized recomputation logic to prevent unnecessary updates
- Added support for custom equality functions through `compare` option in `createAtom`, allowing fine-grained control over when atoms update:

  ```ts
  const coordinateAtom = createAtom(
    { x: 0, y: 0 },
    {
      // only update when x and y change
      compare: (prev, next) => prev.x === next.x && prev.y === next.y
    }
  );
  ```
