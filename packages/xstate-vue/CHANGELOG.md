# @xstate/vue

## 0.2.0

### Minor Changes

- [`65c13245`](https://github.com/davidkpiano/xstate/commit/65c132458cdc73b242f9c0b22e61ba9ba7780509) [#1253](https://github.com/davidkpiano/xstate/pull/1253) Thanks [@darrenjennings](https://github.com/darrenjennings)! - Upgraded package for compatibility with the newest `@vue/composition-api@^0.6.0`, which means that a peer dependency requirement has changed to this version, which is a **breaking change**. The only observable behavior change is that exposed refs are now **shallow**.

## 0.1.1

### Patch Changes

- [`c057f38`](https://github.com/davidkpiano/xstate/commit/c057f38aa20d06501fd7e5893eef0d6688e547eb) [#976](https://github.com/davidkpiano/xstate/pull/976) Thanks [@Andarist](https://github.com/Andarist)! - Fixed issue with `useMachine` crashing without providing optional `options` parameter.

- Updated dependencies [[`520580b`](https://github.com/davidkpiano/xstate/commit/520580b4af597f7c83c329757ae972278c2d4494)]:
  - xstate@4.7.8
