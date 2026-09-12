# Async onboarding subflow

<!-- sync:workflow.ts -->

A parent invokes an onboarding machine. The child asks for a name, uses it in a second prompt, and completes only after both replies. `createWorkflow(prompt)` injects the prompt boundary without opening a terminal during import. Each request receives an abort signal; stopping the parent cancels the active child prompt. Failures propagate to the parent.

<!-- sync:main.ts -->

From the repository root, install dependencies and run `pnpm build`, then `pnpm --dir examples/workflow-async-subflow start`. The CLI owns and closes its readline interface on completion, failure, EOF, or Ctrl-C. Typecheck with `pnpm --dir examples/workflow-async-subflow build`.

`workflow.test.ts` uses in-process prompts to verify sequencing, completion, cancellation, and errors. It runs through the root `pnpm check:examples` command. The example uses the workspace XState v6 alpha and static `types<T>()` schemas.
