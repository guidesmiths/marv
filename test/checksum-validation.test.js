const { describe, it } = require('node:test');
const crypto = require('node:crypto');
const { strictEqual: eq, rejects } = require('node:assert');

const marv = require('../api/promise');

describe('Checksum Validation', () => {
  const applied = (migration) => ({ timestamp: new Date(), checksum: md5(migration.script), ...migration });

  it('should ignore changed migrations by default', async () => {
    const driver = stubDriver([applied({ level: 1, script: 'original' })]);
    await marv.migrate(
      [
        { level: 1, script: 'changed' },
        { level: 2, script: 'meh' },
      ],
      driver,
    );
    eq(driver.ran.length, 1);
    eq(driver.ran[0].level, 2);
  });

  it('should report changed migrations when checksums are set to error', async () => {
    const driver = stubDriver([applied({ level: 1, script: 'original' })]);
    await rejects(
      () =>
        marv.migrate(
          [
            { level: 1, script: 'changed' },
            { level: 2, script: 'meh' },
          ],
          driver,
          { checksums: 'error' },
        ),
      {
        message: `Migration 1 from namespace: default has changed since it was applied (stored ${md5('original')}, current ${md5('changed')})`,
      },
    );
    eq(driver.ran.length, 0);
    eq(driver.disconnected, true);
  });

  it('should tolerate unchanged migrations when checksums are set to error', async () => {
    const driver = stubDriver([applied({ level: 1, script: 'original' })]);
    await marv.migrate(
      [
        { level: 1, script: 'original' },
        { level: 2, script: 'meh' },
      ],
      driver,
      { checksums: 'error' },
    );
    eq(driver.ran.length, 1);
    eq(driver.ran[0].level, 2);
  });

  it('should prefer checksums supplied by the caller', async () => {
    const driver = stubDriver([applied({ level: 1, script: 'original', checksum: 'custom-v1:abc' })]);
    await marv.migrate([{ level: 1, script: 'changed', checksum: 'custom-v1:abc' }], driver, { checksums: 'error' });
    eq(driver.ran.length, 0);
  });

  it('should skip applied migrations without a stored checksum', async () => {
    const driver = stubDriver([{ level: 1, timestamp: new Date(), script: 'original' }]);
    await marv.migrate([{ level: 1, script: 'changed' }], driver, { checksums: 'error' });
    eq(driver.ran.length, 0);
  });

  it('should warn about changed migrations when checksums are set to warn', async (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const driver = stubDriver([applied({ level: 1, script: 'original' })]);
    await marv.migrate(
      [
        { level: 1, script: 'changed' },
        { level: 2, script: 'meh' },
      ],
      driver,
      { checksums: 'warn' },
    );
    eq(warn.mock.callCount(), 1);
    eq(warn.mock.calls[0].arguments[0], `Migration 1 from namespace: default has changed since it was applied (stored ${md5('original')}, current ${md5('changed')})`);
    eq(driver.ran.length, 1);
    eq(driver.ran[0].level, 2);
  });

  it('should tolerate undefined options', async () => {
    const driver = stubDriver([applied({ level: 1, script: 'original' })]);
    await marv.migrate(
      [
        { level: 1, script: 'changed' },
        { level: 2, script: 'meh' },
      ],
      driver,
      undefined,
    );
    eq(driver.ran.length, 1);
  });

  it('should reject unknown checksums options', async () => {
    const driver = stubDriver();
    await rejects(() => marv.migrate([], driver, { checksums: 'explode' }), { message: "Invalid checksums option: explode. Expected 'ignore', 'warn' or 'error'" });
  });

  function md5(script) {
    return crypto.createHash('md5').update(script, 'utf8').digest('hex');
  }

  function stubDriver(existing = []) {
    const stored = existing.map((migration) => ({ namespace: 'default', ...migration }));

    return {
      async connect() {
        this.connected = true;
        this.ran = [];
      },
      async disconnect() {
        this.disconnected = true;
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
