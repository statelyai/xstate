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

| Example | Framework | Guards | Parallel | Invoke | Spawn | Delays | Persistence | Store | UI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 7guis-1-counter-vue | Vue | — | — | — | — | — | — | — | yes |
| 7guis-2-temperature-vue | Vue | yes | — | — | — | — | — | — | yes |
| 7guis-counter-react | React | — | — | — | — | — | — | — | yes |
| 7guis-flight-booker-react | React | yes | — | yes | — | — | — | — | yes |
| 7guis-temperature-react | React | — | — | — | — | — | — | — | yes |
| counter | Vanilla + Vite | — | — | — | — | — | — | — | yes |
| express-workflow | Express | — | — | — | — | — | yes | — | no |
| fetch | Vanilla + Vite | — | — | yes | — | yes | — | — | yes |
| friends-list-react | React | — | — | yes | yes | — | — | — | yes |
| local-store-counter-react | React | — | — | — | — | — | — | yes | yes |
| mongodb-credit-check-api | Express | yes | yes | yes | — | — | yes | — | no |
| mongodb-persisted-state | Vanilla + Vite | — | yes | — | — | — | yes | — | yes |
| persisted-donut-maker | Vanilla + Vite | — | yes | — | — | — | yes | — | yes |
| snake-react | React | yes | — | yes | — | — | — | — | yes |
| stopwatch | Vanilla + Vite | — | — | yes | — | — | — | — | yes |
| store-counter-react | React | — | — | — | — | — | — | yes | yes |
| store-tic-tac-toe | React | — | — | — | — | — | — | yes | yes |
| tic-tac-toe-react | React | yes | — | — | — | — | — | — | yes |
| tiles | React | yes | — | — | — | — | — | — | yes |
| timer | React | — | — | yes | — | — | — | — | yes |
| todomvc-react | React | — | — | — | — | — | yes | — | yes |
| toggle | Vanilla + Vite | — | — | — | — | — | — | — | yes |
| trivia-game-example | React | yes | — | yes | — | — | — | — | yes |
| workflow-accumulate-room-readings | Node | — | — | yes | — | yes | — | — | no |
| workflow-applicant-request | Node | yes | — | yes | — | — | — | — | no |
| workflow-async-function | Node | — | — | yes | — | — | — | — | no |
| workflow-async-subflow | Node | — | — | yes | — | — | — | — | no |
| workflow-book-lending | Node | — | — | yes | — | yes | — | — | no |
| workflow-car-auction-bids | Node | — | — | — | — | yes | — | — | no |
| workflow-car-vitals | Node | — | — | yes | — | yes | — | — | no |
| workflow-check-inbox | Node | — | — | yes | — | — | — | — | no |
| workflow-credit-check | Node | — | — | yes | — | yes | — | — | no |
| workflow-event-based | Node | — | — | yes | — | yes | — | — | no |
| workflow-event-based-service | Node | — | — | yes | — | — | — | — | no |
| workflow-event-greeting | Node | — | — | yes | — | — | — | — | no |
| workflow-filling-water | Node | — | — | — | — | yes | — | — | no |
| workflow-finalize-college-app | Node | — | — | yes | — | — | — | — | no |
| workflow-greeting | Node | — | — | yes | — | — | — | — | no |
| workflow-hello | Node | — | — | — | — | — | — | — | no |
| workflow-math-problem | Node | — | — | yes | — | — | — | — | no |
| workflow-media-scanner | Node | — | — | yes | — | — | — | — | no |
| workflow-monitor-job | Node | — | — | yes | — | yes | — | — | no |
| workflow-monitor-patient | Node | — | — | — | — | — | — | — | no |
| workflow-new-patient-onboarding | Node | — | — | yes | — | — | — | — | no |
| workflow-parallel | Node | — | yes | yes | — | — | — | — | no |
| workflow-provision-orders | Node | — | — | yes | — | — | — | — | no |
| workflow-purchase-order-deadline | Node | — | — | yes | — | yes | — | — | no |
| workflow-reusing-functions | Node | yes | — | yes | — | — | — | — | no |
| workflow-send-cloudevent | Node | — | — | yes | — | — | — | — | no |

[`_shared/`](./_shared) is not an example. It holds the `actor-ui` dashboard that headless examples can use instead of writing their own UI.
