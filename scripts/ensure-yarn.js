if (!/yarn\//.test(process.env.npm_config_user_agent)) {
  throw new Error('Please use `yarn` for installs.');
}
