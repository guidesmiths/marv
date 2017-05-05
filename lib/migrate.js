var async = require('async')
var _ = require('lodash')
var crypto = require('crypto')
var debug = require('debug')('marv:migrate')

module.exports = function migrate(migrations, driver, options, cb) {

    if (arguments.length === 3) return module.exports(arguments[0], arguments[1], {}, arguments[2])
    var connected = false

    var before = options.before || function(migrations, cb) { return cb(null, migrations) }
    var after = options.after || function(migrations, cb) { return cb(null, migrations) }

    var beforeEach = options.beforeEach || function(migration, cb) { return cb(null, migration) }
    var afterEach = options.afterEach || function(migration, cb) { return cb(null, migration) }

    async.seq(connect, ensure, lock, getMigrations, calculateDeltas, before,
              runMigrations, after)(handleConnectionError)

    function handleConnectionError(err) {
        if (!connected) return cb(err)
        async.seq(unlock, disconnect)(function() {
            cb(err)
        })
    }

    function connect(cb) {
        debug('Connecting driver')
        driver.connect(function(err) {
            if (err) return cb(err)
            connected = true
            cb()
        })
    }

    function ensure(cb) {
        debug('Ensuring migrations')
        driver.ensureMigrations(guard(cb))
    }

    function lock(cb) {
        debug('Locking migrations')
        driver.lockMigrations(guard(cb))
    }

    function getMigrations(cb) {
        debug('Getting existing migrations')
        driver.getMigrations(cb)
    }

    function calculateDeltas(existingMigrations, cb) {
        debug('Calculating deltas')
        var watermark = _.sortBy(existingMigrations, 'level').reverse()[0]
        watermark ? debug('Current level is %d', watermark.level) : debug('No existing migrations')
        cb(null, _.chain(migrations).filter(function(migration) {
            return !watermark || migration.level > watermark.level
        }).sortBy('level').map(function(migration) {
            return _.merge({ timestamp: new Date(), checksum: checksum(migration.script) }, migration)
        }).value())
    }

    function checksum(script) {
        return crypto.createHash('md5').update(script, 'utf8').digest('hex')
    }

    function runMigrations(migrations, cb) {
        if (migrations.length === 0) {
            return cb(null, migrations)
        }

        debug('Running %d migrations', migrations.length)
        async.eachSeries(migrations, function(migration, cb) {
            async.seq(beforeEach, function(migration, cb) {
                if (migration.hasOwnProperty('audit') && !migration.hasOwnProperty('directives')) {
                    if (!options.quiet) console.warn("The 'audit' option is deprecated. Please use 'directives.audit' instead. You can disable this warning by setting 'quiet' to true.");
                    _.set(migration, 'directives.audit', migration.audit)
                }
                driver.runMigration(migration, function(err) {
                    if (err) return cb(err);
                    return cb(null, migration)
                })
            }, afterEach)(migration, cb)
        }, function(err) { return cb(err, migrations) })
    }

    function unlock(cb) {
        debug('Unlocking migrations')
        driver.unlockMigrations(guard(cb))
    }

    function disconnect(cb) {
        debug('Disconnecting driver')
        driver.disconnect(guard(cb))
    }

    function guard(cb) {
        return function(err) {
            cb(err)
        }
    }
}
