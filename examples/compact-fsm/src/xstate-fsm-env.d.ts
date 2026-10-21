// Workaround for a real gap in the alpha: the `Symbol.observable` global
// augmentation that `xstate`'s type surface relies on is declared only in
// `packages/core/src/index.ts`, but `xstate/fsm`'s types still reach
// `packages/core/src/types.ts`, which uses `Symbol.observable`. An example that
// imports *only* `xstate/fsm` therefore fails to typecheck against the
// workspace sources. Remove this file once the augmentation moves somewhere
// both entry points include.
declare global {
  interface SymbolConstructor {
    readonly observable: symbol;
  }
}

export {};
