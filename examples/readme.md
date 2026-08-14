# XState examples

Small, self-contained examples that run against the XState packages in this repo. Each example is a pnpm workspace package.

## Running an example

```bash
pnpm install
cd examples/<example-name>
pnpm dev # or `pnpm start` for backend examples
```

Every example depends on the local packages via `workspace:*`, so changes you make in `packages/` are picked up without publishing.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before adding an example. It covers naming, pinned dependency versions, required README sections, XState v6 style rules, and inspector wiring.

## Coverage matrix

Features per example. `—` means not used or not determined.

| Example                         | Framework      | Guards | Parallel | Invoke | Spawn | Delays | Persistence | Store | UI  |
| ------------------------------- | -------------- | ------ | -------- | ------ | ----- | ------ | ----------- | ----- | --- |
| 7guis-counter-react             | React          | —      | —        | —      | —     | —      | —           | —     | yes |
| 7guis-counter-vue               | Vue            | —      | —        | —      | —     | —      | —           | —     | yes |
| 7guis-flight-booker-react       | React          | yes    | —        | yes    | —     | —      | —           | —     | yes |
| 7guis-temperature-react         | React          | —      | —        | —      | —     | —      | —           | —     | yes |
| 7guis-temperature-vue           | Vue            | —      | —        | —      | —     | —      | —           | —     | yes |
| agent-chatbot-conversation      | Node           | —      | —        | yes    | —     | yes    | —           | —     | no  |
| agent-memory                    | Node           | —      | —        | yes    | —     | —      | —           | —     | no  |
| agent-streaming-response        | Node           | —      | —        | yes    | —     | yes    | —           | —     | no  |
| agent-structured-output         | Node           | —      | —        | yes    | —     | —      | —           | —     | no  |
| counter                         | Vanilla + Vite | —      | —        | —      | —     | —      | —           | —     | yes |
| express-workflow                | Express        | —      | —        | —      | —     | —      | yes         | —     | no  |
| fetch                           | Vanilla + Vite | —      | —        | yes    | —     | yes    | —           | —     | yes |
| friends-list-react              | React          | —      | —        | yes    | yes   | —      | —           | —     | yes |
| mongodb-credit-check-api        | Express        | yes    | yes      | yes    | —     | —      | yes         | —     | no  |
| mongodb-persisted-state         | Vanilla + Vite | —      | yes      | —      | —     | —      | yes         | —     | yes |
| pattern-deadline-timeout        | Node           | —      | —        | yes    | —     | yes    | —           | —     | no  |
| pattern-event-accumulation      | Node           | —      | —        | —      | —     | yes    | —           | —     | no  |
| pattern-long-running-approval   | Node           | —      | —        | yes    | —     | yes    | —           | —     | no  |
| pattern-parallel-branches       | Node           | —      | yes      | yes    | —     | —      | —           | —     | no  |
| pattern-per-item-error-handling | Node           | —      | —        | yes    | yes   | —      | —           | —     | no  |
| pattern-polling                 | Node           | —      | —        | yes    | —     | yes    | —           | —     | no  |
| pattern-retry-policy            | Node           | yes    | —        | yes    | —     | yes    | —           | —     | no  |
| persisted-donut-maker           | Vanilla + Vite | —      | yes      | —      | —     | —      | yes         | —     | yes |
| snake-react                     | React          | yes    | —        | yes    | —     | —      | —           | —     | yes |
| stopwatch                       | Vanilla + Vite | —      | —        | yes    | —     | —      | —           | —     | yes |
| store-counter-react             | React          | —      | —        | —      | —     | —      | —           | yes   | yes |
| store-tic-tac-toe               | React          | —      | —        | —      | —     | —      | —           | yes   | yes |
| tic-tac-toe-react               | React          | yes    | —        | —      | —     | —      | —           | —     | yes |
| tiles                           | React          | yes    | —        | —      | —     | —      | —           | —     | yes |
| timer                           | React          | —      | —        | yes    | —     | —      | —           | —     | yes |
| todomvc-react                   | React          | —      | —        | —      | —     | —      | yes         | —     | yes |
| toggle                          | Vanilla + Vite | —      | —        | —      | —     | —      | —           | —     | yes |
| trivia-game-example             | React          | yes    | —        | yes    | —     | —      | —           | —     | yes |
| workflow-media-scanner          | Node           | —      | —        | yes    | —     | —      | —           | —     | no  |
| agent-tool-loop                 | Node           | yes    | —        | yes    | —     | —      | —           | —     | no  |
| agent-human-in-the-loop         | Node           | —      | —        | yes    | —     | yes    | —           | —     | no  |
| agent-multi-orchestrator        | Node           | —      | —        | yes    | yes   | —      | —           | —     | no  |
| agent-model-fallback            | Node           | yes    | —        | yes    | —     | yes    | —           | —     | no  |
| agent-rag-pipeline              | Node           | yes    | —        | yes    | —     | —      | —           | —     | no  |
| agent-voice-call                | Node           | yes    | —        | —      | —     | yes    | —           | —     | no  |
| agent-eval-harness              | Node           | yes    | —        | —      | —     | —      | —           | —     | no  |
| agent-mcp-server                | Node           | yes    | —        | yes    | yes   | —      | —           | —     | no  |

[`_shared/`](./_shared) is not an example. It holds the `actor-ui` dashboard that headless examples can use instead of writing their own UI.
