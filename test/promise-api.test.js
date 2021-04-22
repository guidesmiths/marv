const path = require('path');
const _ = require('lodash');
const { strictEqual: eq, rejects } = require('assert');

const marv = require('../api/promise');

describe('Promise API', () => {

  it('migration table is empty', async () => {
    const driver = stubDriver();
    await marv.migrate([
      { level: 1, script: 'meh' },
      { level: 2, script: 'meh' }
    ], driver);

    eq(driver.connected, true);
    eq(driver.ran.length, 2);
    eq(driver.ran[0].level, 1);
    eq(driver.ran[1].level, 2);
    eq(driver.disconnected, true);
  });

  it('migration table is not empty', async () => {
    const driver = stubDriver([
      { level: 1, script: 'meh' },
      { level: 2, script: 'meh' }
    ]);
    await marv.migrate([
      { level: 1, script: 'meh' },
      { level: 2, script: 'meh' },
      { level: 3, script: 'meh' }
    ], driver);

    eq(driver.connected, true);
    eq(driver.ran.length, 1);
    eq(driver.ran[0].level, 3);
    eq(driver.disconnected, true);
  });

  it('migration table is missing entries', async () => {
    const driver = stubDriver([
      { level: 3, script: 'meh' }
    ]);
    await marv.migrate([
      { level: 1, script: 'meh' },
      { level: 2, script: 'meh' },
      { level: 3, script: 'meh' },
      { level: 4, script: 'meh' },
      { level: 5, script: 'meh' }
    ], driver);

      eq(driver.connected, true);
      eq(driver.ran.length, 2);
      eq(driver.ran[0].level, 4);
      eq(driver.ran[1].level, 5);
      eq(driver.disconnected, true);
  });

  it('defaults namespace to \'default\'', async () => {
    const driver = stubDriver();
    await marv.migrate([
      { level: 1, script: 'meh' },
      { level: 2, script: 'meh' }
    ], driver);

      eq(driver.ran[0].namespace, 'default');
      eq(driver.ran[1].namespace, 'default');
  });

  it('namespaces are isolated', async () => {
    const driver = stubDriver([
      { level: 1, script: 'meh' },
      { level: 1, script: 'meh', namespace: 'outer space' },
      { level: 2, script: 'meh', namespace: 'outer space' }
    ]);
    await marv.migrate([
      { level: 2, script: 'meh', namespace: 'outer space' },
      { level: 3, script: 'meh', namespace: 'outer space' },
      { level: 1, script: 'meh', namespace: 'inner space' },
      { level: 2, script: 'meh', namespace: 'inner space' },
      { level: 2, script: 'meh' }
    ], driver);

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

  it('driver connection fails', async () => {
    const driver = badConnectionDriver();
    await rejects(() => marv.migrate([], driver), /Oh Noes/);
  });

  it('migration connection fails', async () => {
    const driver = badMigrationDriver();
    await rejects(() =>
      marv.migrate([
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' }
      ], driver)
    , /Oh Noes/);

    eq(driver.connected, true);
    eq(driver.disconnected, true);
  });

  it('scans directories', async () => {
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

  it('scans directories with filter', async () => {
    const migrations = await marv.scan(path.join(__dirname, 'migrations'), { filter: /\.sql$/ });
      eq(migrations.length, 3);
      eq(migrations[0].level, 1);
      eq(migrations[0].comment, 'test 1');
      eq(migrations[1].level, 2);
      eq(migrations[1].comment, 'test 2');
      eq(migrations[2].level, 3);
      eq(migrations[2].comment, 'test 3');
  });

  it('scans directories .marvrc', async () => {
    const migrations = await marv.scan(path.join(__dirname, 'migrations-rc'));
      eq(migrations.length, 1);
      eq(migrations[0].level, 1);
      eq(migrations[0].directives.comment, 'marvrc is marvelous');
      eq(migrations[0].namespace, 'inner universe');
  });

  it('reports migrations with duplicate levels', async () => {
    await rejects(() => marv.scan(path.join(__dirname, 'migrations-dupe')), /Found migrations with duplicate levels: 002.test-2.sql, 002.test-3.sql, 002.test-4.sql/);
  });

  it('drops migrations', async () => {
    const driver = stubDriver();
    await marv.drop(driver);

      eq(driver.dropped, true);
  });

  it('scans directories', async () => {
    const migrations = await marv.scan(path.join(__dirname, 'migrations'), { filter: /\.sql$/, directives: { audit: false } });
      eq(migrations.length, 3);
      eq(migrations[0].level, 1);
      eq(migrations[0].directives.audit, false);
      eq(migrations[0].directives.foo, 'bar');
      eq(migrations[0].directives.meh, 'true');
  });

  it('scans is backwards compatible', async () => {
    const migrations = await marv.scan(path.join(__dirname, 'migrations'), { quiet: true, filter: /\.sql$/, migrations: { audit: false } });
      eq(migrations.length, 3);
      eq(migrations[0].level, 1);
      eq(migrations[0].directives.audit, false);
  });

  it('migrate is backwards compatible', async () => {
    const driver = stubDriver();
    await marv.migrate([
      { level: 1, script: 'meh', audit: false },
      { level: 1, script: 'meh', audit: false }
    ], driver, { quiet: true });

      eq(driver.ran.length, 2);
  });
});

function stubDriver(existing) {
  const stored = _.map(existing, (migration) => _.assign({}, {namespace: 'default'}, migration));

  return {
    connect(cb) {
      this.connected = true;
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
      this.ran = (this.ran || []).concat(migration);
      cb();
    }
  };
}

function badConnectionDriver() {
  return {
    connect(cb) {
      return cb(new Error('Oh Noes'));
    }
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
    }
  };
}

function noop(...args) {
  args[args.length - 1]();
}
