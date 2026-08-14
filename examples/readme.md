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
| auth-flow-react                 | React          | —      | —        | yes    | —     | yes    | —           | —     | yes |
| signup-wizard-react             | React          | yes    | —        | yes    | —     | —      | —           | —     | yes |
| form-validation-react           | React          | —      | yes      | yes    | —     | yes    | —           | —     | yes |
| checkout-react                  | React          | yes    | —        | yes    | —     | —      | —           | —     | yes |
| payment-retry-react             | React          | yes    | —        | yes    | —     | yes    | —           | —     | yes |
| settings-persistence-react      | React          | —      | —        | yes    | —     | —      | yes         | —     | yes |
| router-sync-react               | React          | —      | —        | yes    | —     | —      | —           | —     | yes |
| onboarding-tour-react           | React          | yes    | —        | —      | —     | yes    | yes         | —     | yes |
| video-player-react              | React          | yes    | —        | yes    | —     | yes    | —           | —     | yes |
| audio-player-react              | React          | yes    | —        | yes    | —     | —      | —           | —     | yes |
| search-autocomplete-react       | React          | yes    | —        | yes    | —     | yes    | —           | —     | yes |
| infinite-scroll-react           | React          | yes    | —        | yes    | —     | —      | —           | —     | yes |
| file-upload-react               | React          | yes    | —        | yes    | yes   | —      | —           | —     | yes |
| drag-and-drop-react             | React          | yes    | —        | —      | —     | —      | —           | —     | yes |
| undo-redo-react                 | React          | yes    | —        | —      | —     | yes    | —           | —     | yes |
| notifications-react             | React          | —      | —        | —      | yes   | yes    | —           | —     | yes |
| modal-manager-react             | React          | yes    | —        | —      | —     | —      | —           | —     | yes |
| traffic-light                   | Vanilla + Vite | —      | yes      | —      | —     | yes    | —           | —     | yes |
| elevator                        | Vanilla + Vite | yes    | —        | —      | —     | yes    | —           | —     | yes |
| vending-machine                 | Vanilla + Vite | yes    | —        | —      | —     | yes    | —           | —     | yes |
| quiz-react                      | React          | —      | —        | yes    | —     | yes    | —           | —     | yes |
| booking-calendar-react          | React          | yes    | —        | yes    | —     | yes    | —           | —     | yes |
| queue-worker                    | Node           | yes    | —        | yes    | yes   | yes    | —           | —     | no  |
| saga-order-fulfillment          | Node           | —      | —        | yes    | —     | —      | —           | —     | no  |
| webhook-processor               | Node           | yes    | —        | yes    | —     | —      | —           | —     | no  |
| rate-limiter                    | Node           | yes    | —        | —      | —     | yes    | —           | —     | no  |
| cron-scheduler                  | Node           | —      | —        | —      | yes   | yes    | —           | —     | no  |
| inventory-reservation           | Node           | yes    | —        | —      | yes   | yes    | —           | —     | no  |
| connection-manager              | Node           | yes    | —        | yes    | —     | yes    | —           | —     | no  |
| toggle-svelte                   | Svelte         | —      | —        | —      | —     | yes    | —           | —     | yes |
| form-wizard-svelte              | Svelte         | yes    | —        | —      | —     | —      | —           | —     | yes |
| store-svelte                    | Svelte         | —      | —        | —      | —     | —      | —           | yes   | yes |
| auth-flow-vue                   | Vue            | —      | —        | yes    | —     | yes    | —           | —     | yes |
| store-vue                       | Vue            | —      | —        | —      | —     | —      | —           | yes   | yes |
| toggle-solid                    | Solid          | —      | —        | —      | —     | —      | —           | —     | yes |
| rxjs-observable-actor           | Node + RxJS    | —      | —        | yes    | —     | —      | —           | —     | no  |
| websocket-server                | Node + ws      | —      | —        | —      | yes   | yes    | —           | —     | no  |
| kyc-approval-api                | Node + Express | —      | yes      | yes    | —     | —      | yes         | —     | no  |
| email-drip-campaign             | Node           | yes    | —        | yes    | —     | yes    | —           | —     | no  |
| document-collab-sync            | Node           | yes    | —        | —      | —     | —      | —           | —     | no  |
| postgres-persisted-actor        | Node + pg      | yes    | —        | —      | —     | —      | yes         | —     | no  |
| redis-persisted-actor           | Node + redis   | yes    | —        | —      | —     | —      | yes         | —     | no  |
| cloudflare-worker-actor         | Cloudflare Workers | —    | —        | —      | —     | —      | yes         | —     | no  |
| aws-lambda-step-machine         | AWS Lambda     | yes    | —        | —      | —     | —      | yes         | —     | no  |
| nextjs-app-router               | Next.js        | yes    | —        | —      | —     | —      | yes         | —     | yes |
| history-states                  | Vanilla + Vite | —      | —        | —      | —     | —      | —           | —     | yes |
| machine-input-output            | Node           | yes    | —        | yes    | —     | —      | —           | —     | no  |
| unit-testing-machines           | Node + Vitest  | yes    | —        | yes    | —     | yes    | —           | —     | no  |
| model-based-testing             | Node + Vitest  | yes    | —        | —      | —     | —      | —           | —     | no  |
| store-atoms                     | React          | —      | —        | —      | —     | —      | —           | yes   | yes |
| store-undo-redo                 | React          | —      | —        | —      | —     | —      | —           | yes   | yes |
| actor-system                    | Node           | —      | —        | yes    | —     | —      | —           | —     | no  |
| v5-to-v6-migration              | Node           | yes    | —        | yes    | —     | —      | —           | —     | no  |
| actor-ui-dashboard              | Vanilla + Vite | yes    | —        | yes    | —     | yes    | —           | —     | yes |

[`_shared/`](./_shared) is not an example. It holds the `actor-ui` dashboard that headless examples can use instead of writing their own UI.
