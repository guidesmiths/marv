const async = require('async');
const debug = require('debug')('marv:drop');

module.exports = function drop(driver, cb) {

  async.seq(connect, drop)((err) => {
    disconnect((disconnectErr) => {
      cb(err || disconnectErr);
    });
  });

  function connect(cb) {
    debug('Connecting to database');
    driver.connect(guard(cb));
  }

  function drop(cb) {
    debug('Dropping migrations table');
    driver.dropMigrations(guard(cb));
  }

  function disconnect(cb) {
    debug('Disconnecting from database');
    driver.disconnect(guard(cb));
  }

  function guard(cb) {
    return function(err) {
      cb(err);
    };
  }
};
