# Contributing

Thank you for your interest in contributing to XState! Contributors like you make this project possible, and we welcome any contributions to the code base and the documentation.

There are several ways you can contribute to XState:

- 📥 [Submit an issue](#submit-an-issue)
- ✨ [Solve an issue or make a change](#making-changes)
- 🖊️ [Write documentation](https://github.com/statelyai/docs)
- 💬 [Respond to support questions in the GitHub discussions](https://github.com/statelyai/xstate/discussions)
- 🛟 [Respond to questions in the Help channel on Discord](https://discord.gg/xstate)

Please read [our code of conduct](https://github.com/statelyai/xstate/blob/main/CODE_OF_CONDUCT.md).

## Environment

- Use Node 22.18 or newer (CI uses Node 24).
- Run `corepack enable` once so the pnpm version pinned in `packageManager` is used automatically.
- Run `pnpm i` to install all needed dev dependencies.

## Making changes

Pull requests are encouraged. If you want to add a feature or fix a bug:

1. [Fork](https://docs.github.com/en/github/getting-started-with-github/fork-a-repo) and [clone](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/cloning-a-repository) the [repository](https://github.com/statelyai/xstate).
1. [Create a separate branch](https://docs.github.com/en/desktop/contributing-and-collaborating-using-github-desktop/managing-branches) for your changes.
1. Make your changes, and write tests that validate your change and/or fix.
1. Run `pnpm test` (for all packages) or `pnpm test:core` (for only changes to core XState).
1. Run `pnpm typecheck` to make sure that there are no type errors.
1. Create a changeset by running `pnpm changeset`. [More about changesets](https://github.com/atlassian/changesets).
1. Push your branch and open a PR 🚀

PRs are reviewed promptly and merged in within a day or two (or even within an hour) if everything looks good.

## Contributing an example

Our [examples](https://github.com/statelyai/xstate/tree/next/examples) are self-contained apps that show how to solve a common problem, integrate another framework (like Vue or Svelte) or build something fun with XState.

To contribute an example, please read the [`readme`](https://github.com/statelyai/xstate/blob/next/examples/readme.md) in the `/examples` folder.

## Submit an issue

Issues and bug reports are also encouraged. If you want to submit an issue:

1. Search [existing issues](https://github.com/statelyai/xstate/issues) to check if your issue already exists or has been solved.
2. [Create a new issue](https://github.com/statelyai/xstate/issues/new/choose) if your issue has not yet been submitted.
3. Ensure you fill out all the details in the issue template to help us understand the issue.

We’ll try to respond promptly and address your issue as soon as possible.

## Contributing to our docs

Our [new docs](https://stately.ai/docs) are now in their own [docs repo](https://github.com/statelyai/docs). [Read the contribution guide for our Stately Studio and XState docs](https://github.com/statelyai/docs/blob/main/CONTRIBUTING.md).

### Legacy docs and xstate.js.org

The docs at `/docs` in this repo are legacy XState docs. They are built using [Vuepress](https://vuepress.vuejs.org) and deployed to [xstate.js.org/docs](https://xstate.js.org/docs) using GitHub pages from the `gh-pages` branch using the `pages build and deployment` workflow.

The [xstate.js.org](https://xstate.js.org) landing page is currently stored at `index.html` and deployed from the `gh-pages` branch using the `pages build and deployment` workflow.

## Setup

### Building

We are using [preconstruct](https://preconstruct.tools/) to build our packages. It comes with a handy trick which allows us to always use source files of packages contained in this monorepo. It creates hook/redirecting files in place of dist files during development. This always happens after installing packages (during `postinstall` step) and you shouldn't be worried about it, but if you actually build packages you destroy those redirecting files and to run tests, typechecking etc correctly you need to bring them back by running `pnpm postinstall`.

### Bundle measurements

See [bundle measurements](docs/bundle-size.md) for source and production profiles, behavior verification, and CI size reports.

### Publishing

We are using [changesets](https://github.com/atlassian/changesets) to create "release intents" for our packages. The Publish workflow handles release intents on `main` and `next`; changes for the v6 alpha belong on `next`.


### Examples and development dependencies

<!-- Maintained check commands from package.json and scripts/check-*.js; fixture overrides from pnpm-workspace.yaml. -->

`pnpm check:examples` checks and builds the maintained v6 examples (`fetch`, `persisted-donut-maker`, and `snake-react`) and runs their regression tests. Run `pnpm build` first so standalone example compilers consume generated package declarations. `pnpm check:templates` installs and builds all four standalone starter templates with their own frozen lockfiles.

`node scripts/typecheck-examples.js` checks every example with a `tsconfig.json`; pass project names or paths to select examples. Any compiler failure exits nonzero. Legacy examples remain visible in this full inventory and may require v6 migration.

The pinned `@scion-scxml/test-framework@2.0.16` package supplies SCXML fixtures only. Its original fixture files and licensing remain intact; its unused HTTP runner dependencies are removed with scoped pnpm overrides. That runner is intentionally unavailable. Core SCXML tests read the fixtures directly. Happy DOM is a development-only test environment.

Full inventory after the v6 maintenance changes: 49 TypeScript projects, 7 passing and 42 failing. `examples/readme.md` has no project configuration and is skipped. The failures include older machine/event APIs, implicit types, framework types, and unused declarations; they are not included in the maintained CI selection.

| Status | Projects |
| --- | --- |
| Typecheck passes | `fetch`, `local-store-counter-react`, `persisted-donut-maker`, `snake-react`, `store-counter-react`, `store-tic-tac-toe`, `workflow-hello` |
| Legacy typecheck failures | `7guis-1-counter-vue`, `7guis-2-temperature-vue`, `7guis-counter-react`, `7guis-flight-booker-react`, `7guis-temperature-react`, `counter`, `express-workflow`, `friends-list-react`, `mongodb-credit-check-api`, `mongodb-persisted-state`, `stopwatch`, `tic-tac-toe-react`, `tiles`, `timer`, `todomvc-react`, `toggle`, `trivia-game-example`, `workflow-accumulate-room-readings`, `workflow-applicant-request`, `workflow-async-function`, `workflow-async-subflow`, `workflow-book-lending`, `workflow-car-auction-bids`, `workflow-car-vitals`, `workflow-check-inbox`, `workflow-credit-check`, `workflow-event-based`, `workflow-event-based-service`, `workflow-event-greeting`, `workflow-filling-water`, `workflow-finalize-college-app`, `workflow-greeting`, `workflow-math-problem`, `workflow-media-scanner`, `workflow-monitor-job`, `workflow-monitor-patient`, `workflow-new-patient-onboarding`, `workflow-parallel`, `workflow-provision-orders`, `workflow-purchase-order-deadline`, `workflow-reusing-functions`, `workflow-send-cloudevent` |
