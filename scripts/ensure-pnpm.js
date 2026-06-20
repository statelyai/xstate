// Guards against installing with the wrong package manager / pnpm version.
//
// The pinned version lives in the root `packageManager` field. The cleanest way
// to always get it is corepack (bundled with Node):
//
//   corepack enable
//
// corepack reads `packageManager` and selects the exact pnpm version for you, so
// this check only ever fires for environments without corepack enabled.

const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const { packageManager } = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf8')
);

const pinnedMajor = packageManager?.match(/^pnpm@(\d+)\./)?.[1];
const userAgent = process.env.npm_config_user_agent ?? '';
const currentMajor = userAgent.match(/pnpm\/(\d+)\./)?.[1];

if (pinnedMajor && currentMajor !== pinnedMajor) {
  const detected = userAgent.match(/(pnpm|npm|yarn)\/(\S+)/);
  throw new Error(
    `This repo requires pnpm@${pinnedMajor} (pinned via "packageManager": "${packageManager}").\n` +
      (detected
        ? `Detected ${detected[1]}@${detected[2]}.\n`
        : `No package manager detected.\n`) +
      'Run `corepack enable` once to have the correct pnpm selected automatically.'
  );
}
