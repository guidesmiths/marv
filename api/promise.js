const promisify = require('node:util').promisify;
const callbackApi = require('./callback');

module.exports = {
  migrate: promisify(callbackApi.migrate),
  scan: promisify(callbackApi.scan),
  drop: promisify(callbackApi.drop),
};
