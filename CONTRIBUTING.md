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

- Ensure you have the latest version of Node and Yarn.
- Run `yarn` to install all needed dev dependencies.

## Making changes

Pull requests are encouraged. If you want to add a feature or fix a bug:

1. [Fork](https://docs.github.com/en/github/getting-started-with-github/fork-a-repo) and [clone](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/cloning-a-repository) the [repository](https://github.com/statelyai/xstate).
2. [Create a separate branch](https://docs.github.com/en/desktop/contributing-and-collaborating-using-github-desktop/managing-branches) for your changes.
3. Make your changes, and ensure that it is formatted by [Prettier](https://prettier.io) and type-checks without errors in [TypeScript](https://www.typescriptlang.org/).
4. Write tests that validate your change and/or fix.
5. Run `yarn build` and then run tests with `yarn test` (for all packages) or `yarn test:core` (for only changes to core XState).
6. For package changes, add docs inside the `/packages/*/README.md`. These docs will be copied on build to the corresponding `/docs/packages/*/index.md` file.
7. Create a changeset by running `yarn changeset`. [More about changesets](https://github.com/atlassian/changesets).
8. Push your branch and open a PR 🚀

PRs are reviewed promptly and merged in within a day or two (or even within an hour) if everything looks good.

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

We are using [preconstruct](https://preconstruct.tools/) to build our packages. It comes with a handy trick which allows us to always use source files of packages contained in this monorepo. It creates hook/redirecting files in place of dist files during development. This always happens after installing packages (during `postinstall` step) and you shouldn't be worried about it, but if you actually build packages you destroy those redirecting files and to run tests, typechecking etc correctly you need to bring them back by running `yarn postinstall`.

### Publishing

We are using [changesets](https://github.com/atlassian/changesets) to create "release intents" for our packages. When those pop up on master a release PR gets prepared automatically and once it gets merged actual release happen (also automatically).
