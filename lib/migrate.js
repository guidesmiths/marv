const async = require('async');
const crypto = require('node:crypto');
const debug = require('debug')('marv:migrate');
const invoke = require('./driver');

const CHECKSUM_MODES = ['ignore', 'warn', 'error'];

function migrate(...args) {
  if (args.length === 3) return migrate(args[0], args[1], {}, args[2]);
  const [migrations, driver, options, cb] = args;
  const checksums = options?.checksums ?? 'ignore';
  if (!CHECKSUM_MODES.includes(checksums)) return cb(new Error(`Invalid checksums option: ${checksums}. Expected 'ignore', 'warn' or 'error'`));
  let connected = false;

  async.seq(
    connect,
    ensure,
    lock,
    getMigrations,
    namespaceMigrations,
  )((err) => {
    if (!connected) return cb(err);
    async.seq(
      unlock,
      disconnect,
    )(() => {
      cb(err);
    });
  });

  function connect(cb) {
    debug('Connecting driver');
    invoke(driver, 'connect', (err) => {
      if (err) return cb(err);
      connected = true;
      cb();
    });
  }

  function ensure(cb) {
    debug('Ensuring migrations');
    invoke(driver, 'ensureMigrations', guard(cb));
  }

  function lock(cb) {
    debug('Locking migrations');
    invoke(driver, 'lockMigrations', guard(cb));
  }

  function getMigrations(cb) {
    debug('Getting existing migrations');
    invoke(driver, 'getMigrations', cb);
  }

  function namespaceMigrations(existingMigrations, cb) {
    debug('Namespacing existing migrations');
    const namespacedExisting = Object.groupBy(existingMigrations, (migration) => migration.namespace);
    const namespacedMigrations = Object.groupBy(migrations.map(stampDefaultNamespace), (migration) => migration.namespace);

    const duplicate = findDuplicateLevel(namespacedMigrations);
    if (duplicate) return cb(new Error(`Migration ${duplicate.level} from namespace: ${duplicate.namespace} is duplicated by ${duplicate.filenames.join(', ')}`));

    const changed = checksums === 'ignore' ? [] : findChangedMigrations(namespacedMigrations, namespacedExisting);
    for (const migration of changed) {
      const message = `Migration ${migration.level} from namespace: ${migration.namespace} has changed since it was applied (stored ${migration.stored}, current ${migration.current})`;
      if (checksums === 'error') return cb(new Error(message));
      console.warn(message);
    }

    async.eachSeries(
      Object.keys(namespacedMigrations),
      (namespace, cb) => {
        const previousMigrations = namespacedExisting[namespace] || [];
        const allMigrations = namespacedMigrations[namespace] || [];
        const watermark = getWatermark(namespace, previousMigrations);
        getEligibleMigrations(namespace, watermark, previousMigrations, allMigrations, (err, eligibleMigrations) => {
          if (err) return cb(err);
          runMigrations(namespace, eligibleMigrations, cb);
        });
      },
      cb,
    );
  }

  function findDuplicateLevel(namespacedMigrations) {
    for (const [namespace, namespaceMigrations] of Object.entries(namespacedMigrations)) {
      for (const { level } of namespaceMigrations) {
        const duplicates = namespaceMigrations.filter((migration) => migration.level === level);
        if (duplicates.length > 1) return { namespace, level, filenames: duplicates.map((migration) => migration.filename) };
      }
    }
  }

  function findChangedMigrations(namespacedMigrations, namespacedExisting) {
    return Object.entries(namespacedMigrations).flatMap(([namespace, candidates]) =>
      candidates.flatMap((candidate) => {
        const previous = (namespacedExisting[namespace] || []).find((p) => p.level === candidate.level);
        if (!previous?.checksum) return [];
        const current = candidate.checksum ?? checksum(candidate.script);
        return current === previous.checksum ? [] : [{ namespace, level: candidate.level, stored: previous.checksum, current }];
      }),
    );
  }

  function getWatermark(namespace, previousMigrations) {
    return previousMigrations.reduce((watermark, migration) => Math.max(watermark, migration.level), -1);
  }

  function getEligibleMigrations(namespace, watermark, previousMigrations, allMigrations, cb) {
    debug('Selecting eligible migrations for namespace: %s from level %d', namespace, watermark);

    let results;
    try {
      results = allMigrations
        .map((candidate) => {
          const previous = previousMigrations.find((p) => p.level === candidate.level);
          return previous ? { ...candidate, ...previous } : { ...candidate };
        })
        .filter((migration) => {
          if (migration.timestamp) return false;
          if (migration.level > watermark) return true;
          if (migration.directives?.audit) return false;
          throw new Error(`Migration ${migration.level} from namespace: ${namespace} was skipped`);
        })
        .toSorted((a, b) => a.level - b.level)
        .map((migration) => ({ timestamp: new Date(), checksum: checksum(migration.script), ...migration }));
    } catch (err) {
      return cb(err);
    }
    cb(null, results);
  }

  function checksum(script) {
    return crypto.createHash('md5').update(script, 'utf8').digest('hex');
  }

  function runMigrations(namespace, eligibleMigrations, cb) {
    debug('Running %d migrations for namespace: %s', eligibleMigrations.length, namespace);
    async.eachSeries(
      eligibleMigrations,
      (migration, cb) => {
        invoke(driver, 'runMigration', migration, cb);
      },
      guard(cb),
    );
  }

  function unlock(cb) {
    debug('Unlocking migrations');
    invoke(driver, 'unlockMigrations', guard(cb));
  }

  function disconnect(cb) {
    debug('Disconnecting driver');
    invoke(driver, 'disconnect', guard(cb));
  }

  function guard(cb) {
    return (err) => {
      cb(err);
    };
  }

  function stampDefaultNamespace(migration) {
    return migration.namespace == null ? { ...migration, namespace: 'default' } : migration;
  }
}

module.exports = migrate;
