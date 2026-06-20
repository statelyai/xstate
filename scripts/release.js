// Publishes all public packages with the correct npm dist-tag.
//
// During a changesets pre-release (`.changeset/pre.json` with mode "pre"), every
// bumped package gets a prerelease version, so they MUST publish under the pre
// tag (e.g. "alpha") rather than "latest". Plain `pnpm -r publish` defaults to
// "latest", which would hijack the stable tag and point `npm install <pkg>` at a
// prerelease. We derive the tag from pre.json so prereleases never touch latest.

const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const prePath = join(__dirname, '..', '.changeset', 'pre.json');
let tag = 'latest';
if (existsSync(prePath)) {
  const pre = JSON.parse(readFileSync(prePath, 'utf8'));
  if (pre.mode === 'pre' && pre.tag) {
    tag = pre.tag;
  }
}

const run = (cmd, args) => {
  console.log(`$ ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

console.log(`Publishing with dist-tag "${tag}"`);
run('pnpm', [
  '-r',
  'publish',
  '--access=public',
  '--no-git-checks',
  '--tag',
  tag
]);
run('pnpm', ['exec', 'changeset', 'tag']);
