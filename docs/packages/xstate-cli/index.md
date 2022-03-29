# @xstate/cli

The [@xstate/cli package](https://github.com/statelyai/xstate-tools/tree/master/apps/cli) contains commands for running typegen. It's pretty small right now, but we're planning on adding many cool features.

## Installation

- Run `npm install @xstate/cli`

## Commands

### `xstate typegen <files>`

`xstate typegen "src/**/*.ts?(x)"`

Run the typegen against a glob. This will scan every file targeted, and generate a typegen file accompanying it. It will also import the typegen into your file, as described in [our typegen documentation](https://xstate.js.org/docs/guides/typescript.html#typegen-with-the-vscode-extension).

> Ensure you wrap your glob in quotes so that it executes correctly. If it isn't wrapped in quotes, it will be interpreted as a list of files, not a glob. This will give unexpected results.

#### Options

`xstate typegen "src/**/*.ts?(x)" --watch`

Runs the task on a watch, monitoring for changed files and running the typegen script against them.
