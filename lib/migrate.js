var async = require('async')
var _ = require('lodash')
var crypto = require('crypto')
var debug = require('debug')('marv:migrate')

module.exports = function migrate(migrations, driver, cb) {

    async.seq(connect, ensure, lock, getMigrations, getDeltas, runMigrations, unlock)(function(err) {
        disconnect(function(disconnectErr) {
            cb(err || disconnectErr)
        })
    })

    function connect(cb) {
        debug('Connecting to database')
        driver.connect(guard(cb))
    }

    function ensure(cb) {
        debug('Ensuring migrations table')
        driver.ensureMigrations(guard(cb))
    }

    function lock(cb) {
        debug('Locking migrations table')
        driver.lockMigrations(guard(cb))
    }

    function getMigrations(cb) {
        debug('Getting existing migrations')
        driver.getMigrations(cb)
    }

    function getDeltas(existingMigrations, cb) {
        debug('Getting deltas')
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
        debug('Running %d migrations', migrations.length)
        async.eachSeries(migrations, function(migration, cb) {
            driver.runMigration(migration, cb)
        }, guard(cb))
    }

    function unlock(cb) {
        debug('Unlocking migrations table')
        driver.unlockMigrations(guard(cb))
    }

    function disconnect(cb) {
        debug('Disconnecting from database')
        driver.disconnect(guard(cb))
    }

    function guard(cb) {
        return function(err) {
            cb(err)
        }
    }
}
