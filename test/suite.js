var path = require('path')
var Hath = require('hath')
var marv = require('..')

function migrationTableIsEmpty(t, done) {
    t.label('migration table is empty')
    var driver = stubDriver()
    marv.migrate([
        { level: 1, script: 'meh' },
        { level: 2, script: 'meh' }
    ], driver, function(err) {
        if (err) throw err
        t.assert(driver.ran.length === 2, 'Expected 2 migrations but ran ' + driver.ran.length)
        t.assert(driver.ran[0].level === 1, 'Expected level 1 but found level ' + driver.ran[0].level)
        t.assert(driver.ran[1].level === 2, 'Expected level 2 but found level ' + driver.ran[0].level)
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
        if (err) throw err
        t.assert(driver.ran.length === 1, 'Expected 1 migration but ran ' + driver.ran.length)
        t.assert(driver.ran[0].level === 3, 'Expected level 3 but found level ' + driver.ran[0].level)
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
        if (err) throw err
        t.assert(driver.ran.length === 2, 'Expected 2 migrations but ran ' + driver.ran.length)
        t.assert(driver.ran[0].level === 4, 'Expected level 4 but found level ' + driver.ran[0].level)
        t.assert(driver.ran[1].level === 5, 'Expected level 5 but found level ' + driver.ran[1].level)
        done()
    })
}

function scansDirectories(t, done) {
    t.label('scans directories')
    marv.scan(path.join(__dirname, 'migrations'), function(err, migrations) {
        if (err) throw err
        t.assert(migrations.length === 3, 'Expected 2 migrations but found ' + migrations.length)
        t.assert(migrations[0].level === 1, 'Expected level 1 but found level ' + migrations[0].level)
        t.assert(migrations[0].comment === 'test 1', 'Expected "test 1" but found "' + migrations[0].comment + "'")
        t.assert(migrations[1].level === 2, 'Expected level 2 but found level ' + migrations[1].level)
        t.assert(migrations[1].comment === 'test 2', 'Expected "test 2" but found "' + migrations[1].comment + "'")
        t.assert(migrations[2].level === 3, 'Expected level 3 but found level ' + migrations[2].level)
        t.assert(migrations[2].comment === 'test 3', 'Expected "test 3" but found "' + migrations[2].comment + "'")
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
    scansDirectories
])

if (module === require.main) {
  module.exports(new Hath())
}