var path = require('path');
var _ = require('lodash');
const { strictEqual: eq, ok } = require('assert');

var marv = require('../api/callback');

describe('Callback API Test', () => {

  it('migration table is empty', (t, done) => {
    var driver = stubDriver();
    marv.migrate([
      { level: 1, script: 'meh' },
      { level: 2, script: 'meh' }
    ], driver, function(err) {
      if (err) return done(err);
      eq(driver.connected, true);
      eq(driver.ran.length, 2);
      eq(driver.ran[0].level, 1);
      eq(driver.ran[1].level, 2);
      eq(driver.disconnected, true);
      done();
    });
  });

  it('migration table is not empty', (t, done) => {
    var driver = stubDriver([
      { level: 1, script: 'meh' },
      { level: 2, script: 'meh' }
    ]);
    marv.migrate([
      { level: 1, script: 'meh' },
      { level: 2, script: 'meh' },
      { level: 3, script: 'meh' }
    ], driver, function(err) {
      if (err) return done(err);
      eq(driver.connected, true);
      eq(driver.ran.length, 1);
      eq(driver.ran[0].level, 3);
      eq(driver.disconnected, true);
      done();
    });
  });

  it('migration table is missing entries', (t, done) => {
    var driver = stubDriver([
      { level: 3, script: 'meh' }
    ]);
    marv.migrate([
      { level: 1, script: 'meh' },
      { level: 2, script: 'meh' },
      { level: 3, script: 'meh' },
      { level: 4, script: 'meh' },
      { level: 5, script: 'meh' }
    ], driver, function(err) {
      if (err) return done(err);
      eq(driver.connected, true);
      eq(driver.ran.length, 2);
      eq(driver.ran[0].level, 4);
      eq(driver.ran[1].level, 5);
      eq(driver.disconnected, true);
      done();
    });
  });

  it('defaults namespace to \'default\'', (t, done) => {
    var driver = stubDriver();
    marv.migrate([
      { level: 1, script: 'meh' },
      { level: 2, script: 'meh' }
    ], driver, function(err) {
      if (err) return done(err);
      eq(driver.ran[0].namespace, 'default');
      eq(driver.ran[1].namespace, 'default');
      done();
    });
  });

  it('namespaces are isolated', (t, done) => {
    var driver = stubDriver([
      { level: 1, script: 'meh' },
      { level: 1, script: 'meh', namespace: 'outer space' },
      { level: 2, script: 'meh', namespace: 'outer space' }
    ]);
    marv.migrate([
      { level: 2, script: 'meh', namespace: 'outer space' },
      { level: 3, script: 'meh', namespace: 'outer space' },
      { level: 1, script: 'meh', namespace: 'inner space' },
      { level: 2, script: 'meh', namespace: 'inner space' },
      { level: 2, script: 'meh' }
    ], driver, function(err) {
      if (err) return done(err);
      eq(driver.connected, true);
      eq(driver.ran.length, 4);
      eq(driver.ran[0].level, 3);
      eq(driver.ran[0].namespace, 'outer space');
      eq(driver.ran[1].level, 1);
      eq(driver.ran[1].namespace, 'inner space');
      eq(driver.ran[2].level, 2);
      eq(driver.ran[2].namespace, 'inner space');
      eq(driver.ran[3].level, 2);
      eq(driver.ran[3].namespace, 'default');
      eq(driver.disconnected, true);
      done();
    });
  });

  it('driver connection fails', (t, done) => {
    var driver = badConnectionDriver();
    marv.migrate([], driver, function(err) {
      ok(err);
      eq(err.message, 'Oh Noes');
      done();
    });
  });

  it('migration connection fails', (t, done) => {
    var driver = badMigrationDriver();
    marv.migrate([
      { level: 1, script: 'meh' },
      { level: 2, script: 'meh' }
    ], driver, function(err) {
      ok(err);
      eq(err.message, 'Oh Noes');
      eq(driver.connected, true);
      eq(driver.disconnected, true);
      done();
    });
  });

  it('scans directories', (t, done) => {
    marv.scan(path.join(__dirname, 'migrations'), function(err, migrations) {
      if (err) return done(err);
      eq(migrations.length, 4);
      eq(migrations[0].level, 1);
      eq(migrations[0].comment, 'test 1');
      eq(migrations[1].level, 2);
      eq(migrations[1].comment, 'test 2');
      eq(migrations[2].level, 3);
      eq(migrations[2].comment, 'test 3');
      eq(migrations[3].level, 4);
      eq(migrations[3].comment, 'test 4');
      done();
    });
  });

  it('scans directories with filter', (t, done) => {
    marv.scan(path.join(__dirname, 'migrations'), { filter: /\.sql$/ }, function(err, migrations) {
      if (err) return done(err);
      eq(migrations.length, 3);
      eq(migrations[0].level, 1);
      eq(migrations[0].comment, 'test 1');
      eq(migrations[1].level, 2);
      eq(migrations[1].comment, 'test 2');
      eq(migrations[2].level, 3);
      eq(migrations[2].comment, 'test 3');
      done();
    });
  });

  it('scans directories .marvrc', (t, done) => {
    marv.scan(path.join(__dirname, 'migrations-rc'), function(err, migrations) {
      if (err) return done(err);
      eq(migrations.length, 1);
      eq(migrations[0].level, 1);
      eq(migrations[0].directives.comment, 'marvrc is marvelous');
      eq(migrations[0].namespace, 'inner universe');
      done();
    });
  });

  it('reports migrations with duplicate levels', (t, done) => {
    marv.scan(path.join(__dirname, 'migrations-dupe'), function(err, migrations) {
      if (!err) return t.assert(err, 'Expected an error');
      eq(err.message, 'Found migrations with duplicate levels: 002.test-2.sql, 002.test-3.sql, 002.test-4.sql');
      done();
    });
  });

  it('drops migrations', (t, done) => {
    var driver = stubDriver();
    marv.drop(driver, function(err) {
      if (err) return done(err);
      eq(driver.dropped, true);
      done();
    });
  });

  it('decorates migrations', (t, done) => {
    marv.scan(path.join(__dirname, 'migrations'), { filter: /\.sql$/, directives: { audit: false } }, function(err, migrations) {
      if (err) return done(err);
      eq(migrations.length, 3);
      eq(migrations[0].level, 1);
      eq(migrations[0].directives.audit, false);
      eq(migrations[0].directives.foo, 'bar');
      eq(migrations[0].directives.meh, 'true');
      done();
    });
  });

  it('scans is backwards compatible', (t, done) => {
    marv.scan(path.join(__dirname, 'migrations'), { quiet: true, filter: /\.sql$/, migrations: { audit: false } }, function(err, migrations) {
      if (err) return done(err);
      eq(migrations.length, 3);
      eq(migrations[0].level, 1);
      eq(migrations[0].directives.audit, false);
      done();
    });
  });

  it('migrate is backwards compatible', (t, done) => {
    var driver = stubDriver();
    marv.migrate([
      { level: 1, script: 'meh', audit: false },
      { level: 1, script: 'meh', audit: false }
    ], driver, { quiet: true }, function(err) {
      if (err) return done(err);
      eq(driver.ran.length, 2);
      done();
    });
  });

  function stubDriver(existing) {
    var stored = _.map(existing, function(migration) {
      return _.assign({}, {namespace: 'default'}, migration);
    });

    return {
      connect: function(cb) {
        this.connected = true;
        return cb();
      },
      disconnect: function(cb) {
        this.disconnected = true;
        return cb();
      },
      dropMigrations: function(cb) {
        this.dropped = true;
        cb();
      },
      ensureMigrations: noop,
      lockMigrations: noop,
      unlockMigrations: noop,
      getMigrations: function(cb) {
        cb(null, stored || []);
      },
      runMigration: function(migration, cb) {
        this.ran = (this.ran || []).concat(migration);
        cb();
      }
    };
  }

  function badConnectionDriver() {
    return {
      connect: function(cb) {
        return cb(new Error('Oh Noes'));
      }
    };
  }

  function badMigrationDriver(existing) {
    return {
      connect: function(cb) {
        this.connected = true;
        return cb();
      },
      disconnect: function(cb) {
        this.disconnected = true;
        return cb();
      },
      ensureMigrations: noop,
      lockMigrations: noop,
      unlockMigrations: noop,
      getMigrations: function(cb) {
        cb(null, existing || []);
      },
      runMigration: function(migration, cb) {
        return cb(new Error('Oh Noes'));
      }
    };
  }
});

function noop() {
  arguments[arguments.length - 1]();
}
