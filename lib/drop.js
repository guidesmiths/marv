const async = require('async');
const debug = require('debug')('marv:drop');
const invoke = require('./driver');

module.exports = function drop(driver, cb) {
  async.seq(
    connect,
    dropMigrationsTable,
  )((err) => {
    disconnect((disconnectErr) => {
      cb(err || disconnectErr);
    });
  });

  function connect(cb) {
    debug('Connecting to database');
    invoke(driver, 'connect', guard(cb));
  }

  function dropMigrationsTable(cb) {
    debug('Dropping migrations table');
    invoke(driver, 'dropMigrations', guard(cb));
  }

  function disconnect(cb) {
    debug('Disconnecting from database');
    invoke(driver, 'disconnect', guard(cb));
  }

  function guard(cb) {
    return (err) => {
      cb(err);
    };
  }
};
