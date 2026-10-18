const { describe, it } = require('node:test');
const crypto = require('node:crypto');
const { strictEqual: eq, deepStrictEqual: deepEqual, rejects } = require('node:assert');

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

  describe('Accept Directive', () => {
    it('should tolerate accepted changes when checksums are set to error', async () => {
      const driver = stubDriver([applied({ level: 1, script: 'original' })]);
      await marv.migrate(
        [
          { level: 1, script: 'changed', directives: { accept: md5('original') } },
          { level: 2, script: 'meh' },
        ],
        driver,
        { checksums: 'error' },
      );
      eq(driver.ran.length, 1);
      eq(driver.ran[0].level, 2);
    });

    it('should report changes that were not accepted when checksums are set to error', async () => {
      const driver = stubDriver([applied({ level: 1, script: 'original' })]);
      await rejects(
        () =>
          marv.migrate(
            [
              { level: 1, script: 'changed', directives: { accept: md5('something else') } },
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
    });

    it('should not warn about accepted changes when checksums are set to warn', async (t) => {
      const warn = t.mock.method(console, 'warn', () => {});
      const driver = stubDriver([applied({ level: 1, script: 'original' })]);
      await marv.migrate(
        [
          { level: 1, script: 'changed', directives: { accept: md5('original') } },
          { level: 2, script: 'meh' },
        ],
        driver,
        { checksums: 'warn' },
      );
      eq(warn.mock.callCount(), 0);
      eq(driver.ran.length, 1);
    });

    it('should accept each of several checksums, ignoring surrounding whitespace', async () => {
      const accept = ` ${md5('v1')} ,${md5('v2')},  ${md5('v3')} ,`;
      for (const version of ['v1', 'v2', 'v3']) {
        const driver = stubDriver([applied({ level: 1, script: version })]);
        await marv.migrate([{ level: 1, script: 'changed', directives: { accept } }], driver, { checksums: 'error' });
        eq(driver.ran.length, 0);
      }
    });

    it('should not pass the accept directive to the driver', async () => {
      const driver = stubDriver();
      const directives = { accept: md5('original'), audit: true, comment: 'hello', skip: false };
      const migrations = [{ level: 1, script: 'meh', directives }];
      await marv.migrate(migrations, driver, { checksums: 'error' });
      eq(driver.ran.length, 1);
      deepEqual(driver.ran[0].directives, { audit: true, comment: 'hello', skip: false });
      deepEqual(migrations[0].directives, { accept: md5('original'), audit: true, comment: 'hello', skip: false });
    });

    it('should leave migrations without directives untouched', async () => {
      const driver = stubDriver();
      await marv.migrate([{ level: 1, script: 'meh' }], driver, { checksums: 'error' });
      eq(driver.ran[0].directives, undefined);
    });

    it('should ignore the accept directive when checksums are set to ignore', async () => {
      const driver = stubDriver([applied({ level: 1, script: 'original' })]);
      await marv.migrate(
        [
          { level: 1, script: 'changed', directives: { accept: 'unrelated' } },
          { level: 2, script: 'meh' },
        ],
        driver,
      );
      eq(driver.ran.length, 1);
      eq(driver.ran[0].level, 2);
    });
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
