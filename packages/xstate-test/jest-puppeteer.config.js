// jest-puppeteer.config.js
module.exports = {
  launch: {
    dumpio: true,
    headless: false,
    slowMo: 50
  },
  browserContext: 'default'
};
