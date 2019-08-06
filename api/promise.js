var promisify = require('util.promisify');
var callbackApi = require('./callback');

module.exports = {
  migrate: promisify(callbackApi.migrate),
  scan: promisify(callbackApi.scan),
  drop: promisify(callbackApi.drop),
  parseDirectives: require('../lib/parseDirectives'),
};
