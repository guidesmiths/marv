const async = require('async');
const _ = require('lodash');
const crypto = require('crypto');
const debug = require('debug')('marv:migrate');

function migrate(...args) {
  if (args.length === 3) return migrate(args[0], args[1], {}, args[2]);
  const [migrations, driver, options, cb] = args;
  let connected = false;

  async.seq(
    connect,
    ensure,
    lock,
    getMigrations,
    namespaceMigrations
  )((err) => {
    if (!connected) return cb(err);
    async.seq(
      unlock,
      disconnect
    )(() => {
      cb(err);
    });
  });

  function connect(cb) {
    debug('Connecting driver');
    driver.connect((err) => {
      if (err) return cb(err);
      connected = true;
      cb();
    });
  }

  function ensure(cb) {
    debug('Ensuring migrations');
    driver.ensureMigrations(guard(cb));
  }

  function lock(cb) {
    debug('Locking migrations');
    driver.lockMigrations(guard(cb));
  }

  function getMigrations(cb) {
    debug('Getting existing migrations');
    driver.getMigrations(cb);
  }

  function namespaceMigrations(existingMigrations, cb) {
    debug('Namespacing existing migrations');
    const namespacedExisting = _.groupBy(existingMigrations, 'namespace');
    const namespacedMigrations = _(migrations).map(stampDefaultNamespace).groupBy('namespace').value();

    async.eachSeries(
      _.keys(namespacedMigrations),
      (namespace, cb) => {
        const previousMigrations = namespacedExisting[namespace] || [];
        const allMigrations = namespacedMigrations[namespace] || [];
        const watermark = getWatermark(namespace, previousMigrations);
        getEligibleMigrations(namespace, watermark, previousMigrations, allMigrations, (err, eligibleMigrations) => {
          if (err) return cb(err);
          runMigrations(namespace, eligibleMigrations, cb);
        });
      },
      cb
    );
  }

  function getWatermark(namespace, previousMigrations) {
    const migration = _.sortBy(previousMigrations, 'level').reverse()[0];
    return migration ? migration.level : 0;
  }

  function getEligibleMigrations(namespace, watermark, previousMigrations, allMigrations, cb) {
    debug('Selecting eligible migrations for namespace: %s from level %d', namespace, watermark);

    let results;
    try {
      results = _.chain(allMigrations)
        .map((candidate) => {
          const previous = previousMigrations.find((p) => p.level === candidate.level);
          return previous ? { ...candidate, ...previous } : { ...candidate };
        })
        .filter((migration) => {
          if (migration.timestamp) return false;
          if (migration.level > watermark) return true;
          if (migration.directives && migration.directives.audit) return false;
          throw new Error(`Migration ${migration.level} from namespace: ${namespace} was skipped`);
        })
        .sortBy('level')
        .map((migration) => _.merge({ timestamp: new Date(), checksum: checksum(migration.script) }, migration))
        .value();
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
        if (migration.hasOwnProperty('audit') && !migration.hasOwnProperty('directives')) {
          /* eslint-disable-next-line no-console */
          if (!options.quiet) console.warn("The 'audit' option is deprecated. Please use 'directives.audit' instead. You can disable this warning by setting 'quiet' to true.");
          _.set(migration, 'directives.audit', migration.audit);
        }
        driver.runMigration(migration, cb);
      },
      guard(cb)
    );
  }

  function unlock(cb) {
    debug('Unlocking migrations');
    driver.unlockMigrations(guard(cb));
  }

  function disconnect(cb) {
    debug('Disconnecting driver');
    driver.disconnect(guard(cb));
  }

  function guard(cb) {
    return (err) => {
      cb(err);
    };
  }

  function stampDefaultNamespace(migration) {
    return _.isNil(migration.namespace) ? _.assign({}, migration, { namespace: 'default' }) : migration;
  }
}

module.exports = migrate;
