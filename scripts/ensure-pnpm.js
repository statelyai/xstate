if (!/pnpm\/10/.test(process.env.npm_config_user_agent)) {
  throw new Error('Please use `pnpm@^10` for installs.');
}
