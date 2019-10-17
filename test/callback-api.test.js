var path = require('path');
var _ = require('lodash');
var Hath = require('hath');
var report = require('hath-report-spec');
require('hath-assert')(Hath);


var marv = require('../api/callback');

function migrationTableIsEmpty(t, done) {
  t.label('migration table is empty');
  var driver = stubDriver();
  marv.migrate([
    { level: 1, script: 'meh' },
    { level: 2, script: 'meh' }
  ], driver, function(err) {
    if (err) return done(err);
    t.assertEquals(driver.connected, true);
    t.assertEquals(driver.ran.length, 2);
    t.assertEquals(driver.ran[0].level, 1);
    t.assertEquals(driver.ran[1].level, 2);
    t.assertEquals(driver.disconnected, true);
    done();
  });
}

function migrationTableIsNotEmpty(t, done) {
  t.label('migration table is not empty');
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
    t.assertEquals(driver.connected, true);
    t.assertEquals(driver.ran.length, 1);
    t.assertEquals(driver.ran[0].level, 3);
    t.assertEquals(driver.disconnected, true);
    done();
  });
}

function migrationTableIsMissingEntries(t, done) {
  t.label('migration table is missing entries');
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
    t.assertEquals(driver.connected, true);
    t.assertEquals(driver.ran.length, 2);
    t.assertEquals(driver.ran[0].level, 4);
    t.assertEquals(driver.ran[1].level, 5);
    t.assertEquals(driver.disconnected, true);
    done();
  });
}

function defaultNamespace(t, done) {
  t.label('defaults namespace to \'default\'');
  var driver = stubDriver();
  marv.migrate([
    { level: 1, script: 'meh' },
    { level: 2, script: 'meh' }
  ], driver, function(err) {
    if (err) return done(err);
    t.assertEquals(driver.ran[0].namespace, 'default');
    t.assertEquals(driver.ran[1].namespace, 'default');
    done();
  });
}

function namespaceIsolation(t, done) {
  t.label('namespaces are isolated');
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
    t.assertEquals(driver.connected, true);
    t.assertEquals(driver.ran.length, 4);
    t.assertEquals(driver.ran[0].level, 3);
    t.assertEquals(driver.ran[0].namespace, 'outer space');
    t.assertEquals(driver.ran[1].level, 1);
    t.assertEquals(driver.ran[1].namespace, 'inner space');
    t.assertEquals(driver.ran[2].level, 2);
    t.assertEquals(driver.ran[2].namespace, 'inner space');
    t.assertEquals(driver.ran[3].level, 2);
    t.assertEquals(driver.ran[3].namespace, 'default');
    t.assertEquals(driver.disconnected, true);
    done();
  });
}

function connectionFails(t, done) {
  t.label('driver connection fails');
  var driver = badConnectionDriver();
  marv.migrate([], driver, function(err) {
    t.assertTruthy(err);
    t.assertEquals(err.message, 'Oh Noes');
    done();
  });
}

function migrationFails(t, done) {
  t.label('migration connection fails');
  var driver = badMigrationDriver();
  marv.migrate([
    { level: 1, script: 'meh' },
    { level: 2, script: 'meh' }
  ], driver, function(err) {
    t.assertTruthy(err);
    t.assertEquals(err.message, 'Oh Noes');
    t.assertEquals(driver.connected, true);
    t.assertEquals(driver.disconnected, true);
    done();
  });
}

function scansDirectories(t, done) {
  t.label('scans directories');
  marv.scan(path.join(__dirname, 'migrations'), function(err, migrations) {
    if (err) return done(err);
    t.assertEquals(migrations.length, 4);
    t.assertEquals(migrations[0].level, 1);
    t.assertEquals(migrations[0].comment, 'test 1');
    t.assertEquals(migrations[1].level, 2);
    t.assertEquals(migrations[1].comment, 'test 2');
    t.assertEquals(migrations[2].level, 3);
    t.assertEquals(migrations[2].comment, 'test 3');
    t.assertEquals(migrations[3].level, 4);
    t.assertEquals(migrations[3].comment, 'test 4');
    done();
  });
}

