const { describe, it } = require('node:test');
const { strictEqual: eq, rejects } = require('node:assert');

const marv = require('../api/promise');
const callbackMarv = require('../api/callback');

describe('Promise Driver', () => {
  it('should migrate with a driver implemented entirely with async methods', async () => {
    const driver = asyncDriver([{ level: 1, timestamp: new Date(), script: 'meh' }]);
    await marv.migrate(
      [
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
      ],
      driver,
    );

    eq(driver.connected, true);
    eq(driver.ran.length, 1);
    eq(driver.ran[0].level, 2);
    eq(driver.disconnected, true);
  });

  it('should migrate with an async driver via the callback api', (t, done) => {
    const driver = asyncDriver();
    callbackMarv.migrate([{ level: 1, script: 'meh' }], driver, (err) => {
      if (err) return done(err);
      eq(driver.ran.length, 1);
      eq(driver.disconnected, true);
      done();
    });
  });

  it('should report async driver connection failure', async () => {
    const driver = asyncDriver();
    driver.connect = async () => {
      throw new Error('Oh Noes');
    };

    await rejects(() => marv.migrate([], driver), { message: 'Oh Noes' });
  });

  it('should report async driver migration failure', async () => {
    const driver = asyncDriver();
    driver.runMigration = async () => {
      throw new Error('Oh Noes');
    };

    await rejects(() => marv.migrate([{ level: 1, script: 'meh' }], driver), { message: 'Oh Noes' });
    eq(driver.connected, true);
    eq(driver.disconnected, true);
  });

  it('should ignore values resolved by async driver methods', async () => {
    const driver = asyncDriver();
    driver.lockMigrations = async () => true;

    await marv.migrate([{ level: 1, script: 'meh' }], driver);
    eq(driver.ran.length, 1);
  });

  it('should tolerate async driver methods that also invoke the callback', (t, done) => {
    const driver = asyncDriver();
    driver.disconnect = async function disconnect(cb) {
      this.disconnected = true;
      cb();
    };

    let completions = 0;
    callbackMarv.migrate([{ level: 1, script: 'meh' }], driver, (err) => {
      if (err) return done(err);
      completions++;
      eq(driver.disconnected, true);
      setImmediate(() => {
        eq(completions, 1);
        done();
      });
    });
  });

  it('should drop migrations with an async driver', async () => {
    const driver = asyncDriver();
    await marv.drop(driver);
    eq(driver.dropped, true);
    eq(driver.disconnected, true);
  });

  function asyncDriver(existing = []) {
    const stored = existing.map((migration) => ({ namespace: 'default', ...migration }));

    return {
      async connect() {
        this.connected = true;
        this.ran = [];
      },
      async disconnect() {
        this.disconnected = true;
      },
      async dropMigrations() {
        this.dropped = true;
      },
      async ensureMigrations() {},
      async lockMigrations() {},
      async unlockMigrations() {},
      async getMigrations() {
        return stored;
      },
      async runMigration(migration) {
        this.ran = this.ran.concat(migration);
      },
    };
  }
});
