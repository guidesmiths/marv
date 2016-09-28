var path = require('path')
var Hath = require('hath')
require('hath-assert')(Hath)

var marv = require('..')

function migrationTableIsEmpty(t, done) {
    t.label('migration table is empty')
    var driver = stubDriver()
    marv.migrate([
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' }
    ], driver, function(err) {
        if (err) return done(err)
        t.assertEquals(driver.ran.length, 2)
        t.assertEquals(driver.ran[0].level, 1)
        t.assertEquals(driver.ran[1].level, 2)
        done()
    })
}

function migrationTableIsNotEmpty(t, done) {
    t.label('migration table is not empty')
    var driver = stubDriver([
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' }
    ])
    marv.migrate([
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
        { level: 3, script: 'meh' }
    ], driver, function(err) {
        if (err) return done(err)
        t.assertEquals(driver.ran.length, 1)
        t.assertEquals(driver.ran[0].level, 3)
        done()
    })
}

function migrationTableIsMissingEntries(t, done) {
    t.label('migration table is missing entries')
    var driver = stubDriver([
        { level: 3, script: 'meh' }
    ])
    marv.migrate([
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' },
        { level: 3, script: 'meh' },
        { level: 4, script: 'meh' },
        { level: 5, script: 'meh' }
    ], driver, function(err) {
        if (err) return done(err)
        t.assertEquals(driver.ran.length, 2)
        t.assertEquals(driver.ran[0].level, 4)
        t.assertEquals(driver.ran[1].level, 5)
        done()
    })
}

function scansDirectories(t, done) {
    t.label('scans directories')
    marv.scan(path.join(__dirname, 'migrations'), { filter: /\.sql$/ }, function(err, migrations) {
        if (err) return done(err)
        t.assertEquals(migrations.length, 3)
        t.assertEquals(migrations[0].level, 1)
        t.assertEquals(migrations[0].comment, 'test 1')
        t.assertEquals(migrations[1].level, 2)
        t.assertEquals(migrations[1].comment, 'test 2')
        t.assertEquals(migrations[2].level, 3)
        t.assertEquals(migrations[2].comment, 'test 3')
        done()
    })
}

function decoratesMigrations(t, done) {
    t.label('scans directories')
    marv.scan(path.join(__dirname, 'migrations'), { filter: /\.sql$/, migrations: { audit: false } }, function(err, migrations) {
        if (err) return done(err)
        t.assertEquals(migrations.length, 3)
        t.assertEquals(migrations[0].level, 1)
        t.assertEquals(migrations[0].audit, false)
        done()
    })
}

function stubDriver(existing) {
    return {
        connect: noop,
        disconnect: noop,
        deleteMigrations: noop,
        ensureMigrations: noop,
        lockMigrations: noop,
        unlockMigrations: noop,
        getMigrations: function(cb) {
            cb(null, existing || [])
        },
        runMigration: function(migration, cb) {
            this.ran = (this.ran || []).concat(migration)
            cb()
        }
    }
}

function noop() {
    arguments[arguments.length - 1]()
}

module.exports = Hath.suite('Marv Tests', [
    migrationTableIsEmpty,
    migrationTableIsNotEmpty,
    migrationTableIsMissingEntries,
    scansDirectories,
    decoratesMigrations
])

if (module === require.main) {
  module.exports(new Hath())
}