var Hath = require('hath');
var callbackApiSuite = require('./callback-api.test');
var promiseApiSuite = require('./promise-api.test');
var report = require('hath-report-spec');

module.exports = Hath.suite('Marv Tests', [
  callbackApiSuite,
  promiseApiSuite,
]);

if (module === require.main) {
  module.exports(new Hath(report));
}
