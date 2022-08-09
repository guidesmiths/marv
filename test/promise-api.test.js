const path = require('path');
const _ = require('lodash');
const { strictEqual: eq, rejects } = require('assert');

const marv = require('../api/promise');

describe('Promise API', () => {
  it('should migrate from scratch', async () => {
    const driver = stubDriver([]);
    await marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
      ],
      driver
    );

    eq(driver.connected, true);
    eq(driver.ran.length, 2);
    eq(driver.ran[0].level, 1);
    eq(driver.ran[1].level, 2);
    eq(driver.disconnected, true);
  });

  it('should apply all new migrations', async () => {
    const driver = stubDriver([
      { level: 1, timestamp: new Date(), script: 'meh' },
      { level: 2, timestamp: new Date(), script: 'meh' },
    ]);
    await marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
        { level: 3, script: 'meh' },
        { level: 4, script: 'meh' },
      ],
      driver
    );

    eq(driver.connected, true);
    eq(driver.ran.length, 2);
    eq(driver.ran[0].level, 3);
    eq(driver.ran[1].level, 4);
    eq(driver.disconnected, true);
  });

  it('should no nothing when no new migrations', async () => {
    const driver = stubDriver([
      { level: 1, timestamp: new Date(), script: 'meh' },
      { level: 2, timestamp: new Date(), script: 'meh' },
    ]);
    await marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
      ],
      driver
    );

    eq(driver.connected, true);
    eq(driver.ran.length, 0);
    eq(driver.disconnected, true);
  });

  it('should report skipped migrations', async () => {
    const driver = stubDriver([
      { level: 1, timestamp: new Date(), script: 'meh' },
      { level: 3, timestamp: new Date(), script: 'meh' },
    ]);

    await rejects(
      () => {
        return marv.migrate(
          [
            { level: 1, script: 'meh' },
            { level: 2, script: 'meh' },
            { level: 3, script: 'meh' },
          ],
          driver
        );
      },
      (err) => {
        eq(err.message, 'Migration 2 from namespace: default was skipped');
        return true;
      }
    );
  });

  it('should tolerate skipped migrations that are not audited', async () => {
    const driver = stubDriver([
      { level: 1, timestamp: new Date(), script: 'meh' },
      { level: 3, timestamp: new Date(), script: 'meh' },
    ]);
    await marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh', directives: { audit: true } },
        { level: 3, script: 'meh' },
      ],
      driver
    );

    eq(driver.connected, true);
    eq(driver.ran.length, 0);
    eq(driver.disconnected, true);
  });

  it("should default namespace to 'default'", async () => {
    const driver = stubDriver();
    await marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
      ],
      driver
    );

    eq(driver.ran[0].namespace, 'default');
    eq(driver.ran[1].namespace, 'default');
  });

  it('should ensure namespaces are isolated', async () => {
    const driver = stubDriver([
      { level: 1, timestamp: new Date(), script: 'meh' },
      { level: 1, timestamp: new Date(), script: 'meh', namespace: 'outer space' },
      { level: 2, timestamp: new Date(), script: 'meh', namespace: 'outer space' },
    ]);
    await marv.migrate(
      [
        { level: 2, script: 'meh', namespace: 'outer space' },
        { level: 3, script: 'meh', namespace: 'outer space' },
        { level: 1, script: 'meh', namespace: 'inner space' },
        { level: 2, script: 'meh', namespace: 'inner space' },
        { level: 2, script: 'meh' },
      ],
      driver
    );

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
  });

  it('should report driver connection failure', async () => {
    const driver = badConnectionDriver();

    await rejects(
      () => {
        return marv.migrate([], driver);
      },
      (err) => {
        eq(err.message, 'Oh Noes');
        return true;
      }
    );
  });

  it('should report migration failure', async () => {
    const driver = badMigrationDriver();
    await rejects(
      () => {
        return marv.migrate(
          [
            { level: 1, script: 'meh' },
            { level: 2, script: 'meh' },
          ],
          driver
        );
      },
      (err) => {
        eq(err.message, 'Oh Noes');
        eq(driver.connected, true);
        eq(driver.disconnected, true);
        return true;
      }
    );
  });

  it('should scan directories for compatible migration files', async () => {
    const migrations = await marv.scan(path.join(__dirname, 'migrations'));

    eq(migrations.length, 4);
    eq(migrations[0].level, 1);
    eq(migrations[0].comment, 'test 1');
    eq(migrations[1].level, 2);
    eq(migrations[1].comment, 'test 2');
    eq(migrations[2].level, 3);
    eq(migrations[2].comment, 'test 3');
    eq(migrations[3].level, 4);
    eq(migrations[3].comment, 'test 4');
  });

  it('should filter out incompatible migration files', async () => {
    const migrations = await marv.scan(path.join(__dirname, 'migrations'), { filter: /\.sql$/ });

    eq(migrations.length, 3);
    eq(migrations[0].level, 1);
    eq(migrations[0].comment, 'test 1');
    eq(migrations[1].level, 2);
    eq(migrations[1].comment, 'test 2');
    eq(migrations[2].level, 3);
    eq(migrations[2].comment, 'test 3');
  });

  it('should scan directories specified in .marvrc', async () => {
    const migrations = await marv.scan(path.join(__dirname, 'migrations-rc'));

    eq(migrations.length, 1);
    eq(migrations[0].level, 1);
    eq(migrations[0].directives.comment, 'marvrc is marvelous');
    eq(migrations[0].namespace, 'inner universe');
  });

  it('shoud report migrations with duplicate levels', async () => {
    await rejects(
      () => {
        return marv.scan(path.join(__dirname, 'migrations-dupe'));
      },
      (err) => {
        eq(err.message, 'Found migrations with duplicate levels: 002.test-2.sql, 002.test-3.sql, 002.test-4.sql');
        return true;
      }
    );
  });

  it('should drop migrations table', async () => {
    const driver = stubDriver();
    await marv.drop(driver);

    eq(driver.dropped, true);
  });

  it('should decorate migrations with directives', async () => {
    const migrations = await marv.scan(path.join(__dirname, 'migrations'), { filter: /\.sql$/, directives: { audit: false } });

    eq(migrations.length, 3);
    eq(migrations[0].level, 1);
    eq(migrations[0].directives.audit, false);
    eq(migrations[0].directives.foo, 'bar');
    eq(migrations[0].directives.meh, 'true');
  });

  it('should support legacy scan options', async () => {
    const migrations = await marv.scan(path.join(__dirname, 'migrations'), { quiet: true, filter: /\.sql$/, migrations: { audit: false } });

    eq(migrations.length, 3);
    eq(migrations[0].level, 1);
    eq(migrations[0].directives.audit, false);
  });

  it('should support legacy migration options', async () => {
    const driver = stubDriver();
    await marv.migrate(
      [
        { level: 1, script: 'meh', audit: false },
        { level: 1, script: 'meh', audit: false },
      ],
      driver,
      { quiet: true }
    );

    eq(driver.ran.length, 2);
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
