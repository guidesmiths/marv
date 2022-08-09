const path = require('path');
const _ = require('lodash');
const { strictEqual: eq, ok } = require('assert');

const marv = require('../api/callback');

describe('Callback API Test', () => {
  it('should migrate from scratch', (t, done) => {
    const driver = stubDriver([]);
    marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
      ],
      driver,
      (err) => {
        if (err) return done(err);
        eq(driver.connected, true);
        eq(driver.ran.length, 2);
        eq(driver.ran[0].level, 1);
        eq(driver.ran[1].level, 2);
        eq(driver.disconnected, true);
        done();
      }
    );
  });

  it('should apply all new migrations', (t, done) => {
    const driver = stubDriver([
      { level: 1, timestamp: new Date(), script: 'meh' },
      { level: 2, timestamp: new Date(), script: 'meh' },
    ]);
    marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
        { level: 3, script: 'meh' },
        { level: 4, script: 'meh' },
      ],
      driver,
      (err) => {
        if (err) return done(err);
        eq(driver.connected, true);
        eq(driver.ran.length, 2);
        eq(driver.ran[0].level, 3);
        eq(driver.ran[1].level, 4);
        eq(driver.disconnected, true);
        done();
      }
    );
  });

  it('should no nothing when no new migrations', (t, done) => {
    const driver = stubDriver([
      { level: 1, timestamp: new Date(), script: 'meh' },
      { level: 2, timestamp: new Date(), script: 'meh' },
    ]);
    marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
      ],
      driver,
      (err) => {
        if (err) return done(err);
        eq(driver.connected, true);
        eq(driver.ran.length, 0);
        eq(driver.disconnected, true);
        done();
      }
    );
  });

  it('should report skipped migrations', (t, done) => {
    const driver = stubDriver([
      { level: 1, timestamp: new Date(), script: 'meh' },
      { level: 3, timestamp: new Date(), script: 'meh' },
    ]);
    marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
        { level: 3, script: 'meh' },
      ],
      driver,
      (err) => {
        ok(err);
        eq(err.message, 'Migration 2 from namespace: default was skipped');
        done();
      }
    );
  });

  it('should tolerate skipped migrations that are not audited', (t, done) => {
    const driver = stubDriver([
      { level: 1, timestamp: new Date(), script: 'meh' },
      { level: 3, timestamp: new Date(), script: 'meh' },
    ]);
    marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh', directives: { audit: true } },
        { level: 3, script: 'meh' },
      ],
      driver,
      (err) => {
        if (err) return done(err);
        eq(driver.connected, true);
        eq(driver.ran.length, 0);
        eq(driver.disconnected, true);
        done();
      }
    );
  });

  it("should default namespace to 'default'", (t, done) => {
    const driver = stubDriver();
    marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
      ],
      driver,
      (err) => {
        if (err) return done(err);
        eq(driver.ran[0].namespace, 'default');
        eq(driver.ran[1].namespace, 'default');
        done();
      }
    );
  });

  it('should ensure namespaces are isolated', (t, done) => {
    const driver = stubDriver([
      { level: 1, timestamp: new Date(), script: 'meh' },
      { level: 1, timestamp: new Date(), script: 'meh', namespace: 'outer space' },
      { level: 2, timestamp: new Date(), script: 'meh', namespace: 'outer space' },
    ]);
    marv.migrate(
      [
        { level: 2, script: 'meh', namespace: 'outer space' },
        { level: 3, script: 'meh', namespace: 'outer space' },
        { level: 1, script: 'meh', namespace: 'inner space' },
        { level: 2, script: 'meh', namespace: 'inner space' },
        { level: 2, script: 'meh' },
      ],
      driver,
      (err) => {
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
      }
    );
  });

  it('should report driver connection failure', (t, done) => {
    const driver = badConnectionDriver();
    marv.migrate([], driver, (err) => {
      ok(err);
      eq(err.message, 'Oh Noes');
      done();
    });
  });

  it('should report migration failure', (t, done) => {
    const driver = badMigrationDriver();
    marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
      ],
      driver,
      (err) => {
        ok(err);
        eq(err.message, 'Oh Noes');
        eq(driver.connected, true);
        eq(driver.disconnected, true);
        done();
      }
    );
  });

  it('should scan directories for compatible migration files', (t, done) => {
    marv.scan(path.join(__dirname, 'migrations'), (err, migrations) => {
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

  it('should filter out incompatible migration files', (t, done) => {
    marv.scan(path.join(__dirname, 'migrations'), { filter: /\.sql$/ }, (err, migrations) => {
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

  it('should scan directories specified in .marvrc', (t, done) => {
    marv.scan(path.join(__dirname, 'migrations-rc'), (err, migrations) => {
      if (err) return done(err);
      eq(migrations.length, 1);
      eq(migrations[0].level, 1);
      eq(migrations[0].directives.comment, 'marvrc is marvelous');
      eq(migrations[0].namespace, 'inner universe');
      done();
    });
  });

  it('shoud report migrations with duplicate levels', (t, done) => {
    marv.scan(path.join(__dirname, 'migrations-dupe'), (err) => {
      if (!err) return t.assert(err, 'Expected an error');
      eq(err.message, 'Found migrations with duplicate levels: 002.test-2.sql, 002.test-3.sql, 002.test-4.sql');
      done();
    });
  });

  it('should drop migrations table', (t, done) => {
    const driver = stubDriver();
    marv.drop(driver, (err) => {
      if (err) return done(err);
      eq(driver.dropped, true);
      done();
    });
  });

  it('should decorate migrations with directives', (t, done) => {
    marv.scan(path.join(__dirname, 'migrations'), { filter: /\.sql$/, directives: { audit: false } }, (err, migrations) => {
      if (err) return done(err);
      eq(migrations.length, 3);
      eq(migrations[0].level, 1);
      eq(migrations[0].directives.audit, false);
      eq(migrations[0].directives.foo, 'bar');
      eq(migrations[0].directives.meh, 'true');
      done();
    });
  });

  it('should support legacy scan options', (t, done) => {
    marv.scan(path.join(__dirname, 'migrations'), { quiet: true, filter: /\.sql$/, migrations: { audit: false } }, (err, migrations) => {
      if (err) return done(err);
      eq(migrations.length, 3);
      eq(migrations[0].level, 1);
      eq(migrations[0].directives.audit, false);
      done();
    });
  });

  it('should support legacy migration options', (t, done) => {
    const driver = stubDriver();
    marv.migrate(
      [
        { level: 1, script: 'meh', audit: false },
        { level: 1, script: 'meh', audit: false },
      ],
      driver,
      { quiet: true },
      (err) => {
        if (err) return done(err);
        eq(driver.ran.length, 2);
        done();
      }
    );
  });

  function stubDriver(existing) {
    const stored = _.map(existing, (migration) => _.assign({}, { namespace: 'default' }, migration));

    return {
      connect(cb) {
        this.connected = true;
        this.ran = [];
        return cb();
      },
      disconnect(cb) {
        this.disconnected = true;
        return cb();
      },
      dropMigrations(cb) {
        this.dropped = true;
        cb();
      },
      ensureMigrations: noop,
      lockMigrations: noop,
      unlockMigrations: noop,
      getMigrations(cb) {
        cb(null, stored || []);
      },
      runMigration(migration, cb) {
        this.ran = this.ran.concat(migration);
        cb();
      },
    };
  }

  function badConnectionDriver() {
    return {
      connect(cb) {
        return cb(new Error('Oh Noes'));
      },
    };
  }

  function badMigrationDriver(existing) {
    return {
      connect(cb) {
        this.connected = true;
        return cb();
      },
      disconnect(cb) {
        this.disconnected = true;
        return cb();
      },
      ensureMigrations: noop,
      lockMigrations: noop,
      unlockMigrations: noop,
      getMigrations(cb) {
        cb(null, existing || []);
      },
      runMigration(migration, cb) {
        return cb(new Error('Oh Noes'));
      },
    };
  }
});

function noop(...args) {
  args[args.length - 1]();
}
