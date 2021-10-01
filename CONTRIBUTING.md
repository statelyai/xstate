# Contributing

Thank you for your interest in contributing to XState! This project is made possible by contributors like you, and we welcome any contributions to the code base and the documentation.

## Environment

### Local `xstate-monorepo` clone and install

To setup a local development environment for XState

    NOTE: These instructions are for V5 that now uses yarn as the package manager

1. Ensure you have the latest version of Node and Yarn.
2. Clone an xstate repo locally and checkout appropriate branch (for V5 `git checkout next`) - (see making changes)
3. Run `yarn` to install all needed dev dependencies for the xstate-monorepo.

eg:

```bash
XSTATE_LOCAL_DEV="/workspaces/xstate-dev-local" #where the local xstate-monorepo is located
XSTATE_BRANCH="next" # change to the appropriate branch required
GIT_USER="statelyai" # change to the appropriate fork
git clone https://github.com/$GIT_USER/xstate.git XSTATE_LOCAL_DEV
cd $XSTATE_LOCAL_DEV
git checkout $XSTATE_BRANCH
yarn
```

### Project use of local development `xstate-monorepo`

Should you want to develop a project against this XState development environment do
`yarn add link:<YOUR_LOCAL_CLONED_ROOT>/packages/core` which installs a symlink to the xstate core in you local development package, This is on your local file system as above

eg:

```bash
#Execute these in a root project folder
XSTATE_LOCAL_DEV="/workspaces/xstate-dev-local" #where the local xstate-monorepo is located
MY_PROJECT="myFirstXStatePrj"
mkdir $MY_PROJECT
cd $MY_PROJECT
yarn init -y
# Link in the
yarn add link:$XSTATE_LOCAL_DEV/packages/core # link to the local xstate-monorepo core
# make an example node script
echo "
import pkg from 'xstate';
const { createMachine, interpret } = pkg;
const lightMachine = createMachine({
    id: 'light',
    initial: 'green',
    states: {
      green: { on: { TIMER: 'yellow' } },
      yellow: { on: { TIMER: 'red' } },
      red: {
        initial: 'walk',
        states: {
          walk: {},
          wait: {},
          stop: {}
        },
        on: {
          TIMER: [
            {
              target: 'green',
              in: { red: 'stop' }
            }
          ]
        }
      }
    }
  });

const walkState = lightMachine.transition('red.walk', 'TIMER');
console.log(walkState);
" > example1.mjs
#execute this example script
node example1.mjs
```

## Making Changes

Pull requests are encouraged. If you want to add a feature or fix a bug:

1. [Fork](https://docs.github.com/en/github/getting-started-with-github/fork-a-repo) and [clone](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/cloning-a-repository) the [repository](https://github.com/davidkpiano/xstate)
2. [Create a separate branch](https://docs.github.com/en/desktop/contributing-and-collaborating-using-github-desktop/managing-branches) for your changes
3. Make your changes, and ensure that it is formatted by [Prettier](https://prettier.io) and type-checks without errors in [TypeScript](https://www.typescriptlang.org/)
4. Write tests that validate your change and/or fix.
5. Run `yarn build` and then run tests with `yarn test` (for all packages) or `yarn test:core` (for only changes to core XState).
6. For package changes, add docs inside the `/packages/*/README.md`. They will be copied on build to the corresponding `/docs/packages/*/index.md` file.
7. Create a changeset by running `yarn changeset`. [More info](https://github.com/atlassian/changesets).
8. Push your branch and open a PR 🚀

PRs are reviewed promptly and merged in within a day or two (or even within an hour), if everything looks good.

## Setup

###

### Building

We are using [preconstruct](https://preconstruct.tools/) to build our packages. It comes with a handy trick which allows us to always use source files of packages contained in this monorepo. It creates hook/redirecting files in place of dist files during development. This always happens after installing packages (during `postinstall` step) and you shouldn't be worried about it, but if you actually build packages you destroy those redirecting files and to run tests, typechecking etc correctly you need to bring them back by running `yarn postinstall`.

### Publishing

We are using [changesets](https://github.com/atlassian/changesets) to create "release intents" for our packages. When those pop up on master a release PR gets prepared automatically and once it gets merged actual release happen (also automatically).