function scansDirectoriesWithFilter(t, done) {
  t.label('scans directories with filter');
  marv.scan(path.join(__dirname, 'migrations'), { filter: /\.sql$/ }, function(err, migrations) {
    if (err) return done(err);
    t.assertEquals(migrations.length, 3);
    t.assertEquals(migrations[0].level, 1);
    t.assertEquals(migrations[0].comment, 'test 1');
    t.assertEquals(migrations[1].level, 2);
    t.assertEquals(migrations[1].comment, 'test 2');
    t.assertEquals(migrations[2].level, 3);
    t.assertEquals(migrations[2].comment, 'test 3');
    done();
  });
}

function scansDirectoriesWithMarvRC(t, done) {
  t.label('scans directories .marvrc');
  marv.scan(path.join(__dirname, 'migrations-rc'), function(err, migrations) {
    if (err) return done(err);
    t.assertEquals(migrations.length, 1);
    t.assertEquals(migrations[0].level, 1);
    t.assertEquals(migrations[0].directives.comment, 'marvrc is marvelous');
    t.assertEquals(migrations[0].namespace, 'inner universe');
    done();
  });
}

function reportsMigrationsWithDuplicateLevels(t, done) {
  t.label('reports migrations with duplicate levels');
  marv.scan(path.join(__dirname, 'migrations-dupe'), function(err, migrations) {
    if (!err) return t.assert(err, 'Expected an error');
    t.assertEquals(err.message, 'Found migrations with duplicate levels: 002.test-2.sql, 002.test-3.sql, 002.test-4.sql');
    done();
  });
}

function dropsMigrations(t, done) {
  t.label('drops migrations');
  var driver = stubDriver();
  marv.drop(driver, function(err) {
    if (err) return done(err);
    t.assertEquals(driver.dropped, true);
    done();
  });
}

function decoratesMigrations(t, done) {
  t.label('decorates migrations');
  marv.scan(path.join(__dirname, 'migrations'), { filter: /\.sql$/, directives: { audit: false } }, function(err, migrations) {
    if (err) return done(err);
    t.assertEquals(migrations.length, 3);
    t.assertEquals(migrations[0].level, 1);
    t.assertEquals(migrations[0].directives.audit, false);
    t.assertEquals(migrations[0].directives.foo, 'bar');
    t.assertEquals(migrations[0].directives.meh, 'true');
    done();
  });
}

function scanIsBackwardsCompatible(t, done) {
  t.label('scans is backwards compatible');
  marv.scan(path.join(__dirname, 'migrations'), { quiet: true, filter: /\.sql$/, migrations: { audit: false } }, function(err, migrations) {
    if (err) return done(err);
    t.assertEquals(migrations.length, 3);
    t.assertEquals(migrations[0].level, 1);
    t.assertEquals(migrations[0].directives.audit, false);
    done();
  });
}

function migrateIsBackwardsCompatible(t, done) {
  t.label('migrate is backwards compatible');
  var driver = stubDriver();
  marv.migrate([
    { level: 1, script: 'meh', audit: false },
    { level: 1, script: 'meh', audit: false }
  ], driver, { quiet: true }, function(err) {
    if (err) return done(err);
    t.assertEquals(driver.ran.length, 2);
    done();
  });
}

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

function noop() {
  arguments[arguments.length - 1]();
}

module.exports = Hath.suite('Marv Callback Tests', [
  migrationTableIsEmpty,
  migrationTableIsNotEmpty,
  migrationTableIsMissingEntries,
  defaultNamespace,
  namespaceIsolation,
  connectionFails,
  migrationFails,
  scansDirectories,
  scansDirectoriesWithFilter,
  scansDirectoriesWithMarvRC,
  reportsMigrationsWithDuplicateLevels,
  dropsMigrations,
  decoratesMigrations,
  scanIsBackwardsCompatible,
  migrateIsBackwardsCompatible,
]);

if (module === require.main) {
  module.exports(new Hath(report));
}
