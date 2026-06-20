if (!/pnpm\/11/.test(process.env.npm_config_user_agent)) {
  throw new Error('Please use `pnpm@^11` for installs.');
}
