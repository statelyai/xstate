if (!/pnpm\/9/.test(process.env.npm_config_user_agent)) {
  throw new Error('Please use `pnpm@^9` for installs.');
}
